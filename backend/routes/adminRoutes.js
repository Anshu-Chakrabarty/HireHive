import express from 'express';
import { pool, supabase } from '../db.js';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';

dotenv.config();

const router = express.Router();

// Setup Multer (Stores file in memory temporarily)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==========================================
// 🛠️ UNIVERSAL PDF PARSER (The Fix)
// ==========================================
const require = createRequire(
    import.meta.url);
let pdfLib;

try {
    // Force load the library
    pdfLib = require('pdf-parse');
} catch (e) {
    console.error("CRITICAL ERROR: Could not require 'pdf-parse'. Is it installed?");
}

// Wrapper function to handle "Default Export" vs "Named Export" confusion
const parsePDF = async(buffer) => {
    // 1. Try using it directly (Standard CommonJS)
    if (typeof pdfLib === 'function') {
        return pdfLib(buffer);
    }
    // 2. Try using .default (ES Module Compat)
    if (pdfLib && typeof pdfLib.default === 'function') {
        return pdfLib.default(buffer);
    }
    // 3. Fail gracefully with debug info
    console.error("PDF Library State:", pdfLib);
    throw new Error("pdf-parse library loaded but is not a function. Check logs.");
};
// ==========================================


// --- STATS ---
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

// --- REVENUE CHART ---
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

// --- LOGS ---
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
        res.json([]);
    }
});

// ==========================================
// AI CV UPLOAD ROUTE
// ==========================================

router.post('/upload-cv', upload.single('cv'), async(req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        console.log("📂 Received File:", req.file.originalname, "Size:", req.file.size);

        // A. Upload PDF to Supabase
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

        // B. Parse PDF (Using our new Safe Wrapper)
        console.log("🔍 Attempting to parse PDF...");
        const pdfData = await parsePDF(req.file.buffer);
        console.log("✅ PDF Parsed successfully! Length:", pdfData.text.length);

        const text = pdfData.text;

        // C. Extract Info
        const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        const email = emailMatch ? emailMatch[0] : null;

        const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : null;

        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const name = lines[0] || "Unknown Candidate";

        if (!email) {
            return res.status(400).json({ error: "Could not detect an email. Is the PDF readable?" });
        }

        // D. Save to Database
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: "Candidate with this email already exists!" });
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
        console.error("❌ CV Processing Error:", err);
        // This will send the EXACT error to your frontend now
        res.status(500).json({ error: `Server Error: ${err.message}` });
    }
});

export default router;