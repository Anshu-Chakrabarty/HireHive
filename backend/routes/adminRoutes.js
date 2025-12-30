import express from 'express';
import { pool, supabase } from '../db.js';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import PDFParser from 'pdf2json'; // <--- NEW LIBRARY

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==========================================
// 🛠️ NEW PDF PARSER (Using pdf2json)
// ==========================================
const parsePDF = (buffer) => {
    return new Promise((resolve, reject) => {
        const parser = new PDFParser(this, 1); // 1 = Text Content Only

        parser.on("pdfParser_dataError", (errData) => {
            console.error("PDF2JSON Error:", errData.parserError);
            reject(errData.parserError);
        });

        parser.on("pdfParser_dataReady", (pdfData) => {
            // Extract raw text content
            const text = parser.getRawTextContent();
            resolve(text);
        });

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
// ✅ UPLOAD CV & AUTO-FILL ROUTE
// ==========================================

router.post('/upload-cv', upload.single('cv'), async(req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        console.log("📂 Processing File:", req.file.originalname);

        // 1. Upload to Supabase
        const fileName = `${Date.now()}_${req.file.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('resumes')
            .upload(fileName, req.file.buffer, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // 2. Extract Text using NEW Library
        let text = "";
        try {
            text = await parsePDF(req.file.buffer);
            console.log("✅ Text Extracted (Length):", text.length);
        } catch (parseErr) {
            console.warn("⚠️ PDF Parse Failed:", parseErr);
        }

        // 3. Smart Data Extraction (Regex)
        let name = "Unknown Candidate";
        let email = null;
        let phone = null;

        if (text) {
            // Clean up the text (remove URL encodings often left by pdf2json)
            const cleanText = decodeURIComponent(text);

            // Extract Email
            const emailMatch = cleanText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            email = emailMatch ? emailMatch[0] : null;

            // Extract Phone
            const phoneMatch = cleanText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            phone = phoneMatch ? phoneMatch[0] : null;

            // Extract Name (Heuristic: First valid line of text)
            // We split by newlines, trim, and ignore lines that look like emails or junk
            const lines = cleanText.split(/\r\n|\n|\r/);
            for (let line of lines) {
                line = line.trim();
                if (line.length > 2 && !line.includes('@') && !line.match(/resume|cv|curriculum/i)) {
                    name = line; // Assume first good line is the name
                    break;
                }
            }
        }

        // 4. Fallback if AI fails
        let message = "Candidate Onboarded Successfully!";
        if (!email) {
            email = `pending_${Date.now()}@hirehive.temp`;
            message = "File Uploaded! (Could not auto-read email - please edit manually)";
            name = "Manual Entry Required";
        }

        // 5. Create User
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
            message: message,
            candidate: newUser.rows[0],
            detectedData: { name, email, phone } // Send back to frontend
        });

    } catch (err) {
        console.error("❌ Fatal Error:", err);
        res.status(500).json({ error: `Server Error: ${err.message}` });
    }
});

export default router;