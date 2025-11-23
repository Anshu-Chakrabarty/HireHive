import express from 'express';
import multer from 'multer';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// --- MIDDLEWARE IMPORT from auth.js ---
import { protect as auth } from "./auth.js"; // Import protect middleware from auth route

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

    let updateData = {
        name,
        education,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean)
    };

    if (req.file) {
        const file = req.file;
        const cvfilename = `cvs/${userId}_${Date.now()}_${file.originalname.replace(/[^a-z0-9.]/gi, '_')}`;

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

    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select(`id, role, name, email, phone, skills, education, cvfilename, company_name, jobpostcount, subscriptionstatus, google_id, created_at`)
        .single();

    if (updateError) return res.status(400).json({ error: updateError.message });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
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

    // 💡 FIX: Apply Experience Filter (Fuzzy Search for text column)
    if (experience && experience !== '0') {
        const minYears = parseInt(experience, 10);
        if (!isNaN(minYears)) {
            // Find jobs where the experience string contains the min year or is a range
            // e.g., if minYears is 5, look for '5+ Years' or '5-8 Years'
            query = query.or(`experience.ilike.%${minYears}+%`, `experience.ilike.%${minYears}-%`);
        }
    }


    // Apply keyword filter across job title and description
    if (keywords) {
        const searchTerms = keywords.split(' ').map(term => term.trim()).filter(Boolean);
        if (searchTerms.length > 0) {
            const conditions = searchTerms.map(term =>
                `or(title.ilike.%${term}%,description.ilike.%${term}%,required_skills.cs.%${term}%)`
            ).join(',');
            query = query.or(conditions);
        }
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

    // 1. Fetch Application History (Only IDs and Status)
    const { data: applicationRecords, error: historyError } = await supabase
        .from('applications')
        .select('jobid, status')
        .eq('seekerid', seekerId);

    if (historyError) {
        console.error("Supabase application history fetch error:", historyError);
        return res.status(500).json({ error: 'Failed to retrieve application history.' });
    }

    const appliedJobIds = applicationRecords.map(app => app.jobid);
    const shortlistedJobIds = applicationRecords
        .filter(app => app.status === 'Shortlisted')
        .map(app => app.jobid);

    // 2. Fetch all jobs
    const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*, employer:employerid (name)');

    if (jobsError) {
        console.error("Supabase job data fetch error:", jobsError);
        return res.status(500).json({ error: 'Failed to retrieve job data for suggestions.' });
    }

    const allJobs = jobsData || [];

    // 3. Separate applied jobs and fetch user skills for suggestions
    const appliedJobs = [];
    const shortlistedJobs = [];

    applicationRecords.forEach(app => {
        const jobDetail = allJobs.find(job => job.id === app.jobid);
        if (jobDetail) {
            const jobWithStatus = {...jobDetail, status: app.status };
            appliedJobs.push(jobWithStatus);
            if (app.status === 'Shortlisted') {
                shortlistedJobs.push(jobDetail);
            }
        }
    });

    // 4. Find Suggested Jobs (Skill Match)
    const { data: user } = await supabase.from('users').select('skills').eq('id', seekerId).single();

    let seekerSkills = [];
    if (user && user.skills && Array.isArray(user.skills)) {
        seekerSkills = user.skills.map(s => s.toLowerCase());
    }

    const suggestedJobs = allJobs
        .filter(job => !appliedJobIds.includes(job.id))
        .filter(job => {
            const jobSkills = (job.required_skills || []).map(s => s.toLowerCase());
            return jobSkills.some(skill => seekerSkills.includes(skill));
        });

    const suggestedAndShortlistedCombined = [
        ...shortlistedJobs,
        ...suggestedJobs.filter(job => !shortlistedJobIds.includes(job.id))
    ];

    res.json({
        applied: appliedJobs,
        shortlisted: suggestedAndShortlistedCombined
    });
});


// POST: Apply for a specific job (remains the same)
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