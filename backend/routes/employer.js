import express from 'express';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';
// import Razorpay from 'razorpay'; // RAZORPAY COMMENTED OUT
// import crypto from 'crypto'; // RAZORPAY COMMENTED OUT

const router = express.Router();

// --- Subscription Plan Limits & Prices (SIMPLIFIED/COMMENTED OUT) ---
const HIVE_PLANS = {
    'buzz': { limit: 2, name: "Buzz Plan" },
    'worker': { limit: 5, name: "Worker Plan" },
    'colony': { limit: 15, name: "Colony Plan" },
    'queen': { limit: 30, name: "Queen Plan" },
    'hive_master': { limit: Infinity, name: "Hive Master Plan" },
};

// RAZORPAY COMMENTED OUT
// const razorpay = new Razorpay({
//     key_id: process.env.RAZORPAY_KEY_ID,
//     key_secret: process.env.RAZORPAY_KEY_SECRET,
// });


// ------------------------------------------------------------------
// 1. MIDDLEWARE 
// ------------------------------------------------------------------
const auth = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { id: decoded.id, role: decoded.role };
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        return res.status(401).json({ error: 'Not authorized, no token' });
    }
};

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

// POST: Create a new job
router.post('/jobs', auth, isEmployer, async(req, res) => {
    const { title, category, location, experience, salary, ctc, requiredSkills, description, noticePeriod, screeningQuestions } = req.body;
    const employerId = req.user.id;

    // 1. Check Job Post Limit
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, password, jobpostcount, subscriptionstatus')
        .eq('id', employerId)
        .single();
    if (userError || !user) return res.status(500).json({ error: 'Failed to retrieve user subscription status.' });

    const currentPlanKey = user.subscriptionstatus || 'buzz';
    const plan = HIVE_PLANS[currentPlanKey];

    if (!plan) return res.status(403).json({ error: 'Invalid subscription plan. Please contact support.' });

    const planLimit = plan.limit;
    const isUnlimited = planLimit === Infinity;

    if (!isUnlimited && user.jobpostcount >= planLimit) {
        return res.status(403).json({
            error: `Job posting limit (${planLimit}) reached for your current plan (${plan.name}). Please upgrade.`
        });
    }

    // 2. Insert Job
    const jobData = {
        employerid: employerId,
        title,
        category,
        location,
        experience,
        salary,
        ctc,
        description,
        required_skills: requiredSkills,
        notice_period: noticePeriod,
        screening_questions: screeningQuestions,
    };

    const { data: job, error: jobInsertError } = await supabase
        .from('jobs')
        .insert([jobData])
        .select()
        .single();

    if (jobInsertError) return res.status(400).json({ error: jobInsertError.message });

    // 3. Update Job Count
    let updatedUser = user;
    if (!isUnlimited) {
        const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({ jobpostcount: user.jobpostcount + 1 })
            .eq('id', employerId)
            .select()
            .single();

        if (updateError) {
            console.error("Failed to update job post count:", updateError);
        } else {
            updatedUser = updateData;
        }
    }

    // Final response
    const { password: userPassword, ...userData } = updatedUser;
    res.json({ message: 'Job posted successfully', job: job, user: userData });
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
        .eq('employerid', employerId)
        .order('posteddate', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(jobs);
});

// PUT: Update an existing job
router.put('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    const { jobId } = req.params;
    const employerId = req.user.id;
    const updateData = req.body;

    // Map frontend camelCase to backend snake_case
    const mappedUpdateData = {};
    for (const key in updateData) {
        if (key === 'requiredSkills') mappedUpdateData['required_skills'] = updateData[key];
        else if (key === 'noticePeriod') mappedUpdateData['notice_period'] = updateData[key];
        else if (key === 'screeningQuestions') mappedUpdateData['screening_questions'] = updateData[key];
        else mappedUpdateData[key] = updateData[key];
    }

    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .update(mappedUpdateData)
        .eq('id', jobId)
        .eq('employerid', employerId)
        .select()
        .single();

    if (jobError) return res.status(400).json({ error: jobError.message });
    if (!job) return res.status(404).json({ error: 'Job not found or access denied.' });

    // Fetch user again to return up-to-date user data for re-sync
    const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', employerId).single();
    if (userError) console.error("Failed to retrieve user after job update:", userError);

    const { password, ...userData } = user || {};

    res.json({ message: 'Job updated successfully', job, user: userData });
});

// DELETE: Delete a job
router.delete('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    const { jobId } = req.params;
    const employerId = req.user.id;

    // 1. Get current user data to decrement count
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', employerId)
        .single();

    if (userError || !user) {
        console.error("Failed to retrieve user count for decrement:", userError);
        return res.status(500).json({ error: 'Failed to delete job due to user data issue.' });
    }

    const currentPlanKey = user.subscriptionstatus || 'buzz';
    const plan = HIVE_PLANS[currentPlanKey];
    const isUnlimited = !plan || plan.limit === Infinity;

    // 2. Delete all related applications (Cascading Delete Simulation)
    await supabase.from('applications').delete().eq('jobid', jobId);

    // 3. Delete Job
    const { error: jobDeleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('employerid', employerId);

    if (jobDeleteError) return res.status(400).json({ error: jobDeleteError.message });

    // 4. Decrement Job Count
    let updatedUser = user;
    if (!isUnlimited && user.jobpostcount > 0) {
        const newCount = user.jobpostcount - 1;
        const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({ jobpostcount: newCount })
            .eq('id', employerId)
            .select()
            .single();

        if (updateError) {
            console.error("Failed to decrement job post count:", updateError);
        } else {
            updatedUser = updateData;
        }
    }

    const { password: userPassword, ...userData } = updatedUser;
    res.json({ message: 'Job deleted successfully and applications removed.', user: userData });
});


// ------------------------------------------------------------------
// 3. APPLICANTS & SEEKER DATA
// ------------------------------------------------------------------

// GET: Retrieve all applicants for a specific job
router.get('/applicants/:jobId', auth, isEmployer, async(req, res) => {
    const { jobId } = req.params;
    const employerId = req.user.id;

    // Verify employer owns the job
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id, employerid, screening_questions, title')
        .eq('employerid', employerId)
        .eq('id', jobId)
        .single();

    if (jobError || !job) return res.status(403).json({ error: 'Access denied to job applicants.' });

    // Fetch applications and join with seeker data
    const { data: applications, error } = await supabase
        .from('applications')
        .select(`
            answers,
            status, 
            seekerid,
            seekers:seekerid (name, email, phone, skills, education, cvfilename) 
        `)
        .eq('jobid', jobId);

    if (error) return res.status(400).json({ error: error.message });

    const formattedApplicants = applications.map(app => ({
        ...app.seekers,
        applicationAnswers: app.answers,
        status: app.status,
        seekerid: app.seekerid
    }));

    res.json({
        jobTitle: job.title,
        screeningQuestions: job.screening_questions,
        applicants: formattedApplicants
    });
});

// NEW: Update an applicant's status
router.put('/applicants/status', auth, isEmployer, async(req, res) => {
    const { seekerId, jobId, newStatus } = req.body;
    const employerId = req.user.id;

    if (!seekerId || !jobId || !newStatus) {
        return res.status(400).json({ error: 'Missing required fields: seekerId, jobId, newStatus.' });
    }

    // Security Check: Verify employer owns the job before updating application status
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', jobId)
        .eq('employerid', employerId)
        .single();

    if (jobError || !job) {
        return res.status(403).json({ error: 'Access denied. You do not own this job.' });
    }

    // Update the application status
    const { data, error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('jobid', jobId)
        .eq('seekerid', seekerId)
        .select()
        .single();

    if (error) {
        console.error("Applicant status update error:", error);
        return res.status(500).json({ error: 'Failed to update applicant status.' });
    }

    if (!data) {
        return res.status(404).json({ error: 'Application not found.' });
    }

    res.json({ message: 'Status updated successfully', application: data });
});


// ------------------------------------------------------------------
// 4. SUBSCRIPTION & PAYMENT (RAZORPAY COMMENTED OUT)
// ------------------------------------------------------------------

// PUT: Update the employer's subscription (Used for FREE plan and simulated PAID plans)
router.put('/subscription', auth, isEmployer, async(req, res) => {
    const { newPlanKey } = req.body;
    const employerId = req.user.id;

    // COMMENTED OUT: if (newPlanKey !== 'buzz') { return res.status(400).json({ error: "Paid plans must be activated via payment." }); }

    if (!HIVE_PLANS[newPlanKey]) {
        return res.status(400).json({ error: "Invalid subscription plan provided." });
    }

    // Reset job post count to 0 when switching to a new plan (simulates renewal/upgrade)
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
        message: `Subscription plan updated to ${HIVE_PLANS[newPlanKey].name}.`,
        user: userData
    });
});

// POST: Create Razorpay Order - COMMENTED OUT
// router.post('/payment/create-order', auth, isEmployer, async(req, res) => {
//     return res.status(501).json({ error: "Payment is currently disabled." }); 
// });

// POST: Verify Razorpay Payment - COMMENTED OUT
// router.post('/payment/verify-payment', auth, isEmployer, async(req, res) => {
//     return res.status(501).json({ error: "Payment is currently disabled." });
// });


export default router;