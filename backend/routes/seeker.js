import express from 'express';
import multer from 'multer';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ------------------------------------------------------------------
// 1. MIDDLEWARE
// ------------------------------------------------------------------

// General Authentication Middleware (Copied from other files)
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

// Seeker/Admin Role Check Middleware
const checkRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Only job seekers can access this.' });
    }
    next();
};

const isSeeker = checkRole(['seeker', 'admin']);


// ------------------------------------------------------------------
// 2. PROFILE MANAGEMENT (Updates existing user row)
// ------------------------------------------------------------------

// PUT: Update Seeker Profile Info and Optionally Upload CV
router.put('/profile', auth, isSeeker, upload.single('cvFile'), async(req, res) => {
    const userId = req.user.id;
    const { name, education, skills } = req.body;

    let updateData = { name, education, skills: skills.split(',').map(s => s.trim()).filter(Boolean) };
    let cvFileName = null;

    // 1. Handle CV Upload (if a file is included)
    if (req.file) {
        const file = req.file;
        cvFileName = `${userId}_${Date.now()}_${file.originalname}`;

        const { error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(cvFileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true // Allows overwriting previous CV for this user
            });

        if (uploadError) {
            console.error('CV Upload Error:', uploadError);
            return res.status(500).json({ error: 'CV upload failed.' });
        }

        // Save the CV filename/path to the user profile
        updateData.cvFileName = cvFileName;
    }

    // 2. Update the user record
    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

    if (updateError) return res.status(400).json({ error: updateError.message });

    // NOTE: This updated user data should be used to update the frontend's current user state.
    res.json({ message: 'Profile updated successfully', user: updatedUser });
});


// ------------------------------------------------------------------
// 3. JOB BOARD & APPLICATION
// ------------------------------------------------------------------

// GET: Retrieve all available jobs (Job Board)
router.get('/jobs', auth, isSeeker, async(req, res) => {
    // NOTE: In a real scenario, this query would be filtered by skill and location.

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
            *,
            employer:employerId (name) // Fetch employer name
        `)
        .order('postedDate', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(jobs);
});


// POST: Apply for a specific job
router.post('/apply/:jobId', auth, isSeeker, async(req, res) => {
    const { jobId } = req.params;
    const { answers } = req.body; // Array of answers to screening questions
    const seekerId = req.user.id;

    // 1. Check if the seeker has already applied
    const { data: existingApp, error: checkError } = await supabase
        .from('applications')
        .select('id')
        .eq('seekerId', seekerId)
        .eq('jobId', jobId);

    if (checkError) return res.status(500).json({ error: checkError.message });
    if (existingApp && existingApp.length > 0) {
        return res.status(409).json({ error: 'You have already applied for this job.' });
    }

    // 2. Submit the application
    const applicationData = {
        jobId: parseInt(jobId),
        seekerId,
        status: 'applied', // Default status
        answers: answers || [],
    };

    const { data, error } = await supabase
        .from('applications')
        .insert([applicationData])
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Application submitted successfully', application: data });
});


// ------------------------------------------------------------------
// 4. ADMIN/DEPRECATED ROUTES (Modified or Removed)
// ------------------------------------------------------------------

// This route is deprecated/redundant as employer data fetching is now handled 
// by the new GET /api/employer/seekers and GET /api/employer/applicants/:jobId routes.
router.get('/', (req, res) => {
    return res.status(404).json({ error: 'This endpoint is deprecated. Use /api/employer/seekers instead.' });
});

// The initial POST /submit route logic is now handled more cleanly by PUT /profile
router.post('/submit', (req, res) => {
    return res.status(405).json({ error: 'Endpoint moved. Please use PUT /api/seeker/profile for updates.' });
});

export default router;