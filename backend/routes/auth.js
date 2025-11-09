import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../db.js";
import fetch from 'node-fetch'; // Required for making API calls to Google

const router = express.Router();
const saltRounds = 10;
const VALID_ROLES = ["seeker", "employer"];

// --- GOOGLE OAUTH CONFIG (Set in Render Environment Variables) ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'https://hirehive.vercel.app';
const REDIRECT_URI = `${CLIENT_ORIGIN}/#callback`; // Must match Google Console setting

// ------------------------------------------------------------------
// JWT HELPERS
// ------------------------------------------------------------------

const protect = (req, res, next) => {
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { id: decoded.id, role: decoded.role };
            next();
        } catch (error) {
            console.error("JWT verification failed:", error.message);
            return res.status(401).json({ error: "Not authorized, token failed" });
        }
    }
    if (!token) {
        return res.status(401).json({ error: "Not authorized, no token" });
    }
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

    if (!name || !email || !password || !role || !phone) {
        return res.status(400).json({ error: "Missing required signup fields." });
    }

    if (role === "employer" && (!companyName || companyName.trim() === "")) {
        return res
            .status(400)
            .json({ error: "Company Name is required for employers." });
    }

    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: "Invalid user role specified." });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    let profileData = {
        name,
        email,
        phone,
        password: hashedPassword,
        role,
        skills: [],
        education: "",
        company_name: role === "employer" ? companyName : null, // Uses corrected SQL column name
        cvfilename: "",
        jobpostcount: 0,
        subscription_jsonb: role === "employer" ? { active: true, plan: "buzz" } : { active: false, plan: "none" },
        subscriptionstatus: role === "employer" ? "buzz" : "none",
    };

    if (email === "admin@hirehive.com") profileData.role = "admin";

    const { data, error } = await supabase
        .from("users")
        .insert([profileData])
        .select()
        .single();

    if (error) {
        console.error("Supabase signup error:", error);
        if (error.code === "23505") {
            return res
                .status(409)
                .json({ error: "User with this email already exists." });
        }
        return res.status(400).json({ error: error.message });
    }

    const { password: userPassword, ...userData } = data;
    const token = generateToken(data.id, data.role);

    res.json({ message: "Signup successful", token, user: userData });
});

// POST: Standard Login
router.post("/login", async(req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res
            .status(400)
            .json({ error: "Email and password are required for login." });
    }

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

    if (error || !data) {
        console.warn("Login failed: Invalid email or password attempt.");
        return res.status(400).json({ error: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, data.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials." });

    const { password: userPassword, ...userData } = data;
    const token = generateToken(data.id, data.role);

    res.json({ message: "Login successful", token, user: userData });
});


// ------------------------------------------------------------------
// NEW: GOOGLE OAUTH ROUTES (REPLACES OTP FLOW)
// ------------------------------------------------------------------

// 1. Initiate Google Login (Frontend directs here)
router.get('/google/login', (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        console.error("GOOGLE OAUTH CONFIG MISSING!");
        return res.redirect(`${CLIENT_ORIGIN}/#error=Google+Configuration+Missing`);
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${REDIRECT_URI}&` +
        `response_type=code&` +
        `scope=profile email&` +
        `access_type=offline&` +
        `prompt=consent`;

    res.redirect(authUrl);
});


// 2. Handle Google Callback (Google redirects here with code)
router.get('/google/callback', async(req, res) => {
    const code = req.query.code;
    const error = req.query.error;

    if (error) {
        return res.redirect(`${CLIENT_ORIGIN}/#error=${error}`);
    }
    if (!code) {
        return res.redirect(`${CLIENT_ORIGIN}/#error=AuthCodeMissing`);
    }

    try {
        // Step A: Exchange Authorization Code for Tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            }).toString(),
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) throw new Error("Failed to get access token from Google.");

        // Step B: Use Access Token to Get User Profile Info
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const profile = await profileResponse.json();

        if (!profile || !profile.id || !profile.email) throw new Error("Failed to retrieve profile from Google.");

        // Step C: Check Database (Login or Register)

        // Check for existing user by Google ID or Email
        let { data: user, error: dbError } = await supabase
            .from('users')
            .select('*')
            .or(`google_id.eq.${profile.id},email.eq.${profile.email}`)
            .single();

        if (dbError && dbError.code !== 'PGRST116') { // PGRST116 = No rows found
            console.error("Supabase lookup error during Google auth:", dbError);
            throw new Error("Database lookup failed.");
        }

        if (!user) {
            // NEW USER: Create account using Google data
            const newUser = {
                name: profile.name,
                email: profile.email,
                password: await bcrypt.hash(profile.id, saltRounds), // Use Google ID as temporary password
                google_id: profile.id, // Store unique Google ID (requires new DB column)
                role: 'seeker', // Default to seeker for new users
                is_verified: true,
                subscription_jsonb: { active: false, plan: "none" },
                subscriptionstatus: "none",
                jobpostcount: 0
            };

            const { data: insertedUser } = await supabase
                .from('users')
                .insert([newUser])
                .select()
                .single();
            user = insertedUser;
        }

        // Step D: Finalize Login (Generate App JWT)
        if (!user) throw new Error("User record could not be created or found.");

        const appToken = generateToken(user.id, user.role);

        // Redirect back to frontend with app-specific JWT token in the hash
        res.redirect(`${CLIENT_ORIGIN}/#google_token=${appToken}`);

    } catch (error) {
        console.error("Google Auth Final Error:", error.message);
        res.redirect(`${CLIENT_ORIGIN}/#error=GoogleAuthFailed`);
    }
});


// GET: Fetch current user profile using JWT (remains the same)
router.get("/me", protect, async(req, res) => {
    const userId = req.user.id;
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !data) {
        console.error("Fetch user data error:", error ? error.message : "User data not found");
        return res.status(404).json({ error: "User not found" });
    }

    const { password, ...userData } = data;
    res.json({ user: userData });
});

export default router;