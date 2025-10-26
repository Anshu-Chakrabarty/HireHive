// --- Backend: routes/seeker.js (REPLACE ENTIRE FILE) ---
import express from 'express';
import multer from 'multer';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

// Seeker/Admin Role Check Middleware
const checkRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Only job seekers can access this.' });
    }
    next();
};

const isSeeker = checkRole(['seeker', 'admin']);


// ------------------------------------------------------------------
// 2. PROFILE MANAGEMENT (PUT /api/seeker/profile)
// ------------------------------------------------------------------

// PUT: Update Seeker Profile Info and Optionally Upload CV
router.put('/profile', auth, isSeeker, upload.single('cvFile'), async(req, res) => {
    const userId = req.user.id;
    const { name, education, skills } = req.body;

    let updateData = {
        name,
        education,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean)
    };

    // 1. Handle CV Upload (if a file is included)
    if (req.file) {
        const file = req.file;
        // FINAL NAME ALIGNMENT: Use all lowercase name for DB column
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

        // Use the final lowercase column name in the update payload
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

// GET: Retrieve all available jobs (Job Board)
router.get('/jobs', auth, isSeeker, async(req, res) => {
    const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
            *,
            employer:employerid (name) 
        `)
        .order('postedDate', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(jobs);
});


// POST: Apply for a specific job
router.post('/apply/:jobId', auth, isSeeker, async(req, res) => {
    const { jobId } = req.params;
    const { answers } = req.body;
    const seekerId = req.user.id;

    const { data: existingApp, error: checkError } = await supabase
        .from('applications')
        .select('id')
        .eq('seekerId', seekerId)
        .eq('jobId', jobId);

    if (checkError) return res.status(500).json({ error: checkError.message });
    if (existingApp && existingApp.length > 0) {
        return res.status(409).json({ error: 'You have already applied for this job.' });
    }

    const applicationData = {
        jobId: parseInt(jobId),
        seekerId,
        status: 'applied',
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
// 4. ADMIN/DEPRECATED ROUTES
// ------------------------------------------------------------------
router.get('/', (req, res) => {
    return res.status(404).json({ error: 'Endpoint deprecated.' });
});

export default router;