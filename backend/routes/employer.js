import express from 'express';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

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

// POST: Create a new job
router.post('/jobs', auth, isEmployer, async(req, res) => {
    const { title, category, location, experience, salary, ctc, requiredSkills, description, noticePeriod, screeningQuestions } = req.body;

    // The user ID comes from the JWT payload
    const employerId = req.user.id;

    const jobData = {
        employerId,
        title,
        category,
        location,
        experience,
        salary,
        ctc, // Current CTC from seeker is saved here for later matching
        requiredSkills,
        description,
        noticePeriod,
        screeningQuestions,
        postedDate: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('jobs')
        .insert([jobData])
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Job posted successfully', job: data });
});

// GET: Retrieve all jobs posted by the current employer
router.get('/jobs', auth, isEmployer, async(req, res) => {
    const employerId = req.user.id;

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
            *, 
            applications(count) // Count applications related to this job
        `)
        .eq('employerId', employerId)
        .order('postedDate', { ascending: false });

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
        .eq('employerId', employerId) // Crucial security check: Only owner can update
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

    // 1. (Optional but recommended for cleanup): Delete related applications first
    // In a real database with cascade delete enabled, this step might be skipped.
    // Assuming no cascade delete for safety:
    await supabase.from('applications').delete().eq('jobId', jobId);

    // 2. Delete the job
    const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('employerId', employerId); // Crucial security check

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
        .select('id, employerId, screeningQuestions')
        .eq('id', jobId)
        .eq('employerId', employerId)
        .single();

    if (jobError || !job) return res.status(403).json({ error: 'Access denied to job applicants.' });

    // 2. Fetch all applications for that job, joining seeker data
    const { data: applications, error } = await supabase
        .from('applications')
        .select(`
            answers,
            seekers:seekerId (name, email, phone, skills, education, cvFileName) // Join seeker profile data
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
// NOTE: This assumes 'seekers' is a profile table linked to 'users'
// For now, we fetch from 'users' and filter by role on the backend.
router.get('/seekers', auth, isEmployer, async(req, res) => {

    const { data: seekers, error } = await supabase
        .from('users')
        .select('id, name, email, phone, skills, education, cvFileName')
        .eq('role', 'seeker')
        .order('name', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    res.json(seekers);
});


export default router;