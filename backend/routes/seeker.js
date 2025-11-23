import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import { supabase } from "../db.js";

const router = express.Router();

// -----------------------------------------
// 🔐 AUTH MIDDLEWARE
// -----------------------------------------
const auth = (req, res, next) => {
    const authHeader = req.headers && req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "No authentication token" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("JWT Verify Error:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};

const isSeeker = (req, res, next) => {
    const role = req.user && req.user.role;
    if (!["seeker", "admin"].includes(role)) {
        return res.status(403).json({ error: "Seeker access required" });
    }
    next();
};

// -----------------------------------------
// 📄 CV Upload Config: Memory storage
// -----------------------------------------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB Max
});

// -----------------------------------------
// ✍️ 1️⃣ Update Profile
// -----------------------------------------
router.put(
    "/profile",
    auth,
    isSeeker,
    upload.single("cvFile"),
    async(req, res) => {
        try {
            const userId = req.user.id;
            const { name, education, skills } = req.body;

            if (!name || !education || skills === undefined) {
                return res
                    .status(400)
                    .json({ error: "Required fields missing" });
            }

            const updateData = {
                name,
                education,
                skills: String(skills)
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
            };

            // 📂 If CV uploaded, upload to Supabase Storage
            if (req.file) {
                const file = req.file;
                const safeFile = file.originalname.replace(/[^\w.-]/g, "_");
                const cvPath = `cvs/${userId}_${Date.now()}_${safeFile}`;

                const { error: uploadError } = await supabase.storage
                    .from("cvs")
                    .upload(cvPath, file.buffer, {
                        contentType: file.mimetype,
                        upsert: true,
                    });

                if (uploadError) {
                    console.error("CV Upload Error:", uploadError.message);
                    return res.status(500).json({
                        error: "CV upload failed. Try again with a valid PDF under 5 MB.",
                    });
                }

                updateData.cvfilename = cvPath;
            }

            // DB Update
            const { data, error } = await supabase
                .from("users")
                .update(updateData)
                .eq("id", userId)
                .select("*")
                .single();

            if (error) {
                return res.status(400).json({ error: error.message });
            }

            if (data && data.password) {
                delete data.password;
            }

            return res.json({ message: "Profile updated", user: data });
        } catch (err) {
            console.error("Profile Update Error:", err.message);
            return res
                .status(500)
                .json({ error: "Failed to update profile" });
        }
    }
);

// -----------------------------------------
// 🔍 2️⃣ Browse Jobs (Filter + Search)
// -----------------------------------------
router.get("/jobs", auth, isSeeker, async(req, res) => {
    try {
        const { location, salary, experience, category, keywords } = req.query;

        let query = supabase
            .from("jobs")
            .select("*, employer:employerid (name)")
            .order("posteddate", { ascending: false });

        if (location) {
            query = query.ilike("location", "%" + location + "%");
        }
        if (salary) {
            query = query.ilike("salary", "%" + salary + "%");
        }
        if (category) {
            query = query.eq("category", category);
        }

        if (experience && experience !== "0") {
            const years = parseInt(experience, 10);
            if (!isNaN(years)) {
                // Example: match "2+" or "2-3 years" etc.
                query = query.or(
                    "experience.ilike.%"
                    .concat(years.toString())
                    .concat("+%,experience.ilike.%")
                    .concat(years.toString())
                    .concat("-%")
                );
            }
        }

        if (keywords) {
            const terms = String(keywords)
                .split(" ")
                .map((t) => t.trim())
                .filter(Boolean);

            // Build single OR string for all terms
            if (terms.length > 0) {
                const orParts = [];
                terms.forEach((term) => {
                    orParts.push("title.ilike.%" + term + "%");
                    orParts.push("description.ilike.%" + term + "%");
                    // If you are storing required_skills as text/array:
                    // orParts.push("required_skills.ilike.%" + term + "%");
                });

                const orString = orParts.join(",");
                query = query.or(orString);
            }
        }

        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        return res.json(data || []);
    } catch (err) {
        console.error("Job Search Error:", err.message);
        return res.status(500).json({ error: "Failed to load jobs" });
    }
});

// -----------------------------------------
// 🧩 3️⃣ Application History + Suggestions
// -----------------------------------------
router.get("/applications", auth, isSeeker, async(req, res) => {
    try {
        const seekerId = req.user.id;

        // Fetch applied jobs for THIS seeker
        const { data: apps, error: appsError } = await supabase
            .from("applications")
            .select("jobid, status, seekerid")
            .eq("seekerid", seekerId);

        if (appsError) {
            console.error("Applications Fetch Error:", appsError.message);
            return res.status(400).json({ error: appsError.message });
        }

        const appsList = apps || [];
        const appliedJobIds = appsList.map((a) => a.jobid);
        const shortlistedJobIds = appsList
            .filter((a) => a.status === "Shortlisted")
            .map((a) => a.jobid);

        // All jobs
        const { data: jobs, error: jobsError } = await supabase
            .from("jobs")
            .select("*, employer:employerid (name)");

        if (jobsError) {
            console.error("Jobs Fetch Error:", jobsError.message);
            return res.status(400).json({ error: jobsError.message });
        }

        const jobsList = jobs || [];

        // Fetch seeker skills
        const { data: seeker, error: seekerError } = await supabase
            .from("users")
            .select("skills")
            .eq("id", seekerId)
            .single();

        if (seekerError) {
            console.error("Seeker Fetch Error:", seekerError.message);
        }

        let seekerSkills = [];
        if (seeker && Array.isArray(seeker.skills)) {
            seekerSkills = seeker.skills
                .map((s) => String(s).toLowerCase())
                .filter(Boolean);
        }

        // Applied jobs with status
        const applied = jobsList
            .filter((j) => appliedJobIds.includes(j.id))
            .map((j) => {
                const app = appsList.find((a) => a.jobid === j.id);
                return {
                    ...j,
                    status: app ? app.status : "applied",
                };
            });

        // Suggested jobs based on skills
        const suggestedRaw = jobsList.filter((j) => {
            if (appliedJobIds.includes(j.id)) {
                return false;
            }

            let requiredSkills = [];
            if (Array.isArray(j.required_skills)) {
                requiredSkills = j.required_skills;
            } else if (j.required_skills) {
                // if stored as text, you can parse/split it
                requiredSkills = String(j.required_skills)
                    .split(",")
                    .map((s) => s.trim());
            }

            if (requiredSkills.length === 0 || seekerSkills.length === 0) {
                return false;
            }

            return requiredSkills.some((s) =>
                seekerSkills.includes(String(s).toLowerCase())
            );
        });

        // Put shortlisted jobs first in suggestions
        const shortlistedJobs = shortlistedJobIds
            .map((id) => jobsList.find((j) => j.id === id))
            .filter(Boolean);

        const finalSuggested = shortlistedJobs.concat(
            suggestedRaw.filter((j) => !shortlistedJobIds.includes(j.id))
        );

        return res.json({
            applied,
            suggested: finalSuggested,
        });
    } catch (err) {
        console.error("Suggestions Error:", err.message);
        return res
            .status(500)
            .json({ error: "Failed to fetch applications" });
    }
});

// -----------------------------------------
// 📨 4️⃣ Apply for a Job
// -----------------------------------------
router.post("/apply/:jobId", auth, isSeeker, async(req, res) => {
    try {
        const seekerId = req.user.id;
        const jobId = parseInt(req.params.jobId, 10);
        const body = req.body || {};
        const answers = Array.isArray(body.answers) ? body.answers : [];

        if (isNaN(jobId)) {
            return res.status(400).json({ error: "Invalid job ID" });
        }

        // Check if already applied
        const { data: existing, error: existingError } = await supabase
            .from("applications")
            .select("jobid")
            .eq("jobid", jobId)
            .eq("seekerid", seekerId);

        if (existingError) {
            console.error(
                "Existing Application Check Error:",
                existingError.message
            );
            return res.status(400).json({ error: existingError.message });
        }

        if (existing && existing.length > 0) {
            return res.status(409).json({ error: "Already applied" });
        }

        const newApp = {
            jobid: jobId,
            seekerid: seekerId,
            answers: answers,
            status: "applied",
        };

        const { error } = await supabase
            .from("applications")
            .insert([newApp]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        return res.json({ message: "Application submitted ✔" });
    } catch (err) {
        console.error("Apply Error:", err.message);
        return res.status(500).json({ error: "Failed to apply" });
    }
});

// -----------------------------------------
export default router;