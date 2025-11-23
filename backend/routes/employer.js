import express from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../db.js";

const router = express.Router();

// ----------------------------------------
// 🔐 AUTH MIDDLEWARE
// ----------------------------------------
const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};

const isEmployer = (req, res, next) => {
    const role = req.user && req.user.role;
    if (!["employer", "admin"].includes(role)) {
        return res.status(403).json({ error: "Access denied" });
    }
    next();
};

// ----------------------------------------
// 🐝 Subscription Plans
// ----------------------------------------
const HIVE_PLANS = {
    buzz: { limit: 2, name: "Buzz Plan" },
    worker: { limit: 5, name: "Worker Plan" },
    colony: { limit: 15, name: "Colony Plan" },
    queen: { limit: 30, name: "Queen Plan" },
    hive_master: { limit: Infinity, name: "Hive Master Plan" },
};

// ----------------------------------------
// 📌 1️⃣ CREATE JOB
// ----------------------------------------
router.post("/jobs", auth, isEmployer, async(req, res) => {
    try {
        const employerId = req.user.id;
        const {
            title,
            category,
            location,
            experience,
            salary,
            ctc,
            description,
            requiredSkills,
            noticePeriod,
            screeningQuestions,
        } = req.body;

        // 1️⃣ Check plan limit
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("jobpostcount, subscriptionstatus")
            .eq("id", employerId)
            .single();

        if (userError) {
            console.error("Fetch user error →", userError.message);
            return res.status(400).json({ error: userError.message });
        }

        const subscriptionStatus = user && user.subscriptionstatus;
        const plan =
            (subscriptionStatus && HIVE_PLANS[subscriptionStatus]) ||
            HIVE_PLANS.buzz;

        if (user.jobpostcount >= plan.limit) {
            return res.status(403).json({
                error: `Job post limit reached for (${plan.name}). Upgrade plan to continue.`,
            });
        }

        // 2️⃣ Insert job
        const jobData = {
            employerid: employerId,
            title,
            category,
            location,
            experience,
            salary,
            ctc,
            description,
            required_skills: requiredSkills,
            notice_period: noticePeriod,
            screening_questions: screeningQuestions,
        };

        const { data: job, error } = await supabase
            .from("jobs")
            .insert([jobData])
            .select()
            .single();

        if (error) {
            console.error("Job insert error →", error.message);
            return res.status(400).json({ error: error.message });
        }

        // 3️⃣ Increase counter
        const { error: updateError } = await supabase
            .from("users")
            .update({ jobpostcount: user.jobpostcount + 1 })
            .eq("id", employerId);

        if (updateError) {
            console.error("Job count update error →", updateError.message);
        }

        res.json({ message: "Job posted successfully ✔", job });
    } catch (err) {
        console.error("Job Create Error →", err.message);
        res.status(500).json({ error: "Failed to post job" });
    }
});

// ----------------------------------------
// 📌 2️⃣ GET MY JOBS
// ----------------------------------------
router.get("/jobs", auth, isEmployer, async(req, res) => {
    try {
        const employerId = req.user.id;

        const { data, error } = await supabase
            .from("jobs")
            .select("*, applications(count)")
            .eq("employerid", employerId)
            .order("posteddate", { ascending: false });

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);
    } catch (err) {
        console.error("Get jobs error →", err.message);
        res.status(500).json({ error: "Failed to fetch jobs" });
    }
});

// ----------------------------------------
// 📌 3️⃣ UPDATE JOB
// ----------------------------------------
router.put("/jobs/:jobId", auth, isEmployer, async(req, res) => {
    try {
        const jobId = parseInt(req.params.jobId, 10);
        const employerId = req.user.id;

        const updates = {...req.body };

        // Map camelCase → snake_case
        if (updates.requiredSkills) {
            updates.required_skills = updates.requiredSkills;
            delete updates.requiredSkills;
        }
        if (updates.noticePeriod) {
            updates.notice_period = updates.noticePeriod;
            delete updates.noticePeriod;
        }
        if (updates.screeningQuestions) {
            updates.screening_questions = updates.screeningQuestions;
            delete updates.screeningQuestions;
        }

        const { data, error } = await supabase
            .from("jobs")
            .update(updates)
            .eq("id", jobId)
            .eq("employerid", employerId)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ error: "Job not found" });
        }

        res.json({ message: "Job updated ✔", job: data });
    } catch (err) {
        console.error("Update job error →", err.message);
        res.status(500).json({ error: "Failed to update job" });
    }
});

// ----------------------------------------
// 📌 4️⃣ DELETE JOB
// ----------------------------------------
router.delete("/jobs/:jobId", auth, isEmployer, async(req, res) => {
    try {
        const jobId = parseInt(req.params.jobId, 10);
        const employerId = req.user.id;

        const { error } = await supabase
            .from("jobs")
            .delete()
            .eq("id", jobId)
            .eq("employerid", employerId);

        if (error) return res.status(400).json({ error: error.message });

        res.json({ message: "Job deleted successfully ✔" });
    } catch (err) {
        console.error("Delete job error →", err.message);
        res.status(500).json({ error: "Failed to delete job" });
    }
});

// ----------------------------------------
// 👥 5️⃣ VIEW APPLICANTS
// ----------------------------------------
router.get("/applicants/:jobId", auth, isEmployer, async(req, res) => {
    try {
        const jobId = parseInt(req.params.jobId, 10);
        const employerId = req.user.id;

        // Verify ownership
        const { data: job, error: jobError } = await supabase
            .from("jobs")
            .select("id, employerid, screening_questions, title")
            .eq("id", jobId)
            .eq("employerid", employerId)
            .single();

        if (jobError || !job) {
            return res.status(403).json({ error: "Unauthorized job access" });
        }

        const { data: applicants, error } = await supabase
            .from("applications")
            .select(
                `
                seekerid,
                status,
                answers,
                seekers:seekerid (
                    name, email, phone, skills, education, cvfilename
                )
            `
            )
            .eq("jobid", jobId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        const formatted = applicants.map((a) => ({
            ...a.seekers,
            seekerId: a.seekerid,
            status: a.status,
            answers: a.answers,
        }));

        res.json({
            jobTitle: job.title,
            screeningQuestions: job.screening_questions,
            applicants: formatted,
        });
    } catch (err) {
        console.error("View applicants error →", err.message);
        res.status(500).json({ error: "Failed to load applicants" });
    }
});

// ----------------------------------------
// 📝 6️⃣ UPDATE APPLICATION STATUS
// ----------------------------------------
router.put("/applicants/status", auth, isEmployer, async(req, res) => {
    try {
        const { seekerId, jobId, newStatus } = req.body;
        const employerId = req.user.id;

        if (!seekerId || !jobId || !newStatus) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Check job ownership
        const { data: job, error: jobError } = await supabase
            .from("jobs")
            .select("id")
            .eq("id", jobId)
            .eq("employerid", employerId)
            .single();

        if (jobError || !job) {
            return res.status(403).json({ error: "Unauthorized action" });
        }

        const { data, error } = await supabase
            .from("applications")
            .update({ status: newStatus })
            .eq("jobid", jobId)
            .eq("seekerid", seekerId)
            .select()
            .single();

        if (error || !data) {
            return res.status(400).json({ error: "Failed to update status" });
        }

        res.json({ message: "Status updated ✔", application: data });
    } catch (err) {
        console.error("Update status error →", err.message);
        res.status(500).json({ error: "Failed to update status" });
    }
});

// ----------------------------------------
export default router;