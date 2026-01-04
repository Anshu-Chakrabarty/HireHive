import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// 1. GET ALL CANDIDATES (For the Grid View)
router.get('/candidates', async (req, res) => {
    try {
        // FIX: Now fetches 'seeker' OR 'candidate' so everyone appears
        const result = await pool.query(
            `SELECT id, name, email, phone, cvfilename 
             FROM users 
             WHERE role IN ('candidate', 'seeker') 
             ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch Candidates Error:", err);
        res.status(500).json({ error: "Server error fetching candidates: " + err.message });
    }
});

// 2. GET SINGLE CANDIDATE (For the Full Profile Modal)
router.get('/candidate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM users 
             WHERE id = $1 AND role IN ('candidate', 'seeker')`, 
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Fetch Profile Error:", err);
        res.status(500).json({ error: "Server error fetching profile" });
    }
});

export default router;