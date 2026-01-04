import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// 1. GET ALL CANDIDATES (For the Grid View)
router.get('/candidates', async (req, res) => {
    try {
        // We only fetch essential info for the card to keep it fast
        const result = await pool.query(
            `SELECT id, name, email, phone, bio, cvfilename 
             FROM users 
             WHERE role = 'candidate' 
             ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch Candidates Error:", err);
        res.status(500).json({ error: "Server error fetching candidates" });
    }
});

// 2. GET SINGLE CANDIDATE (For the Full Profile Modal)
router.get('/candidate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM users WHERE id = $1 AND role = 'candidate'`, 
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