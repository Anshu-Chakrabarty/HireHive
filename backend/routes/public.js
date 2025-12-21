import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

// GET /api/public/jobs - Fetch latest 6 jobs for the homepage
router.get('/jobs', async(req, res) => {
    try {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select(`
                id, title, category, location, salary, experience, posteddate,
                employer:employerid (name)
            `)
            .order('posteddate', { ascending: false })
            .limit(6); // Limit to 6 recent jobs

        if (error) throw error;
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;