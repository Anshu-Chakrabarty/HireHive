// routes/seeker.js (FINAL WITH FILTERS AND CENTRAL AUTH)

import express from 'express';
import multer from 'multer';
import { supabase } from '../db.js';
import protect from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ------------------------------------------------------------------
// 1. MIDDLEWARE
// ------------------------------------------------------------------

// Seeker/Admin Role Check Middleware
const checkRole = (roles) => (req, res, next) => {
    // req.user is populated by the imported 'protect' middleware
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Insufficient privileges.' });
    }
    next();
};

const isSeeker = checkRole(['seeker', 'admin']);


// ------------------------------------------------------------------
// 2. PROFILE MANAGEMENT (PUT /api/seeker/profile)
// ------------------------------------------------------------------

// PUT: Update Seeker Profile Info and Optionally Upload CV
router.put('/profile', protect, isSeeker, upload.single('cvFile'), async(req, res) => {
    const userId = req.user.id;
    const { name, education, skills } = req.body;

    // CRITICAL: Server-side validation
    if (!name || !education || skills === undefined) {
        return res.status(400).json({ error: 'Name, education, and skills are required.' });
    }

    // Convert skills string to array of trimmed strings for Supabase JSON column
    let updateData = {
        name,
        education,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean)
    };

    // 1. Handle CV Upload (if a file is included)
    if (req.file) {
        const file = req.file;
        const cvfilename = `${userId}_${Date.now()}_${file.originalname}`;

        const { error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(cvfilename, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error('CV Upload Error:', uploadError);
            return res.status(500).json({ error: 'CV upload failed.' });
        }

        updateData.cvfilename = cvfilename;
    }

    // 2. Update the user record
    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

    if (updateError) return res.status(400).json({ error: updateError.message });

    const { password: userPassword, ...userData } = updatedUser;
    res.json({ message: 'Profile updated successfully', user: userData });
});


// ------------------------------------------------------------------
// 3. JOB BOARD & APPLICATION
// ------------------------------------------------------------------

// GET: Retrieve all available jobs (Job Board) with Filters
router.get('/jobs', protect, isSeeker, async(req, res) => {
    const { location, salary, experience, category } = req.query; // ⬅️ NEW: Destructure filter query params

    let query = supabase
        .from('jobs')
        .select(`
            *,
            employer:employerid (name) 
        `);

    // ➡️ NEW: Apply filters dynamically
    if (location) {
        query = query.ilike('location', `%${location}%`);
    }
    if (category) {
        query = query.eq('category', category);
    }
    if (salary) {
        // Filter jobs where salary string includes the minimum salary number (e.g., salary=8 matches "₹8-12 LPA")
        query = query.ilike('salary', `%${salary}%`);
    }
    if (experience && experience !== '0') {
        // Filter jobs where the required experience is less than or equal to the seeker's preference
        // This is a simple approximation for demo/MVP purposes.
        query = query.or(`experience.lte.${experience},experience.eq.0,experience.eq.1`);
    }

    // Order and execute
    const { data: jobs, error } = await query
        .order('posteddate', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(jobs);
});


// GET: Retrieve a seeker's application history and suggested jobs
router.get('/applications', protect, isSeeker, async(req, res) => {
    const seekerId = req.user.id;

    // 1. Fetch all applications made by the current seeker, joining job details
    const { data: appliedJobs, error } = await supabase
        .from('applications')
        .select(`
            status,
            applieddate,
            jobid,
            jobs:jobid (id, title, location, experience, salary, description, required_skills, employerid, employer:employerid (name))
        `)
        .eq('seekerid', seekerId);

    if (error) {
        console.error("Supabase application fetch error:", error);
        return res.status(500).json({ error: 'Failed to retrieve application history.' });
    }

    // 2. Fetch seeker's current skills for matching/shortlisting purposes
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('skills')
        .eq('id', seekerId)
        .single();

    if (userError || !user) return res.status(500).json({ error: 'Failed to retrieve seeker skills.' });

    const seekerSkills = (user.skills || []).map(s => s.toLowerCase());

    // 3. Separate applied jobs and find suggested/shortlisted jobs (purely logic-based)
    const appliedJobIds = appliedJobs.map(app => app.jobid);
    const shortlistedJobDetails = [];

    const { data: allJobs } = await supabase
        .from('jobs')
        .select('*, employer:employerid (name)');

    const suggestedJobs = (allJobs || []).filter(job => {
        // Exclude jobs the seeker has already applied to
        if (appliedJobIds.includes(job.id)) return false;

        const jobSkills = (job.required_skills || []).map(s => s.toLowerCase());

        // Shortlist if the seeker possesses at least one of the job's required skills
        const isShortlisted = jobSkills.some(skill => seekerSkills.includes(skill));

        if (isShortlisted) {
            shortlistedJobDetails.push(job);
        }
        return isShortlisted;
    });

    res.json({
        // Filter out null jobs just in case of stale data
        applied: appliedJobs.map(app => app.jobs).filter(Boolean),
        shortlisted: shortlistedJobDetails
    });
});


// POST: Apply for a specific job
router.post('/apply/:jobId', protect, isSeeker, async(req, res) => {
    const { jobId } = req.params;
    const { answers } = req.body;
    const seekerId = req.user.id;

    // CRITICAL: Validate jobId
    if (isNaN(parseInt(jobId))) {
        return res.status(400).json({ error: 'Invalid job ID provided.' });
    }

    // 1. Check for existing application
    const { data: existingApp, error: checkError } = await supabase
        .from('applications')
        .select('id')
        .eq('seekerid', seekerId)
        .eq('jobid', jobId);

    if (checkError) return res.status(500).json({ error: checkError.message });
    if (existingApp && existingApp.length > 0) {
        return res.status(409).json({ error: 'You have already applied for this job.' });
    }

    // 2. Insert new application
    const applicationData = {
        jobid: parseInt(jobId),
        seekerid: seekerId,
        status: 'applied',
        answers: answers || [],
    };

    const { data, error } = await supabase
        .from('applications')
        .insert([applicationData])
        .select('id')
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Application submitted successfully', application: data });
});


// ------------------------------------------------------------------
// 4. ADMIN/DEPRECATED ROUTES
// ------------------------------------------------------------------
router.get('/', (req, res) => {
    // This endpoint is not meant to be used directly
    return res.status(404).json({ error: 'Endpoint deprecated.' });
});

export default router;