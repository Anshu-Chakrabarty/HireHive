import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../db.js";
import { startVerification, checkVerification } from "../utils/twilio.js"; // Import Twilio Verify functions

const router = express.Router();
const saltRounds = 10;
const VALID_ROLES = ["seeker", "employer"];

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
// STANDARD AUTH ROUTES (No changes needed)
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
// TWILIO VERIFY OTP FLOW
// ------------------------------------------------------------------

// POST: Initiate OTP verification (send SMS)
router.post("/send-otp", async(req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ error: "Phone number is required." });
    }

    // 1. Check if user is registered using phone number
    const { data: user, error: findError } = await supabase
        .from("users")
        .select("id")
        .eq("phone", phone)
        .single();

    if (findError || !user) {
        return res.status(404).json({ error: "Phone number not registered. Please sign up." });
    }

    // 2. Call Twilio Verify to send the code
    try {
        await startVerification(phone);
        res.json({ message: "Verification code sent successfully." });
    } catch (e) {
        // e.message contains the error thrown by the Twilio utility
        res.status(500).json({ error: e.message || "Failed to send SMS verification code." });
    }
});


// POST: Verify OTP and log in
router.post("/verify-otp", async(req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ error: "Phone number and verification code are required." });
    }

    // 1. Check code with Twilio Verify
    try {
        await checkVerification(phone, otp);

    } catch (e) {
        // This catches Twilio errors (invalid code, expired code)
        return res.status(400).json({ error: e.message || "Invalid or expired verification code." });
    }

    // 2. If Twilio approved, fetch user data and log them in
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("phone", phone)
        .single();

    if (userError || !user) {
        return res.status(500).json({ error: "User data retrieval failed after successful verification." });
    }

    // 3. Generate JWT and send success response
    const { password, ...userData } = user;
    const token = generateToken(user.id, user.role);

    res.json({ message: "Login successful via OTP", token, user: userData });
});


// GET: Fetch current user profile using JWT
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