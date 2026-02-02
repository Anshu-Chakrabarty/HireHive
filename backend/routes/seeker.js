import express from 'express';
import multer from 'multer';
import { supabase } from '../db.js';
import { protect as auth } from "./auth.js"; // Standardized Middleware
import { sendApplicationAlertToEmployer } from '../utils/emailService.js'; // <--- NEW IMPORT

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Seeker/Admin Role Check
const isSeeker = (req, res, next) => {
    if (req.user.role !== 'seeker' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Seeker account required.' });
    }
    next();
};

// ------------------------------------------------------------------
// 1. PROFILE MANAGEMENT
// ------------------------------------------------------------------

router.put('/profile', auth, isSeeker, upload.single('cvFile'), async(req, res) => {
    try {
        const userId = req.user.id;
        const { name, education, skills } = req.body;

        if (!name || !education) {
            return res.status(400).json({ error: 'Name and education are required.' });
        }

        let updateData = {
            name,
            education,
            skills: skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : []
        };

        if (req.file) {
            const file = req.file;
            const cvfilename = `cvs/${userId}_${Date.now()}.pdf`;

            const { error: uploadError } = await supabase.storage
                .from('cvs')
                .upload(cvfilename, file.buffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) throw new Error('CV upload failed. Please try a smaller PDF.');
            updateData.cvfilename = cvfilename;
        }

        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select(`id, role, name, email, phone, skills, education, cvfilename, subscriptionstatus, created_at`)
            .single();

        if (updateError) throw updateError;
        res.json({ message: 'Profile synced with Hive!', user: updatedUser });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// 2. JOB SEARCH & FILTERING
// ------------------------------------------------------------------

router.get('/jobs', auth, isSeeker, async(req, res) => {
    try {
        const { location, experience, category, keywords } = req.query;

        let query = supabase
            .from('jobs')
            .select(`*, employer:employerid (name)`);

        // Filter: Category (Strict)
        if (category && category !== '') query = query.eq('category', category);

        // Filter: Location (Fuzzy)
        if (location) query = query.ilike('location', `%${location}%`);

        // Filter: Experience (Logic Match)
        if (experience && experience !== '0') {
            // Checks if the job's experience text contains the selected number
            query = query.ilike('experience', `%${experience}%`);
        }

        // Filter: Keywords (Multi-column search)
        if (keywords) {
            query = query.or(`title.ilike.%${keywords}%,description.ilike.%${keywords}%,category.ilike.%${keywords}%`);
        }

        const { data: jobs, error } = await query.order('posteddate', { ascending: false });

        if (error) throw error;
        res.json(jobs);

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// 3. APPLICATIONS & SMART SUGGESTIONS
// ------------------------------------------------------------------

router.get('/applications', auth, isSeeker, async(req, res) => {
    try {
        const seekerId = req.user.id;

        // 1. Fetch Seeker's Profile for Skill Matching
        const { data: user } = await supabase.from('users').select('skills').eq('id', seekerId).single();
        let userSkills = [];
        if (user && user.skills && Array.isArray(user.skills)) {
            userSkills = user.skills.map(s => s.toLowerCase());
        }

        // 2. Fetch All Applications with Job Details
        const { data: apps, error: appError } = await supabase
            .from('applications')
            .select(`jobid, status, jobs (*, employer:employerid(name))`)
            .eq('seekerid', seekerId);

        if (appError) throw appError;

        // 3. Fetch Job Board for Suggestions (Filter out already applied)
        const appliedIds = apps.map(a => a.jobid);
        const { data: allJobs } = await supabase.from('jobs').select('*, employer:employerid(name)');

        const shortlisted = allJobs
            .filter(job => !appliedIds.includes(job.id))
            .filter(job => {
                const jobSkills = (job.required_skills || []).map(s => s.toLowerCase());
                return jobSkills.some(skill => userSkills.includes(skill));
            });

        res.json({
            applied: apps.map(a => ({...a.jobs, status: a.status })),
            shortlisted: shortlisted
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- NEW ROUTE: FETCH SINGLE JOB DETAILS ---
router.get('/jobs/:jobId', auth, isSeeker, async (req, res) => {
    try {
        const { jobId } = req.params;

        const { data: job, error } = await supabase
            .from('jobs')
            .select(`*, employer:employerid (name)`)
            .eq('id', jobId)
            .single();

        if (error || !job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(job);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- UPDATED APPLICATION ROUTE IN seeker.js ---

router.post('/apply/:jobId', auth, isSeeker, async(req, res) => {
    try {
        const { jobId } = req.params;
        const { answers, coverLetter } = req.body; 
        const seekerId = req.user.id;

        // 1. MANDATORY CV VALIDATION
        // Fetch the user's profile to check if a CV exists
        const { data: userProfile, error: userError } = await supabase
            .from('users')
            .select('cvfilename')
            .eq('id', seekerId)
            .single();

        if (userError || !userProfile.cvfilename) {
            return res.status(400).json({ 
                error: 'CV Required. Please upload a CV to your profile before applying for this job.' 
            });
        }

        // 2. Prevent Duplicate Applications
        const { data: exists } = await supabase.from('applications').select('id').eq('seekerid', seekerId).eq('jobid', jobId).maybeSingle();
        if (exists) return res.status(409).json({ error: 'Already applied for this hive.' });

        // 3. FETCH JOB & EMPLOYER DETAILS FOR EMAIL
        const { data: jobData } = await supabase
            .from('jobs')
            .select(`
                title,
                employerid,
                users:employerid (email) 
            `)
            .eq('id', jobId)
            .single();

        if (!jobData) return res.status(404).json({ error: "Job not found" });

        // 4. INSERT APPLICATION WITH COVER LETTER
        const { data, error } = await supabase
            .from('applications')
            .insert([{
                jobid: jobId,
                seekerid: seekerId,
                status: 'applied',
                answers: answers || [],
                coverLetter: coverLetter || "" 
            }])
            .select()
            .single();

        if (error) throw error;

        // 5. SEND NOTIFICATION TO EMPLOYER
        try {
            if (jobData.users && jobData.users.email) {
                const { data: seekerProfile } = await supabase.from('users').select('name').eq('id', seekerId).single();

                sendApplicationAlertToEmployer(
                    jobData.users.email,
                    jobData.title,
                    seekerProfile ? seekerProfile.name : 'A Candidate'
                );
            }
        } catch (emailErr) {
            console.error("Failed to send employer email alert:", emailErr);
        }

        res.json({ message: 'Application submitted successfully!', application: data });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;