import express from 'express';
import { supabase } from '../db.js';
import { protect as auth } from "./auth.js";
import { sendJobAlertToSeekers } from '../utils/emailService.js';

const router = express.Router();

// --- 1. CONFIGURATION: PLAN LIMITS ---
// These limits MUST match what is defined in paymentRoutes.js
const HIVE_PLANS = {
    'buzz': { limit: 2, name: "Buzz Plan (Free)", price: 0 },
    'worker': { limit: 5, name: "Worker Plan", price: 1999 },
    'colony': { limit: 15, name: "Colony Plan", price: 4999 },
    'queen': { limit: 30, name: "Queen Plan", price: 8999 },
    'hive_master': { limit: 9999, name: "Hive Master Plan", price: 14999 },
};

// Middleware: Strict Employer Check
const isEmployer = (req, res, next) => {
    if (!req.user || req.user.role !== 'employer') {
        return res.status(403).json({ error: 'Access denied. Employer account required.' });
    }
    next();
};

// ------------------------------------------------------------------
// 2. JOB POSTING LOGIC (ENFORCES PAYMENT LIMITS)
// ------------------------------------------------------------------

router.post('/jobs', auth, isEmployer, async(req, res) => {
    try {
        const {
            title, category, location, experience, salary, ctc,
            requiredSkills, description, noticePeriod, screeningQuestions
        } = req.body;

        const employerId = req.user.id;

        // 1. Fetch Current Subscription Status & Company Name
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('jobpostcount, subscriptionstatus, company_name')
            .eq('id', employerId)
            .single();

        if (userError || !user) {
            return res.status(500).json({ error: 'Failed to retrieve subscription status.' });
        }

        // 2. Determine Plan & Limit
        const currentPlanKey = user.subscriptionstatus || 'buzz';
        const plan = HIVE_PLANS[currentPlanKey] || HIVE_PLANS['buzz'];

        // 3. ENFORCE LIMIT
        // If current count is equal to or greater than limit, BLOCK the post
        if ((user.jobpostcount || 0) >= plan.limit) {
            return res.status(403).json({
                error: `⛔ Plan Limit Reached! Your ${plan.name} allows ${plan.limit} jobs. Please upgrade to post more.`
            });
        }

        // 4. Insert Job into DB
        const { data: job, error: jobInsertError } = await supabase
            .from('jobs')
            .insert([{
                employerid: employerId,
                title, category, location, experience, salary, ctc, description,
                required_skills: requiredSkills || [],
                notice_period: noticePeriod,
                screening_questions: screeningQuestions || []
            }])
            .select()
            .single();

        if (jobInsertError) throw jobInsertError;

        // 5. Increment Job Count
        const { error: updateError } = await supabase
            .from('users')
            .update({ jobpostcount: (user.jobpostcount || 0) + 1 })
            .eq('id', employerId);

        if (updateError) console.error("Error incrementing job count:", updateError);

        // 6. Send Email Alerts (Async - Non-blocking)
        // We wrap this in a separate try/catch so email failures don't crash the response
        try {
            const { data: seekers } = await supabase.from('users').select('email').eq('role', 'seeker');
            if (seekers && seekers.length > 0) {
                const emailList = seekers.map(s => s.email);
                const companyName = user.company_name || "Top Hiring Company";
                await sendJobAlertToSeekers(emailList, title, companyName);
            }
        } catch (emailErr) {
            console.error("Job alert email failed (non-critical):", emailErr);
        }

        // 7. Return Success
        res.status(201).json({ 
            message: 'Job posted successfully!', 
            job,
            remainingLimit: plan.limit - ((user.jobpostcount || 0) + 1)
        });

    } catch (err) {
        console.error("Job Post Error:", err);
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// 3. JOB MANAGEMENT (CRUD)
// ------------------------------------------------------------------

router.get('/jobs', auth, isEmployer, async(req, res) => {
    try {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('*, applications(count)')
            .eq('employerid', req.user.id)
            .order('posteddate', { ascending: false });

        if (error) throw error;
        res.json(jobs);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    try {
        const { jobId } = req.params;
        const updateBody = req.body;

        // Map camelCase to snake_case for DB
        const mappedData = {};
        if (updateBody.title) mappedData.title = updateBody.title;
        if (updateBody.category) mappedData.category = updateBody.category;
        if (updateBody.location) mappedData.location = updateBody.location;
        if (updateBody.experience) mappedData.experience = updateBody.experience;
        if (updateBody.salary) mappedData.salary = updateBody.salary;
        if (updateBody.ctc) mappedData.ctc = updateBody.ctc;
        if (updateBody.description) mappedData.description = updateBody.description;
        if (updateBody.requiredSkills) mappedData.required_skills = updateBody.requiredSkills;
        if (updateBody.noticePeriod) mappedData.notice_period = updateBody.noticePeriod;
        if (updateBody.screeningQuestions) mappedData.screening_questions = updateBody.screeningQuestions;

        const { data: job, error } = await supabase
            .from('jobs')
            .update(mappedData)
            .eq('id', jobId)
            .eq('employerid', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Job details updated.', job });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    try {
        const { jobId } = req.params;
        const employerId = req.user.id;

        // 1. Get current count before deleting
        const { data: user } = await supabase.from('users').select('jobpostcount').eq('id', employerId).single();

        // 2. Delete Job
        const { error: delError } = await supabase
            .from('jobs')
            .delete()
            .eq('id', jobId)
            .eq('employerid', employerId);

        if (delError) throw delError;

        // 3. Decrement Count (Free up a slot)
        const currentCount = user ? user.jobpostcount : 1;
        const newCount = Math.max(0, currentCount - 1);
        
        await supabase.from('users').update({ jobpostcount: newCount }).eq('id', employerId);

        res.json({ message: 'Job deleted and slot freed.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// 4. APPLICANT TRACKING (ATS)
// ------------------------------------------------------------------

// --- UPDATED APPLICANT TRACKING (ATS) IN employer.js ---

router.get('/applicants/:jobId', auth, isEmployer, async(req, res) => {
    try {
        const { jobId } = req.params;

        // 1. Ensure Employer Owns the Job
        const { data: job } = await supabase
            .from('jobs')
            .select('title, screening_questions')
            .eq('id', jobId)
            .eq('employerid', req.user.id)
            .single();

        if (!job) return res.status(403).json({ error: 'Access denied. You do not own this job.' });

        // 2. Fetch Applications INCLUDING the coverLetter field
        const { data: apps, error } = await supabase
            .from('applications')
            .select(`
                answers, 
                status, 
                applieddate, 
                seekerid,
                coverLetter, 
                seekers:seekerid (name, email, phone, skills, education, cvfilename)
            `)
            .eq('jobid', jobId);

        if (error) throw error;

        // 3. Format the data for the frontend
        const formatted = apps.map(app => ({
            ...app.seekers,
            applicationAnswers: app.answers,
            status: app.status,
            appliedDate: app.applieddate,
            seekerid: app.seekerid,
            coverLetter: app.coverLetter, // <--- SENDING THE COVER LETTER TO FRONTEND
            jobId: jobId
        }));

        res.json({
            jobTitle: job.title,
            screeningQuestions: job.screening_questions,
            applicants: formatted
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/applicants/status', auth, isEmployer, async(req, res) => {
    try {
        const { seekerId, jobId, newStatus } = req.body;

        // Verify ownership before updating
        const { data: job } = await supabase
            .from('jobs')
            .select('id')
            .eq('id', jobId)
            .eq('employerid', req.user.id)
            .single();

        if (!job) return res.status(403).json({ error: 'Unauthorized status update.' });

        const { data, error } = await supabase
            .from('applications')
            .update({ status: newStatus })
            .eq('jobid', jobId)
            .eq('seekerid', seekerId)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: `Applicant marked as ${newStatus}`, application: data });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// 5. SUBSCRIPTION INFO
// ------------------------------------------------------------------

router.get('/subscription-status', auth, isEmployer, async(req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('subscriptionstatus, jobpostcount, subscription_jsonb')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;

        const currentPlanKey = user.subscriptionstatus || 'buzz';
        const planInfo = HIVE_PLANS[currentPlanKey];

        res.json({
            currentPlan: planInfo,
            usage: user.jobpostcount,
            limit: planInfo.limit,
            details: user.subscription_jsonb
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;