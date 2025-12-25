import express from 'express';
import pg from 'pg'; // Use standard pg import
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- 1. OVERVIEW STATS (For the Home Panel) ---
router.get('/stats', async(req, res) => {
    try {
        // We run these 4 queries at the same time for speed

        // 1. Count Employers
        const employersQuery = pool.query("SELECT COUNT(*) FROM users WHERE role = 'employer'");

        // 2. Count Candidates
        const candidatesQuery = pool.query("SELECT COUNT(*) FROM users WHERE role = 'candidate'");

        // 3. Count Jobs (Assuming table name is 'jobs')
        const jobsQuery = pool.query("SELECT COUNT(*) FROM jobs");

        // 4. Calculate Total Revenue from 'payments' table
        // We sum the 'amount' column. COALESCE(..., 0) ensures we return 0 if table is empty.
        const revenueQuery = pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'success'");

        const [employers, candidates, jobs, revenue] = await Promise.all([
            employersQuery,
            candidatesQuery,
            jobsQuery,
            revenueQuery
        ]);

        res.json({
            totalClients: parseInt(employers.rows[0].count),
            totalCandidates: parseInt(candidates.rows[0].count),
            activeJobs: parseInt(jobs.rows[0].count),
            totalRevenue: parseFloat(revenue.rows[0].total) // This comes from 'payments', not 'revenue' table
        });
    } catch (err) {
        console.error("Stats Error:", err.message);
        res.status(500).json({ error: 'Server Error loading stats' });
    }
});

// --- 2. REVENUE GRAPH DATA (Monthly) ---
router.get('/revenue-chart', async(req, res) => {
    try {
        // This groups your 'payments' by month so the graph can draw a line
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

// --- 3. RECENT ACTIVITY LOGS ---
router.get('/logs', async(req, res) => {
    try {
        // Joins 'system_logs' with 'users' to show WHO did the action
        const result = await pool.query(`
            SELECT u.name, l.action, l.created_at 
            FROM system_logs l
            JOIN users u ON l.admin_id = u.id
            ORDER BY l.created_at DESC
            LIMIT 5
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Logs Error:", err.message);
        // Return empty array if logs table is missing/empty so app doesn't crash
        res.json([]);
    }
});

export default router;