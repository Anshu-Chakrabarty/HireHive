import express from 'express';
import { pool, supabase } from '../db.js';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==========================================
// 🛡️ SAFE PDF LOADER
// ==========================================
const require = createRequire(
    import.meta.url);
let pdfParser = null;

try {
    // We try to load it. If it fails, we just don't use it.
    pdfParser = require('pdf-parse');
} catch (err) {
    console.warn("⚠️ PDF Library could not be loaded. Skipping text analysis.");
}

// Helper to safely parse or fail gracefully
async function safeParsePDF(buffer) {
    if (!pdfParser) return "";

    try {
        // Try standard function call
        if (typeof pdfParser === 'function') {
            const data = await pdfParser(buffer);
            return data.text;
        }
        // Try .default (ESM compat)
        if (pdfParser.default && typeof pdfParser.default === 'function') {
            const data = await pdfParser.default(buffer);
            return data.text;
        }
        // If we get here, the library is loaded but weird (like your logs show).
        // We return empty string instead of crashing.
        console.warn("⚠️ PDF Library format unrecognized. Skipping.");
        return "";
    } catch (err) {
        console.warn("⚠️ PDF Parsing error (ignored):", err.message);
        return "";
    }
}
// ==========================================


// --- STATS ROUTES ---
router.get('/stats', async(req, res) => {
    try {
        const [employers, candidates, jobs, revenue] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM users WHERE role = 'employer'"),
            pool.query("SELECT COUNT(*) FROM users WHERE role = 'candidate'"),
            pool.query("SELECT COUNT(*) FROM jobs"),
            pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'success'")
        ]);
        res.json({
            totalClients: parseInt(employers.rows[0].count),
            totalCandidates: parseInt(candidates.rows[0].count),
            activeJobs: parseInt(jobs.rows[0].count),
            totalRevenue: parseFloat(revenue.rows[0].total)
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error loading stats' });
    }
});

router.get('/revenue-chart', async(req, res) => {
    try {
        const result = await pool.query(`SELECT TO_CHAR(created_at, 'Mon') as name, SUM(amount) as revenue FROM payments WHERE status = 'success' GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at) ORDER BY DATE_TRUNC('month', created_at)`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server Error loading graph' });
    }
});

router.get('/logs', async(req, res) => {
    try {
        const result = await pool.query(`SELECT u.name, l.action, l.created_at FROM system_logs l JOIN users u ON l.admin_id = u.id ORDER BY l.created_at DESC LIMIT 5`);
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

// ==========================================
// ✅ CRASH-PROOF UPLOAD ROUTE
// ==========================================

router.post('/upload-cv', upload.single('cv'), async(req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // 1. Upload to Supabase (Critical - Must Work)
        const fileName = `${Date.now()}_${req.file.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('resumes')
            .upload(fileName, req.file.buffer, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // 2. Try to Read Text (Non-Critical - Can Fail safely)
        console.log("🔍 Attempting to extract text...");
        const text = await safeParsePDF(req.file.buffer);
        console.log("📝 Extracted characters:", text.length);

        // 3. Determine Data (Use Fallbacks)
        let name = "Manual Entry Required";
        let email = null;
        let phone = null;

        if (text.length > 0) {
            const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            email = emailMatch ? emailMatch[0] : null;

            const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            phone = phoneMatch ? phoneMatch[0] : null;

            const lines = text.split('\n').filter(line => line.trim().length > 0);
            name = lines[0] || "Unknown Candidate";
        }

        // 4. Handle Missing Data (Prevent DB Crash)
        let statusMessage = "Candidate Onboarded Successfully!";
        if (!email) {
            // Generate a fake email so DB doesn't reject the row
            email = `pending_${Date.now()}@hirehive.temp`;
            statusMessage = "File Uploaded! (AI could not read text - please edit details manually)";
        }

        // 5. Check Duplicates & Insert
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            // If duplicate exists (rare with timestamp email), just return error
            return res.status(400).json({ error: "Candidate already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("HireHive123", salt);

        const newUser = await pool.query(
            `INSERT INTO users (name, email, password, phone, role, cvfilename) 
             VALUES ($1, $2, $3, $4, 'candidate', $5) RETURNING *`, [name, email, hashedPassword, phone, publicUrl]
        );

        res.json({
            message: statusMessage,
            candidate: newUser.rows[0],
            detectedData: { name, email, phone }
        });

    } catch (err) {
        console.error("❌ Fatal Error:", err);
        // Returns 500 only if Supabase or DB completely fails
        res.status(500).json({ error: `Server Error: ${err.message}` });
    }
});

export default router;