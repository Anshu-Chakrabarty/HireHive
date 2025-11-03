import express from 'express';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken'; // Keep jwt for local auth functions

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
// 1. MIDDLEWARE (Local definitions to avoid ERR_MODULE_NOT_FOUND)
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
router.post('/jobs', auth, isEmployer, async(req, res) => { // Using local 'auth'
    const { title, category, location, experience, salary, ctc, requiredSkills, description, noticePeriod, screeningQuestions } = req.body;
    const employerId = req.user.id;

    // 1. Subscription Check and Enforcement
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('jobpostcount, subscriptionstatus')
        .eq('id', employerId)
        .single();

    if (userError || !user) return res.status(500).json({ error: 'Failed to retrieve user subscription status.' });

    const currentPlanKey = user.subscriptionstatus || 'buzz';

    let planLimit = 0;
    const plan = HIVE_PLANS[currentPlanKey];
    if (plan && plan.limit !== undefined) {
        planLimit = plan.limit;
    }

    const isUnlimited = planLimit === Infinity;

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
    let updatedUser;
    if (!isUnlimited) {
        const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({ jobpostcount: user.jobpostcount + 1 })
            .eq('id', employerId)
            .select()
            .single();

        if (updateError) {
            console.error("Failed to update job post count:", updateError);
        }
        updatedUser = updateData;
    }

    const { password: userPassword, ...userData } = updatedUser || {};

    res.json({ message: 'Job posted successfully', job: job, user: userData });
});

// GET: Retrieve all jobs posted by the current employer
router.get('/jobs', auth, isEmployer, async(req, res) => { // Using local 'auth'
    const employerId = req.user.id;

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
            *, 
            applications(count)
        `)
        .eq('employerid', employerId)
        .order('posteddate', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(jobs);
});

// PUT: Update an existing job
router.put('/jobs/:jobId', auth, isEmployer, async(req, res) => { // Using local 'auth'
    const { jobId } = req.params;
    const employerId = req.user.id;
    const updateData = req.body;

    const mappedUpdateData = {};
    for (const key in updateData) {
        if (key === 'requiredSkills') mappedUpdateData['required_skills'] = updateData[key];
        else if (key === 'noticePeriod') mappedUpdateData['notice_period'] = updateData[key];
        else if (key === 'screeningQuestions') mappedUpdateData['screening_questions'] = updateData[key];
        else mappedUpdateData[key] = updateData[key];
    }


    const { data, error } = await supabase
        .from('jobs')
        .update(mappedUpdateData)
        .eq('id', jobId)
        .eq('employerid', employerId)
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Job not found or access denied.' });

    res.json({ message: 'Job updated successfully', job: data });
});

// DELETE: Delete a job (CRITICAL: Decrement Job Count)
router.delete('/jobs/:jobId', auth, isEmployer, async(req, res) => { // Using local 'auth'
    const { jobId } = req.params;
    const employerId = req.user.id;

    // 1. Get current user's job count (needed for decrement)
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('jobpostcount, subscriptionstatus')
        .eq('id', employerId)
        .single();

    if (userError || !user) {
        console.error("Failed to retrieve user count for decrement:", userError);
        return res.status(500).json({ error: 'Failed to delete job due to user data issue.' });
    }

    const currentPlanKey = user.subscriptionstatus || 'buzz';
    const plan = HIVE_PLANS[currentPlanKey];
    const isUnlimited = plan && plan.limit === Infinity;

    // 2. Delete related applications first
    await supabase.from('applications').delete().eq('jobid', jobId);

    // 3. Delete the job
    const { error: jobDeleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('employerid', employerId);

    if (jobDeleteError) return res.status(400).json({ error: jobDeleteError.message });

    // 4. Update Job Count for Basic Plans (only if job was actually deleted and count > 0)
    if (!isUnlimited && user.jobpostcount > 0) {
        const newCount = user.jobpostcount - 1;
        const { error: updateError } = await supabase
            .from('users')
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
router.get('/applicants/:jobId', auth, isEmployer, async(req, res) => { // Using local 'auth'
    const { jobId } = req.params;
    const employerId = req.user.id;

    // 1. Verify the job belongs to the current employer
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id, employerid, screening_questions, title')
        .eq('employerid', employerId)
        .eq('id', jobId)
        .single();

    if (jobError || !job) return res.status(403).json({ error: 'Access denied to job applicants.' });

    // 2. Fetch all applications for that job, joining seeker data
    const { data: applications, error } = await supabase
        .from('applications')
        .select(`
            answers,
            seekers:seekerid (name, email, phone, skills, education, cvfilename) 
        `)
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
router.get('/seekers', auth, isEmployer, async(req, res) => { // Using local 'auth'

    const { data: seekers, error } = await supabase
        .from('users')
        .select('id, name, email, phone, skills, education, cvfilename')
        .eq('role', 'seeker')
        .order('name', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    res.json(seekers);
});

// ------------------------------------------------------------------
// 4. SUBSCRIPTION MANAGEMENT (/api/employer/subscription)
// ------------------------------------------------------------------

// PUT: Update the employer's subscription status (e.g., free plan selection)
router.put('/subscription', auth, isEmployer, async(req, res) => { // Using local 'auth'
    const { newPlanKey } = req.body;
    const employerId = req.user.id;

    if (!HIVE_PLANS[newPlanKey]) {
        return res.status(400).json({ error: "Invalid subscription plan provided." });
    }

    const updateData = {
        subscriptionstatus: newPlanKey,
        jobpostcount: 0,
        subscription_jsonb: { active: true, plan: newPlanKey }
    };

    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', employerId)
        .select()
        .single();

    if (updateError) {
        console.error("Supabase subscription update error:", updateError);
        return res.status(500).json({ error: 'Failed to update subscription status.' });
    }

    const { password: userPassword, ...userData } = updatedUser;

    res.json({
        message: `Subscription plan updated to ${newPlanKey}.`,
        user: userData
    });
});