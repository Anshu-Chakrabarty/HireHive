import express from 'express';
import { pool, supabase } from '../db.js';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import PDFParser from 'pdf2json';

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==========================================
// 🛠️ PDF PARSER WRAPPER
// ==========================================
const parsePDF = (buffer) => {
    return new Promise((resolve, reject) => {
        const parser = new PDFParser(this, 1); // 1 = Text Content Only
        parser.on("pdfParser_dataError", (errData) => reject(errData.parserError));
        parser.on("pdfParser_dataReady", (pdfData) => resolve(parser.getRawTextContent()));
        parser.parseBuffer(buffer);
    });
};

// ==========================================
// ROUTES
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
// ✅ SMART AUTO-FILL ROUTE
// ==========================================

router.post('/upload-cv', upload.single('cv'), async(req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // 1. Upload to Supabase
        const fileName = `${Date.now()}_${req.file.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('resumes')
            .upload(fileName, req.file.buffer, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // 2. Extract Text
        let text = "";
        try {
            text = await parsePDF(req.file.buffer);
        } catch (parseErr) {
            console.warn("⚠️ PDF Parse Failed:", parseErr);
        }

        // 3. Smart Data Extraction
        let name = "Unknown Candidate";
        let email = null;
        let phone = null;

        if (text) {
            const cleanText = decodeURIComponent(text); // Fix %20 spaces

            // A. Extract Email (Regex Pattern) - THIS WILL STILL WORK
            const emailMatch = cleanText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            email = emailMatch ? emailMatch[0] : null;

            // B. Extract Phone (Regex Pattern) - THIS WILL STILL WORK
            const phoneMatch = cleanText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            phone = phoneMatch ? phoneMatch[0] : null;

            // C. Extract Name (Line Logic) - THIS IS THE FIXED PART
            // List of header words to IGNORE
            const ignoreList = [
                "resume", "cv", "curriculum", "vitae",
                "contact", "details", "info", "information",
                "email", "phone", "mobile", "address", "location",
                "summary", "profile", "objective", "experience", "education",
                "skills", "projects", "languages", "hobbies"
            ];

            const lines = cleanText.split(/\r\n|\n|\r/);

            for (let line of lines) {
                line = line.trim();
                const lowerLine = line.toLowerCase();

                // Check: Is this line a valid name?
                const hasNumbers = /\d/.test(line); // Does it have numbers?
                const isIgnored = ignoreList.some(word => lowerLine.includes(word)); // Is it a header?

                if (line.length > 2 && !line.includes('@') && !hasNumbers && !isIgnored) {
                    // One final check: Is it too long to be a name? (Max 30 chars)
                    if (line.length < 30) {
                        name = line; // Found "Rohit Tiwari"
                        break; // Stop looking!
                    }
                }
            }
        }

        // 4. Fallback Logic
        if (!email) {
            email = `pending_${Date.now()}@hirehive.temp`;
            name = "Manual Entry Required";
        }

        // 5. DB Insert
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: "Candidate already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("HireHive123", salt);

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
        console.error("❌ Fatal Error:", err);
        res.status(500).json({ error: `Server Error: ${err.message}` });
    }
});

export default router;