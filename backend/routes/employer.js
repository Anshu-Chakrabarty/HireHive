// --- Backend: routes/employer.js (REPLACE ENTIRE FILE) ---
import express from 'express';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// --- Subscription Plan Limits (Mirroring Frontend) ---
const HIVE_PLANS = {
    'buzz': { limit: 2 },
    'worker': { limit: 5 },
    'colony': { limit: 15 },
    'queen': { limit: 30 },
    'hive_master': { limit: Infinity },
};


// ------------------------------------------------------------------
// 1. MIDDLEWARE
// ------------------------------------------------------------------

// General Authentication Middleware
const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
        req.user = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Employer/Admin Role Check Middleware
const checkRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Insufficient privileges.' });
    }
    next();
};

const isEmployer = checkRole(['employer', 'admin']);


// ------------------------------------------------------------------
// 2. EMPLOYER JOB MANAGEMENT (/api/employer/jobs)
// ------------------------------------------------------------------

// POST: Create a new job (Subscription Enforcement - HARDENED SYNTAX)
router.post('/jobs', auth, isEmployer, async(req, res) => {
    const { title, category, location, experience, salary, ctc, requiredSkills, description, noticePeriod, screeningQuestions } = req.body;
    const employerId = req.user.id;

    // 1. Subscription Check and Enforcement
    const { data: user, error: userError } = await supabase
        .from('users')
        // Select ALL LOWERCASE column names for enforcement
        .select('subscriptionstatus, jobpostcount')
        .eq('id', employerId)
        .single();

    if (userError || !user) return res.status(500).json({ error: 'Failed to retrieve user subscription status.' });

    const currentPlanKey = user.subscriptionstatus || 'buzz';

    // FIX for SyntaxError: Using standard conditional block 
    let planLimit = 0;
    const plan = HIVE_PLANS[currentPlanKey];
    if (plan && plan.limit !== undefined) {
        planLimit = plan.limit;
    }

    const isUnlimited = planLimit === Infinity;

    // FIX: Use ALL LOWERCASE column name for checking count
    if (!isUnlimited && user.jobpostcount >= planLimit) {
        return res.status(403).json({
            error: `Job posting limit (${planLimit}) reached for your current plan (${currentPlanKey}). Please upgrade.`
        });
    }

    // 2. Insert Job Data
    const jobData = {
        employerid: employerId,
        title,
        category,
        location,
        experience,
        salary,
        ctc,
        requiredSkills,
        description,
        noticePeriod,
        screeningQuestions,
        // The DB handles the 'postedDate' column, so we don't send it here (it's DEFAULT now() in SQL)
    };

    const { data: job, error: jobInsertError } = await supabase
        .from('jobs')
        .insert([jobData])
        .select()
        .single();

    if (jobInsertError) return res.status(400).json({ error: jobInsertError.message });

    // 3. Update Job Count for Basic Plans
    if (!isUnlimited) {
        const { error: updateError } = await supabase
            .from('users')
            .update({ jobpostcount: user.jobpostcount + 1 })
            .eq('id', employerId);

        if (updateError) {
            console.error("Failed to update job post count:", updateError);
        }
    }

    res.json({ message: 'Job posted successfully', job: job });
});

// GET: Retrieve all jobs posted by the current employer
router.get('/jobs', auth, isEmployer, async(req, res) => {
    const employerId = req.user.id;

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
            *, 
            applications(count)
        `)
        // FIX: Must query using the lowercase DB column name 'employerid'
        .eq('employerid', employerId)
        // FIX: Must order by the lowercase DB column name 'posteddate'
        .order('posteddate', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(jobs);
});

// PUT: Update an existing job
router.put('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    const { jobId } = req.params;
    const employerId = req.user.id;
    const updateData = req.body;

    const { data, error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId)
        // FIX: Must query using the lowercase DB column name 'employerid'
        .eq('employerid', employerId)
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Job not found or access denied.' });

    res.json({ message: 'Job updated successfully', job: data });
});

// DELETE: Delete a job
router.delete('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    const { jobId } = req.params;
    const employerId = req.user.id;

    // 1. Delete related applications first
    await supabase.from('applications').delete().eq('jobId', jobId);

    // 2. Delete the job
    const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        // FIX: Must query using the lowercase DB column name 'employerid'
        .eq('employerid', employerId);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Job deleted successfully and applications removed.' });
});


// ------------------------------------------------------------------
// 3. APPLICANTS & SEEKER DATA (/api/employer/applicants, /api/employer/seekers)
// ------------------------------------------------------------------

// GET: Retrieve all applicants for a specific job
router.get('/applicants/:jobId', auth, isEmployer, async(req, res) => {
    const { jobId } = req.params;
    const employerId = req.user.id;

    // 1. Verify the job belongs to the current employer
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        // FIX: Select using lowercase column name 'employerid'
        .select('id, employerid, screeningQuestions, title')
        .eq('id', jobId)
        // FIX: Query using lowercase column name 'employerid'
        .eq('employerid', employerId)
        .single();

    if (jobError || !job) return res.status(403).json({ error: 'Access denied to job applicants.' });

    // 2. Fetch all applications for that job, joining seeker data
    const { data: applications, error } = await supabase
        .from('applications')
        .select(`
            answers,
            seekers:seekerId (name, email, phone, skills, education, cvfilename) 
        `)
        .eq('jobId', jobId);

    if (error) return res.status(400).json({ error: error.message });

    // Format the data to be easier for the frontend to consume
    const formattedApplicants = applications.map(app => ({
        ...app.seekers,
        applicationAnswers: app.answers,
    }));

    res.json({
        jobTitle: job.title,
        screeningQuestions: job.screeningQuestions,
        applicants: formattedApplicants
    });
});

// GET: Retrieve the list of all seekers (Talent Pool view)
router.get('/seekers', auth, isEmployer, async(req, res) => {

    const { data: seekers, error } = await supabase
        .from('users')
        .select('id, name, email, phone, skills, education, cvfilename')
        .eq('role', 'seeker')
        .order('name', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    res.json(seekers);
});

export default router;