import express from 'express';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';
import { protect as auth } from "./auth.js";
import { sendJobAlertToSeekers } from '../utils/emailService.js'; // <--- Email Integration

const router = express.Router();

// --- 1. CONFIGURATION & CONSTANTS ---
const HIVE_PLANS = {
    'buzz': { limit: 2, name: "Buzz Plan", price: 0 },
    'worker': { limit: 5, name: "Worker Plan", price: 499 },
    'colony': { limit: 15, name: "Colony Plan", price: 999 },
    'queen': { limit: 30, name: "Queen Plan", price: 1999 },
    'hive_master': { limit: Infinity, name: "Hive Master Plan", price: 4999 },
};

// Middleware: Strict Employer/Admin Check
const isEmployer = (req, res, next) => {
    if (!req.user || (req.user.role !== 'employer' && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied. Employer account required.' });
    }
    next();
};

// ------------------------------------------------------------------
// 2. JOB POSTING LOGIC
// ------------------------------------------------------------------

router.post('/jobs', auth, isEmployer, async(req, res) => {
    try {
        const {
            title,
            category,
            location,
            experience,
            salary,
            ctc,
            requiredSkills,
            description,
            noticePeriod,
            screeningQuestions
        } = req.body;

        const employerId = req.user.id;

        // Fetch User Plan & Count (Added company_name for email)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('jobpostcount, subscriptionstatus, subscription_jsonb, company_name')
            .eq('id', employerId)
            .single();

        if (userError || !user) {
            return res.status(500).json({ error: 'Failed to retrieve subscription status.' });
        }

        const currentPlanKey = user.subscriptionstatus || 'buzz';
        const plan = HIVE_PLANS[currentPlanKey];

        if (!plan) return res.status(403).json({ error: 'Invalid subscription plan.' });

        // Check Limit
        if (plan.limit !== Infinity && (user.jobpostcount || 0) >= plan.limit) {
            return res.status(403).json({
                error: `Job limit reached (${plan.limit}) for your ${plan.name}. Please upgrade to post more.`
            });
        }

        // Insert Job
        const { data: job, error: jobInsertError } = await supabase
            .from('jobs')
            .insert([{
                employerid: employerId,
                title,
                category,
                location,
                experience,
                salary,
                ctc,
                description,
                required_skills: requiredSkills || [],
                notice_period: noticePeriod,
                screening_questions: screeningQuestions || []
            }])
            .select()
            .single();

        if (jobInsertError) throw jobInsertError;

        // Increment Job Count
        const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({ jobpostcount: (user.jobpostcount || 0) + 1 })
            .eq('id', employerId)
            .select('id, name, email, role, jobpostcount, subscriptionstatus')
            .single();

        if (updateError) console.error("Counter increment failed:", updateError);

        // --- SEND EMAIL ALERTS TO SEEKERS ---
        // We do this asynchronously so we don't block the response
        try {
            const { data: seekers } = await supabase
                .from('users')
                .select('email')
                .eq('role', 'seeker');

            if (seekers && seekers.length > 0) {
                const emailList = seekers.map(s => s.email);
                const companyName = user.company_name || "Top Hiring Company";

                sendJobAlertToSeekers(emailList, title, companyName);
            }
        } catch (emailErr) {
            console.error("Failed to send job alerts:", emailErr);
        }
        // ----------------------------------------

        res.status(201).json({
            message: 'Job posted successfully to the Hive!',
            job,
            user: updateData
        });

    } catch (err) {
        console.error("Job Post Error:", err);
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// 3. JOB MANAGEMENT (GET, PUT, DELETE)
// ------------------------------------------------------------------

router.get('/jobs', auth, isEmployer, async(req, res) => {
    try {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select(`
                *,
                applications(count)
            `)
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

        // Manual mapping to handle camelCase from frontend to snake_case in DB
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
        if (!job) return res.status(404).json({ error: "Job not found or unauthorized." });

        res.json({ message: 'Job details updated.', job });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    try {
        const { jobId } = req.params;
        const employerId = req.user.id;

        const { data: user } = await supabase.from('users').select('jobpostcount').eq('id', employerId).single();

        // Delete Job (Cascade deletes applications in DB)
        const { error: delError } = await supabase
            .from('jobs')
            .delete()
            .eq('id', jobId)
            .eq('employerid', employerId);

        if (delError) throw delError;

        // Decrement Count
        const currentCount = (user && user.jobpostcount) ? user.jobpostcount : 1;
        const newCount = Math.max(0, currentCount - 1);

        const { data: updatedUser } = await supabase
            .from('users')
            .update({ jobpostcount: newCount })
            .eq('id', employerId)
            .select('id, name, email, role, jobpostcount, subscriptionstatus')
            .single();

        res.json({ message: 'Job deleted and count updated.', user: updatedUser });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// 4. APPLICANT TRACKING SYSTEM (ATS)
// ------------------------------------------------------------------

router.get('/applicants/:jobId', auth, isEmployer, async(req, res) => {
    try {
        const { jobId } = req.params;

        // Security check
        const { data: job } = await supabase
            .from('jobs')
            .select('title, screening_questions')
            .eq('id', jobId)
            .eq('employerid', req.user.id)
            .single();

        if (!job) return res.status(403).json({ error: 'Access denied.' });

        const { data: apps, error } = await supabase
            .from('applications')
            .select(`
                answers, status, applieddate, seekerid,
                seekers:seekerid (name, email, phone, skills, education, cvfilename)
            `)
            .eq('jobid', jobId);

        if (error) throw error;

        const formatted = apps.map(app => ({
            ...app.seekers,
            applicationAnswers: app.answers,
            status: app.status,
            appliedDate: app.applieddate,
            seekerid: app.seekerid,
            jobId: jobId // Included for easier frontend matching
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

        // Check ownership
        const { data: job } = await supabase.from('jobs').select('id').eq('id', jobId).eq('employerid', req.user.id).single();
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
// 5. SUBSCRIPTION & BILLING (SIMULATED)
// ------------------------------------------------------------------

router.get('/subscription-status', auth, isEmployer, async(req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('subscriptionstatus, jobpostcount, subscription_jsonb')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;

        const planInfo = HIVE_PLANS[user.subscriptionstatus || 'buzz'];
        res.json({
            currentPlan: planInfo,
            usage: user.jobpostcount,
            details: user.subscription_jsonb
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/subscription/upgrade', auth, isEmployer, async(req, res) => {
    try {
        const { newPlanKey } = req.body;
        if (!HIVE_PLANS[newPlanKey]) return res.status(400).json({ error: "Invalid Plan Selected." });

        // Logic: Upgrading resets job post count but provides a higher limit
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({
                subscriptionstatus: newPlanKey,
                jobpostcount: 0, // Resetting count as a reward for upgrading
                subscription_jsonb: {
                    active: true,
                    plan: newPlanKey,
                    last_updated: new Date().toISOString()
                }
            })
            .eq('id', req.user.id)
            .select('id, name, email, role, jobpostcount, subscriptionstatus')
            .single();

        if (error) throw error;
        res.json({
            message: `Successfully upgraded to ${HIVE_PLANS[newPlanKey].name}!`,
            user: updatedUser
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;