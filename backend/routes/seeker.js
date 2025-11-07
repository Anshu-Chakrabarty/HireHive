import express from 'express';
import multer from 'multer';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
// Set file size limit to 5MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ------------------------------------------------------------------
// 1. MIDDLEWARE 
// ------------------------------------------------------------------

// General Authentication Middleware
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

// Seeker/Admin Role Check Middleware
const checkRole = (roles) => (req, res, next) => {
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
router.put('/profile', auth, isSeeker, upload.single('cvFile'), async(req, res) => {
    const userId = req.user.id;
    const { name, education, skills } = req.body;

    if (!name || !education || skills === undefined) {
        return res.status(400).json({ error: 'Name, education, and skills are required.' });
    }

    // Convert skills string to array
    let updateData = {
        name,
        education,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean)
    };

    if (req.file) {
        const file = req.file;
        // Generate a unique filename using userId and timestamp
        const cvfilename = `cvs/${userId}_${Date.now()}_${file.originalname.replace(/[^a-z0-9.]/gi, '_')}`;

        // Upload to Supabase Storage in the 'cvs' bucket
        const { error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(cvfilename, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error('CV Upload Error:', uploadError);
            return res.status(500).json({ error: 'CV upload failed. File size might be too large or invalid format.' });
        }

        updateData.cvfilename = cvfilename;
    }

    // Update user record in the 'users' table
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
router.get('/jobs', auth, isSeeker, async(req, res) => {
    const { location, salary, experience, category, keywords } = req.query;

    let query = supabase
        .from('jobs')
        .select(`
            *,
            employer:employerid (name) 
        `);

    // Apply filters dynamically
    if (location) {
        query = query.ilike('location', `%${location}%`);
    }
    if (category) {
        query = query.eq('category', category);
    }
    if (salary) {
        query = query.ilike('salary', `%${salary}%`);
    }

    // Apply keyword filter across job title and description
    if (keywords) {
        const searchTerms = keywords.split(' ').map(term => term.trim()).filter(Boolean);
        const searchConditions = searchTerms.map(term => `title.ilike.%${term}%,description.ilike.%${term}%`).join(',');
        query = query.or(searchConditions);
    }

    // Order and execute
    const { data: jobs, error } = await query
        .order('posteddate', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(jobs);
});


// GET: Retrieve a seeker's application history and suggested jobs
router.get('/applications', auth, isSeeker, async(req, res) => {
    const seekerId = req.user.id;

    // 1. Fetch all applications made by the current seeker, joining job details
    const { data: applications, error } = await supabase
        .from('applications')
        .select(`
            status,
            applieddate,
            jobid,
            jobs:jobid (
                id, title, location, experience, salary, description, required_skills, 
                employer:employerid (name)
            )
        `)
        .eq('seekerid', seekerId);

    if (error) {
        console.error("Supabase application fetch error:", error);
        return res.status(500).json({ error: 'Failed to retrieve application history.' });
    }

    // 2. Separate applied and categorized jobs
    const appliedJobs = [];

    applications.forEach(app => {
        if (app.jobs) {
            const jobData = {...app.jobs, status: app.status };
            appliedJobs.push(jobData);
        }
    });

    // 3. Simple approach for Suggested Jobs (Find skill-matches not already applied for)
    const { data: user } = await supabase.from('users').select('skills').eq('id', seekerId).single();

    // FINAL FIX: Backward compatible check for seekerSkills
    let seekerSkills = [];
    if (user && user.skills && Array.isArray(user.skills)) {
        seekerSkills = user.skills.map(s => s.toLowerCase());
    }

    const appliedJobIds = applications.map(app => app.jobid);

    const { data: allJobs } = await supabase
        .from('jobs')
        .select('*, employer:employerid (name)');

    // Filter jobs: not already applied, and skill matches
    const suggestedJobs = (allJobs || [])
        .filter(job => !appliedJobIds.includes(job.id))
        .filter(job => {
            const jobSkills = (job.required_skills || []).map(s => s.toLowerCase());
            return jobSkills.some(skill => seekerSkills.includes(skill));
        });

    res.json({
        applied: appliedJobs,
        shortlisted: suggestedJobs // Note: Frontend uses 'shortlisted' label for this suggested list
    });
});


// POST: Apply for a specific job
router.post('/apply/:jobId', auth, isSeeker, async(req, res) => {
    const { jobId } = req.params;
    const { answers } = req.body;
    const seekerId = req.user.id;

    const parsedJobId = parseInt(jobId);
    if (isNaN(parsedJobId)) {
        return res.status(400).json({ error: 'Invalid job ID provided.' });
    }

    // 1. Check for existing application
    const { data: existingApp, error: checkError } = await supabase
        .from('applications')
        .select('id')
        .eq('seekerid', seekerId)
        .eq('jobid', parsedJobId);

    if (checkError) return res.status(500).json({ error: checkError.message });
    if (existingApp && existingApp.length > 0) {
        return res.status(409).json({ error: 'You have already applied for this job.' });
    }

    // 2. Insert new application 
    const applicationData = {
        jobid: parsedJobId,
        seekerid: seekerId,
        status: 'applied',
        answers: answers || [],
        applieddate: new Date().toISOString()
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
    return res.status(404).json({ error: 'Endpoint deprecated.' });
});

export default router;