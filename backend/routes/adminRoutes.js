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
// 🧠 SKILL DICTIONARY
// ==========================================
const SKILL_KEYWORDS = [
    "javascript", "python", "java", "c++", "c#", "ruby", "php", "swift", "go", "rust",
    "html", "css", "react", "angular", "vue", "node.js", "express", "django", "flask",
    "sql", "mysql", "postgresql", "mongodb", "firebase", "redis", "aws", "azure", "docker", "kubernetes",
    "git", "linux", "machine learning", "ai", "pandas", "numpy",
    "seo", "sem", "content marketing", "social media", "email marketing", "google analytics",
    "sales", "b2b", "b2c", "lead generation", "cold calling", "crm", "salesforce", "hubspot",
    "negotiation", "account management", "business development", "branding",
    "project management", "agile", "scrum", "leadership", "teamwork", "communication",
    "time management", "problem solving", "human resources", "recruitment", "excel", "financial analysis"
];

// ==========================================
// 🛠️ HELPERS
// ==========================================
const safeDecode = (text) => {
    try { return decodeURIComponent(text); } catch (e) { return text; }
};

const extractDataFromText = (text) => {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const lowerText = cleanText.toLowerCase();

    // Email
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = cleanText.match(emailRegex);
    const email = emailMatch ? emailMatch[0].toLowerCase() : null;

    // Phone
    let phone = null;
    const phoneIntl = /(\+|00)(\d{1,3})[-.\s]?\d{3,}[-.\s]?\d{3,}/;
    const phoneStd = /\b[6-9]\d{9}\b/;
    if (cleanText.match(phoneIntl)) phone = cleanText.match(phoneIntl)[0];
    else if (cleanText.match(phoneStd)) phone = cleanText.match(phoneStd)[0];

    // Skills
    const foundSkills = new Set();
    SKILL_KEYWORDS.forEach(skill => {
        const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (skill.includes('+') || skill.includes('#')) {
            if (lowerText.includes(skill)) foundSkills.add(skill);
        } else {
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            if (regex.test(cleanText)) foundSkills.add(skill);
        }
    });

    return { email, phone, skills: Array.from(foundSkills) };
};

const parsePDF = (buffer) => {
    return new Promise((resolve, reject) => {
        const parser = new PDFParser(this, 1);
        parser.on("pdfParser_dataError", (errData) => reject(errData.parserError));
        parser.on("pdfParser_dataReady", (pdfData) => resolve(parser.getRawTextContent()));
        parser.parseBuffer(buffer);
    });
};

// ==========================================
// 📊 DASHBOARD ROUTES (Stats, Charts, Logs)
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
// 👇 NEW ROUTES ADDED HERE (Users & Jobs)
// ==========================================

// 1. GET USERS (Filtered by Role)
router.get('/users', async (req, res) => {
    try {
        const { role } = req.query; // Expecting 'employer' or 'seeker'

        let query = '';
        
        if (role === 'employer') {
            // Join with company_profiles to get Company Name
            query = `
                SELECT u.id, u.name, u.email, u.created_at, u.subscriptionstatus, cp.company_name 
                FROM users u
                LEFT JOIN company_profiles cp ON u.id = cp.user_id
                WHERE u.role = 'employer'
                ORDER BY u.created_at DESC
            `;
        } else if (role === 'seeker') {
            // Note: DB stores them as 'candidate', but frontend sends 'seeker'
            query = `
                SELECT id, name, email, created_at, phone 
                FROM users 
                WHERE role = 'candidate' OR role = 'seeker'
                ORDER BY created_at DESC
            `;
        } else {
            // Fallback: Get all users
            query = `SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC`;
        }

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// 2. GET JOBS (For 'Active Jobs' card details)
router.get('/jobs', async (req, res) => {
    try {
        const query = `
            SELECT 
                j.id, 
                j.title, 
                j.posteddate, 
                cp.company_name
            FROM jobs j
            LEFT JOIN company_profiles cp ON j.employer_id = cp.user_id
            ORDER BY j.posteddate DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).json({ error: "Failed to fetch jobs" });
    }
});

// ==========================================
// ✅ CV UPLOAD (Existing Route)
// ==========================================
router.post('/upload-cv', upload.single('cv'), async(req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Supabase Upload
        const fileName = `${Date.now()}_${req.file.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase
            .storage.from('resumes')
            .upload(fileName, req.file.buffer, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // Parse Name
        let name = req.file.originalname.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').trim();
        name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        // Extract Info
        let email = null;
        let phone = null;
        let skills = [];

        try {
            const rawText = await parsePDF(req.file.buffer);
            if (rawText) {
                const decodedText = safeDecode(rawText); 
                const info1 = extractDataFromText(decodedText);
                const info2 = extractDataFromText(rawText);
                email = info1.email || info2.email;
                phone = info1.phone || info2.phone;
                skills = Array.from(new Set([...info1.skills, ...info2.skills]));
            }
        } catch (parseErr) {
            console.warn("⚠️ PDF Parse Failed:", parseErr.message);
        }

        if (!email) {
            const filenameEmail = name.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            if (filenameEmail) email = filenameEmail[0];
            else {
                email = `pending_${Date.now()}@hirehive.temp`;
                if (name.length < 3) name += " (Review Required)";
            }
        }

        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "Candidate already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("HireHive123", salt);

        const newUser = await pool.query(
            `INSERT INTO users (name, email, password, phone, role, cvfilename, skills) 
             VALUES ($1, $2, $3, $4, 'candidate', $5, $6) RETURNING *`, 
            [name, email, hashedPassword, phone, publicUrl, skills]
        );

        res.json({
            message: "Candidate Onboarded Successfully!",
            candidate: newUser.rows[0],
            detectedData: { name, email, phone, skills }
        });

    } catch (err) {
        console.error("❌ Fatal Error:", err);
        res.status(500).json({ error: `Server Error: ${err.message}` });
    }
});

export default router;