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

// POST: Create a new job (Subscription Enforcement)
router.post('/jobs', auth, isEmployer, async(req, res) => {
    const { title, category, location, experience, salary, ctc, requiredSkills, description, noticePeriod, screeningQuestions } = req.body;
    const employerId = req.user.id;

    // 1. Subscription Check and Enforcement
    const { data: user, error: userError } = await supabase
        .from('users')
        // REVERTED to match SQL schema: all-lowercase column names
        .select('subscriptionstatus, jobpostcount')
        .eq('id', employerId)
        .single();

    if (userError || !user) return res.status(500).json({ error: 'Failed to retrieve user subscription status.' });

    // REVERTED to match SQL schema: all-lowercase
    const currentPlanKey = user.subscriptionstatus || 'buzz';

    let planLimit = 0;
    const plan = HIVE_PLANS[currentPlanKey];
    if (plan && plan.limit !== undefined) {
        planLimit = plan.limit;
    }

    const isUnlimited = planLimit === Infinity;

    // REVERTED to match SQL schema: all-lowercase column name for checking count
    if (!isUnlimited && user.jobpostcount >= planLimit) {
        return res.status(403).json({
            error: `Job posting limit (${planLimit}) reached for your current plan (${currentPlanKey}). Please upgrade.`
        });
    }

    // 2. Insert Job Data
    const jobData = {
        // REVERTED to match SQL schema: all-lowercase foreign key
        employerid: employerId,
        title,
        category,
        location,
        experience,
        salary,
        ctc,
        // Using snake_case for job fields as defined in SQL
        required_skills: requiredSkills,
        description,
        notice_period: noticePeriod,
        screening_questions: screeningQuestions,
    };

    const { data: job, error: jobInsertError } = await supabase
        .from('jobs')
        .insert([jobData])
        .select()
        .single();

    if (jobInsertError) return res.status(400).json({ error: jobInsertError.message });

    // 3. Update Job Count for Basic Plans
    if (!isUnlimited) {
        // REVERTED to match SQL schema: all-lowercase column name for updating
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
        // REVERTED to match SQL schema: all-lowercase foreign key
        .eq('employerid', employerId)
        // REVERTED to match SQL schema: all-lowercase column name
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
        // REVERTED to match SQL schema: all-lowercase foreign key
        .eq('employerid', employerId)
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Job not found or access denied.' });

    res.json({ message: 'Job updated successfully', job: data });
});

// DELETE: Delete a job (CRITICAL: Decrement Job Count)
router.delete('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    const { jobId } = req.params;
    const employerId = req.user.id;

    // 1. Get current user's job count (needed for decrement)
    const { data: user, error: userError } = await supabase
        .from('users')
        // REVERTED to match SQL schema: all-lowercase column names
        .select('jobpostcount, subscriptionstatus')
        .eq('id', employerId)
        .single();

    if (userError || !user) {
        console.error("Failed to retrieve user count for decrement:", userError);
        return res.status(500).json({ error: 'Failed to delete job due to user data issue.' });
    }

    // REVERTED to match SQL schema: all-lowercase
    const currentPlanKey = user.subscriptionstatus || 'buzz';
    const plan = HIVE_PLANS[currentPlanKey];
    const isUnlimited = plan && plan.limit === Infinity;

    // 2. Delete related applications first (REVERTED to match SQL schema: all-lowercase foreign key)
    await supabase.from('applications').delete().eq('jobid', jobId);

    // 3. Delete the job
    const { error: jobDeleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        // REVERTED to match SQL schema: all-lowercase foreign key
        .eq('employerid', employerId);

    if (jobDeleteError) return res.status(400).json({ error: jobDeleteError.message });

    // 4. Update Job Count for Basic Plans (only if job was actually deleted and count > 0)
    // REVERTED to match SQL schema: all-lowercase
    if (!isUnlimited && user.jobpostcount > 0) {
        const newCount = user.jobpostcount - 1;
        const { error: updateError } = await supabase
            .from('users')
            // REVERTED to match SQL schema: all-lowercase column name for updating
            .update({ jobpostcount: newCount })
            .eq('id', employerId);

        if (updateError) {
            console.error("Failed to decrement job post count:", updateError);
        }
    }

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
        .select('id, employerid, screening_questions, title')
        .eq('id', jobId)
        // REVERTED to match SQL schema: all-lowercase foreign key
        .eq('employerid', employerId)
        .single();

    if (jobError || !job) return res.status(403).json({ error: 'Access denied to job applicants.' });

    // 2. Fetch all applications for that job, joining seeker data
    const { data: applications, error } = await supabase
        .from('applications')
        .select(`
            answers,
            // REVERTED to match SQL schema: all-lowercase foreign keys
            seekers:seekerid (name, email, phone, skills, education, cvfilename) 
        `)
        // REVERTED to match SQL schema: all-lowercase foreign key
        .eq('jobid', jobId);

    if (error) return res.status(400).json({ error: error.message });

    // Format the data to be easier for the frontend to consume
    const formattedApplicants = applications.map(app => ({
        ...app.seekers,
        applicationAnswers: app.answers,
    }));

    res.json({
        jobTitle: job.title,
        screeningQuestions: job.screening_questions,
        applicants: formattedApplicants
    });
});

// GET: Retrieve the list of all seekers (Talent Pool view)
router.get('/seekers', auth, isEmployer, async(req, res) => {

    const { data: seekers, error } = await supabase
        .from('users')
        // REVERTED to match SQL schema: all-lowercase column names
        .select('id, name, email, phone, skills, education, cvfilename')
        .eq('role', 'seeker')
        .order('name', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    res.json(seekers);
});

export default router;