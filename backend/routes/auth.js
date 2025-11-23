import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../db.js";
import fetch from "node-fetch";

const router = express.Router();
const saltRounds = 10;
const VALID_ROLES = ["seeker", "employer"];

// ---------------- ENV CONFIG ----------------
const CLIENT_ORIGIN = "https://hirehive.vercel.app";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = `${process.env.BACKEND_URL}/api/auth/google/callback`;

// ---------------- HELPERS ----------------
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: "1d",
    });
};

// 🔒 Middleware — Secure JWT Protection
export const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // ✅ Fixed condition (no weird ? . syntax)
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No auth token provided" });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};

// -------------------------------------------------------
// 🔹 SIGNUP
// -------------------------------------------------------
router.post("/signup", async(req, res) => {
    try {
        const { name, email, password, role, phone, companyName } = req.body;

        if (!name || !email || !password || !role || !phone) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: "Invalid user role" });
        }

        if (role === "employer" && (!companyName || companyName.trim() === "")) {
            return res.status(400).json({ error: "Company name required" });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const profileData = {
            name,
            email,
            phone,
            password: hashedPassword,
            role,
            skills: [],
            education: "",
            cvfilename: "",
            company_name: role === "employer" ? companyName : null,
            jobpostcount: 0,
            subscriptionstatus: role === "employer" ? "buzz" : "none",
            subscription_jsonb: {
                active: role === "employer",
                plan: role === "employer" ? "buzz" : "none",
            },
            is_verified: false,
            google_id: null,
        };

        // Make this email admin
        if (email === "admin@hirehive.com") profileData.role = "admin";

        const { data, error } = await supabase
            .from("users")
            .insert([profileData])
            .select("id, name, role, email")
            .single();

        if (error) {
            if (error.code === "23505") {
                return res.status(409).json({ error: "User already exists" });
            }
            return res.status(400).json({ error: error.message });
        }

        const token = generateToken(data.id, data.role);
        res.json({ message: "Signup successful", token, user: data });
    } catch (err) {
        console.error("Signup Error:", err.message);
        res.status(500).json({ error: "Signup failed" });
    }
});

// -------------------------------------------------------
// 🔹 LOGIN
// -------------------------------------------------------
router.post("/login", async(req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email & password required" });
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (error || !user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        if (!user.password) {
            return res.status(400).json({ error: "Login using Google" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ error: "Invalid credentials" });

        delete user.password;
        const token = generateToken(user.id, user.role);

        res.json({ message: "Login successful", token, user });
    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).json({ error: "Login failed" });
    }
});

// -------------------------------------------------------
// 🔹 FORGOT PASSWORD (Simulation for now)
// -------------------------------------------------------
router.post("/forgot-password", async(req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email required" });
        }

        const { data: user } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (user) {
            console.log(`[PASSWORD RESET LINK SENT] → ${email}`);
            // Here in future you can send an actual email
        }

        res.json({
            message: "If account exists, reset link has been sent. Check your inbox.",
        });
    } catch (err) {
        console.error("Forgot Password Error:", err.message);
        res.status(500).json({ error: "Something went wrong" });
    }
});

// -------------------------------------------------------
// 🔹 GOOGLE LOGIN
// -------------------------------------------------------

// Step 1 — Redirect user to Google Auth
router.get("/google/login", (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.redirect(`${CLIENT_ORIGIN}/#error=GoogleAuthNotConfigured`);
    }

    const url =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${GOOGLE_CALLBACK_URL}` +
        `&response_type=code&scope=openid%20email%20profile`;

    res.redirect(url);
});

// Step 2 — Handle callback
router.get("/google/callback", async(req, res) => {
    try {
        const { code } = req.query;

        if (!code) return res.redirect(`${CLIENT_ORIGIN}/#error=AuthFailed`);

        // Exchange Code for Access Token
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_CALLBACK_URL,
                grant_type: "authorization_code",
            }),
        });

        const tokens = await tokenRes.json();
        const accessToken = tokens.access_token;
        if (!accessToken) throw new Error("No access token returned");

        // Get Profile
        const profileRes = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        const profile = await profileRes.json();

        if (!profile.email) {
            throw new Error("Google missing email");
        }

        // Find or create user
        const USER_FIELDS =
            "id, role, name, email, company_name, subscriptionstatus";

        let { data: user } = await supabase
            .from("users")
            .select(USER_FIELDS)
            .or(`google_id.eq.${profile.id},email.eq.${profile.email}`)
            .maybeSingle();

        if (!user) {
            const newUser = {
                name: profile.name,
                email: profile.email,
                google_id: profile.id,
                role: "seeker",
                is_verified: true,
                subscriptionstatus: "none",
                subscription_jsonb: { active: false, plan: "none" },
            };

            const { data: inserted } = await supabase
                .from("users")
                .insert([newUser])
                .select(USER_FIELDS)
                .single();

            user = inserted;
        }

        const token = generateToken(user.id, user.role);

        return res.redirect(`${CLIENT_ORIGIN}/#google_token=${token}`);
    } catch (err) {
        console.error("Google Auth Error →", err.message);
        res.redirect(`${CLIENT_ORIGIN}/#error=GoogleAuthFailed`);
    }
});

// -------------------------------------------------------
// 🔹 GET LOGGED IN USER DATA
// -------------------------------------------------------
router.get("/me", protect, async(req, res) => {
    const { id } = req.user;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !data) {
        return res.status(404).json({ error: "User not found" });
    }

    delete data.password;
    res.json({ user: data });
});

export default router;