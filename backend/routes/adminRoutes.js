import express from 'express';
import { pool, supabase } from '../db.js';
import dotenv from 'dotenv';
import multer from 'multer'; // Handles file uploads
import bcrypt from 'bcryptjs'; // Hashes passwords
import { createRequire } from 'module';

const require = createRequire(
    import.meta.url);

// --- 🛠️ FIX START: SAFE PDF IMPORT ---
// We import the library as a generic variable first
const pdfLib = require('pdf-parse');

// We safely determine which one is the actual function
// If 'pdfLib' is a function, use it. If not, try 'pdfLib.default' (CommonJS fix)
const pdf = (typeof pdfLib === 'function') ? pdfLib : pdfLib.default;
// --- FIX END ---

dotenv.config();

const router = express.Router();

// Setup Multer (Stores file in memory temporarily)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==========================================
// DASHBOARD STATS & LOGS
// ==========================================

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
        console.error("Stats Error:", err.message);
        res.status(500).json({ error: 'Server Error loading stats' });
    }
});

router.get('/revenue-chart', async(req, res) => {
    try {
        const result = await pool.query(`
            SELECT TO_CHAR(created_at, 'Mon') as name, SUM(amount) as revenue 
            FROM payments 
            WHERE status = 'success' 
            GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Graph Error:", err.message);
        res.status(500).json({ error: 'Server Error loading graph' });
    }
});

router.get('/logs', async(req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.name, l.action, l.created_at 
            FROM system_logs l
            JOIN users u ON l.admin_id = u.id
            ORDER BY l.created_at DESC
            LIMIT 5
        `);
        res.json(result.rows);
    } catch (err) {
        // Return empty array if logs table is missing so app doesn't crash
        res.json([]);
    }
});

// ==========================================
// AI CV UPLOAD & ONBOARDING ROUTE
// ==========================================

router.post('/upload-cv', upload.single('cv'), async(req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // A. Upload PDF to Supabase Storage (Using shared supabase client)
        const fileName = `${Date.now()}_${req.file.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('resumes')
            .upload(fileName, req.file.buffer, {
                contentType: 'application/pdf'
            });

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // B. Extract Text from PDF (AI/Parsing)
        // Now using the "safe" pdf function we defined at the top
        const pdfData = await pdf(req.file.buffer);
        const text = pdfData.text;

        // C. Auto-Detect Info using Regex
        const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        const email = emailMatch ? emailMatch[0] : null;

        const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : null;

        // Simple name detection (first non-empty line)
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const name = lines[0] || "Unknown Candidate";

        if (!email) {
            return res.status(400).json({ error: "Could not detect an email. Please check the PDF." });
        }

        // D. Create User in Database
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: "Candidate with this email already exists!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("HireHive123", salt);

        // Insert into DB using 'cvfilename' column
        const newUser = await pool.query(
            `INSERT INTO users (name, email, password, phone, role, cvfilename) 
             VALUES ($1, $2, $3, $4, 'candidate', $5) RETURNING *`, [name, email, hashedPassword, phone, publicUrl]
        );

        res.json({
            message: "Candidate Onboarded Successfully!",
            candidate: newUser.rows[0],
            detectedData: { name, email, phone }
        });

    } catch (err) {
        console.error("CV Upload Error:", err);
        res.status(500).json({ error: err.message || "Server Error" });
    }
});

export default router;