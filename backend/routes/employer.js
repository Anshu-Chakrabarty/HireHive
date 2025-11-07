import express from 'express';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = express.Router();

// --- Subscription Plan Limits & Prices (Prices in paise) ---
const HIVE_PLANS = {
    'buzz': { limit: 2, price: 0, name: "Buzz Plan" },
    'worker': { limit: 5, price: 199900, name: "Worker Plan" }, // ₹1,999.00
    'colony': { limit: 15, price: 499900, name: "Colony Plan" }, // ₹4,999.00
    'queen': { limit: 30, price: 899900, name: "Queen Plan" }, // ₹8,999.00
    'hive_master': { limit: Infinity, price: 1499900, name: "Hive Master Plan" }, // ₹14,999.00
};

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// ------------------------------------------------------------------
// 1. MIDDLEWARE
// ------------------------------------------------------------------
const auth = (req, res, next) => {
    // ... (Middleware code remains the same) ...
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
        req.user = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
const checkRole = (roles) => (req, res, next) => {
    // ... (Middleware code remains the same) ...
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
    // ... (This route remains the same) ...
    const { title, category, location, experience, salary, ctc, requiredSkills, description, noticePeriod, screeningQuestions } = req.body;
    const employerId = req.user.id;
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('jobpostcount, subscriptionstatus')
        .eq('id', employerId)
        .single();
    if (userError || !user) return res.status(500).json({ error: 'Failed to retrieve user subscription status.' });
    const currentPlanKey = user.subscriptionstatus || 'buzz';
    const plan = HIVE_PLANS[currentPlanKey];
    if (!plan) {
        return res.status(403).json({ error: 'Invalid subscription plan. Please contact support.' });
    }
    const planLimit = plan.limit;
    const isUnlimited = planLimit === Infinity;
    if (!isUnlimited && user.jobpostcount >= planLimit) {
        return res.status(403).json({
            error: `Job posting limit (${planLimit}) reached for your current plan (${currentPlanKey}). Please upgrade.`
        });
    }
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
    const { password: userPassword, ...userData } = updatedUser;
    res.json({ message: 'Job posted successfully', job: job, user: userData });
});

// GET: Retrieve all jobs posted by the current employer
router.get('/jobs', auth, isEmployer, async(req, res) => {
    // ... (This route remains the same) ...
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
    // ... (This route remains the same) ...
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

// DELETE: Delete a job
router.delete('/jobs/:jobId', auth, isEmployer, async(req, res) => {
    // ... (This route remains the same) ...
    const { jobId } = req.params;
    const employerId = req.user.id;
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
    const isUnlimited = !plan || plan.limit === Infinity;
    await supabase.from('applications').delete().eq('jobid', jobId);
    const { error: jobDeleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('employerid', employerId);
    if (jobDeleteError) return res.status(400).json({ error: jobDeleteError.message });
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
// 3. APPLICANTS & SEEKER DATA
// ------------------------------------------------------------------

// GET: Retrieve all applicants for a specific job
router.get('/applicants/:jobId', auth, isEmployer, async(req, res) => {
    // ... (This route remains the same) ...
    const { jobId } = req.params;
    const employerId = req.user.id;
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id, employerid, screening_questions, title')
        .eq('employerid', employerId)
        .eq('id', jobId)
        .single();
    if (jobError || !job) return res.status(403).json({ error: 'Access denied to job applicants.' });
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
    // ... (This route remains the same) ...
    const { seekerId, jobId, newStatus } = req.body;
    const employerId = req.user.id;
    if (!seekerId || !jobId || !newStatus) {
        return res.status(400).json({ error: 'Missing required fields: seekerId, jobId, newStatus.' });
    }
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', jobId)
        .eq('employerid', employerId)
        .single();
    if (jobError || !job) {
        return res.status(403).json({ error: 'Access denied. You do not own this job.' });
    }
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


// --- ROUTE REMOVED ---
// GET: Retrieve the list of all seekers (Talent Pool view)
// This route has been deleted to protect seeker privacy.


// ------------------------------------------------------------------
// 4. SUBSCRIPTION & PAYMENT
// ------------------------------------------------------------------

// PUT: Update the employer's subscription (Only for FREE plan)
router.put('/subscription', auth, isEmployer, async(req, res) => {
    // ... (This route remains the same) ...
    const { newPlanKey } = req.body;
    const employerId = req.user.id;
    if (newPlanKey !== 'buzz') {
        return res.status(400).json({ error: "Paid plans must be activated via payment." });
    }
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

// POST: Create Razorpay Order
router.post('/payment/create-order', auth, isEmployer, async(req, res) => {
    // ... (This route remains the same) ...
    const { planKey } = req.body;
    const plan = HIVE_PLANS[planKey];
    if (!plan || plan.price === 0) {
        return res.status(400).json({ error: 'Invalid or free plan selected for payment.' });
    }
    const options = {
        amount: plan.price,
        currency: "INR",
        receipt: `receipt_hirehive_${new Date().getTime()}`,
        notes: {
            planKey: planKey,
            userId: req.user.id
        }
    };
    try {
        const order = await razorpay.orders.create(options);
        res.json({ order });
    } catch (error) {
        console.error("Razorpay order creation failed:", error);
        res.status(500).json({ error: "Failed to create payment order." });
    }
});

// POST: Verify Razorpay Payment
router.post('/payment/verify-payment', auth, isEmployer, async(req, res) => {
    // ... (This route remains the same) ...
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey } = req.body;
    const employerId = req.user.id;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planKey) {
        return res.status(400).json({ error: "Payment verification data missing." });
    }
    const plan = HIVE_PLANS[planKey];
    if (!plan) return res.status(400).json({ error: "Invalid plan key during verification." });
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');
    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
    }
    const updateData = {
        subscriptionstatus: planKey,
        jobpostcount: 0,
        subscription_jsonb: {
            active: true,
            plan: planKey,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id
        }
    };
    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', employerId)
        .select()
        .single();
    if (updateError) {
        console.error("Supabase subscription update error after payment:", updateError);
        return res.status(5000).json({ error: 'Payment verified, but failed to update subscription. Please contact support.' });
    }
    const { password: userPassword, ...userData } = updatedUser;
    res.json({
        message: `Payment successful! Your plan is now ${plan.name}.`,
        user: userData
    });
});


export default router;