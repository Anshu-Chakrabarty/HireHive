import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../db.js";
import fetch from 'node-fetch';
import { sendWelcomeEmail } from '../utils/emailService.js'; // <--- NEW IMPORT

const router = express.Router();
const saltRounds = 10;
const VALID_ROLES = ["seeker", "employer"];

// --- GOOGLE OAUTH CONFIG ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'https://hirehive.vercel.app';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_REDIRECT_URL || 'http://localhost:5005/api/auth/google/callback';

// ------------------------------------------------------------------
// JWT HELPERS
// ------------------------------------------------------------------

export const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { id: decoded.id, role: decoded.role };
            next();
        } catch (error) {
            // Send 401 with "expired" hint so app.js knows to clear localStorage
            return res.status(401).json({ error: "Session expired. Please log in again." });
        }
    }
    if (!token) return res.status(401).json({ error: "No token provided." });
};

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

// ------------------------------------------------------------------
// STANDARD AUTH ROUTES 
// ------------------------------------------------------------------

// POST: Standard Signup
router.post("/signup", async(req, res) => {
    const { name, email, password, role, phone, companyName } = req.body;

    if (!name || !email || !password || !role || !phone) { return res.status(400).json({ error: "Missing required signup fields." }); }
    if (role === "employer" && (!companyName || companyName.trim() === "")) { return res.status(400).json({ error: "Company Name is required for employers." }); }
    if (!VALID_ROLES.includes(role)) { return res.status(400).json({ error: "Invalid user role specified." }); }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Set initial subscription based on role, using 'buzz' for new employers
    const initialSubscriptionStatus = role === "employer" ? "buzz" : "none";
    const initialSubscriptionJson = role === "employer" ? { active: true, plan: "buzz" } : { active: false, plan: "none" };

    let profileData = { name, email, phone, password: hashedPassword, role, skills: [], education: "", cvfilename: "", company_name: role === "employer" ? companyName : null, jobpostcount: 0, subscription_jsonb: initialSubscriptionJson, subscriptionstatus: initialSubscriptionStatus, google_id: null, };

    if (email === "admin@hirehive.in") profileData.role = "admin";

    const { data, error } = await supabase.from("users").insert([profileData]).select(`id, name, email, role, phone, skills, education, cvfilename, company_name, jobpostcount, subscriptionstatus, google_id, created_at`).single();

    if (error) { console.error("Supabase signup error:", error); if (error.code === "23505") { return res.status(409).json({ error: "User with this email already exists." }); } return res.status(400).json({ error: error.message }); }

    // --- NEW: SEND EMAIL ---
    // We assume successful DB insert means we can send email. 
    // Not awaiting it strictly to ensure fast response.
    try {
        sendWelcomeEmail(data.email, data.name, data.role);
    } catch (emailErr) {
        console.error("Failed to send welcome email:", emailErr);
    }
    // -----------------------

    const token = generateToken(data.id, data.role);
    res.json({ message: "Signup successful", token, user: data });
});

// POST: Standard Login
router.post("/login", async(req, res) => {
    const { email, password } = req.body;

    if (!email || !password) { return res.status(400).json({ error: "Email and password are required for login." }); }

    const { data, error } = await supabase.from("users").select(`id, role, password, google_id, name, email, phone, skills, education, cvfilename, company_name, jobpostcount, subscriptionstatus, created_at`).eq("email", email).single();

    if (error || !data) { return res.status(400).json({ error: "Invalid credentials." }); }

    if (!data.password) { return res.status(400).json({ error: "Account created via Google. Please use the 'Sign In with Google' button." }); }

    const match = await bcrypt.compare(password, data.password);

    if (!match) { return res.status(400).json({ error: "Invalid credentials." }); }

    const { password: userPassword, ...userData } = data; // Remove password before sending

    const token = generateToken(data.id, data.role);

    res.json({ message: "Login successful", token, user: userData });
});

// 🚀 NEW: Forgot Password Request Endpoint
router.post("/forgot-password", async(req, res) => {
    const { email } = req.body;

    if (!email) { return res.status(400).json({ error: "Email is required to reset password." }); }

    const { data: user, error: dbError } = await supabase.from("users").select(`id`).eq("email", email).maybeSingle();

    if (dbError) { console.error("Supabase reset lookup error:", dbError); return res.status(500).json({ error: "A server error occurred during lookup." }); }

    if (user) {
        console.log(`[PASSWORD RESET] Simulated reset link sent to ${email}.`); // If using Supabase Auth: await supabase.auth.resetPasswordForEmail(email, { redirectTo: CLIENT_ORIGIN + '/reset-password' });
    } else { console.log(`[PASSWORD RESET] Attempted reset for unknown email: ${email}.`); }

    res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent. Check your inbox!" });
});


// ------------------------------------------------------------------
// NEW: GOOGLE OAUTH ROUTES 
// ------------------------------------------------------------------

// 1. Initiate Google Login
router.get('/google/login', (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) { return res.redirect(`${CLIENT_ORIGIN}/#error=Google+Configuration+Missing`); }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + `client_id=${GOOGLE_CLIENT_ID}&` + `redirect_uri=${GOOGLE_CALLBACK_URL}&` + `response_type=code&` + `scope=profile email&` + `access_type=offline&` + `prompt=consent`;

    res.redirect(authUrl);
});


// 2. Handle Google Callback
router.get('/google/callback', async(req, res) => {
    const code = req.query.code;
    const error = req.query.error;

    if (error) { return res.redirect(`${CLIENT_ORIGIN}/#error=${error}`); }
    if (!code) { return res.redirect(`${CLIENT_ORIGIN}/#error=AuthCodeMissing`); }

    try { // Step A & B: Exchange Code & Get Profile Info

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: GOOGLE_CALLBACK_URL, grant_type: 'authorization_code', }).toString(), });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        if (!accessToken) throw new Error("Failed to get access token from Google.");

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const profile = await profileResponse.json();
        if (!profile || !profile.id || !profile.email) throw new Error("Failed to retrieve profile from Google.");

        // Step C: Check Database (Login or Register)

        const USER_SELECT_FIELDS = `id, role, name, email, phone, skills, education, cvfilename, company_name, jobpostcount, subscriptionstatus, google_id, created_at`;

        let { data: user, error: dbError } = await supabase.from('users').select(USER_SELECT_FIELDS).or(`google_id.eq.${profile.id},email.eq.${profile.email}`).single();

        if (dbError && dbError.code !== 'PGRST116') { console.error("Supabase lookup error during Google auth:", dbError); throw new Error("Database lookup failed."); }

        if (!user) {
            // NEW USER: Create account
            let role = 'seeker';

            // Auto-assign Admin role for specific email
            if (profile.email === "admin@hirehive.in") {
                role = 'admin';
            }

            const newUser = {
                name: profile.name,
                email: profile.email,
                password: await bcrypt.hash(profile.id, saltRounds),
                google_id: profile.id,
                role: role, // Use the dynamic role variable
                is_verified: true,
                subscription_jsonb: role === 'employer' ? { active: true, plan: "buzz" } : { active: false, plan: "none" },
                subscriptionstatus: role === 'employer' ? "buzz" : "none",
                jobpostcount: 0
            };

            const { data: insertedUser } = await supabase.from('users').insert([newUser]).select(USER_SELECT_FIELDS).single();
            user = insertedUser;

            // --- NEW: SEND GOOGLE WELCOME EMAIL ---
            try {
                sendWelcomeEmail(user.email, user.name, user.role);
            } catch (emailErr) {
                console.error("Failed to send Google welcome email:", emailErr);
            }
            // -------------------------------------

        } else if (!user.google_id) { // Existing password user linking Google ID

            const { error: updateError } = await supabase.from('users').update({ google_id: profile.id, is_verified: true }).eq('id', user.id);

            if (updateError) console.error("Failed to link Google ID to existing user:", updateError);
            user.google_id = profile.id;
            user.is_verified = true;
        }

        // Step D: Finalize Login (Generate App JWT)

        if (!user) throw new Error("User record could not be created or found.");

        const appToken = generateToken(user.id, user.role);

        res.redirect(`${CLIENT_ORIGIN}/#google_token=${appToken}`);

    } catch (error) {
        console.error("Google Auth Final Error:", error.message);
        res.redirect(`${CLIENT_ORIGIN}/#error=GoogleAuthFailed`);
    }
});


// GET: Fetch current user profile using JWT (omitted for brevity)
router.get("/me", protect, async(req, res) => {
    const userId = req.user.id;
    const { data, error } = await supabase.from("users").select(`id, role, name, email, phone, skills, education, cvfilename, company_name, jobpostcount, subscriptionstatus, google_id, created_at`).eq("id", userId).single();

    if (error || !data) { console.error("Fetch user data error:", error ? error.message : "User data not found"); return res.status(401).json({ error: "Session invalid or user not found. Please log in again." }); }

    res.json({ user: data });
});

export default router;