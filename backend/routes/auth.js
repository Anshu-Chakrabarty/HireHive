import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../db.js";

const router = express.Router();
const saltRounds = 10;
const VALID_ROLES = ["seeker", "employer"];

// ------------------------------------------------------------------
// LOCAL MIDDLEWARE (Defined here to support /me and general auth)
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
            return res.status(401).json({ error: "Not authorized, token failed" });
        }
    }

    if (!token) {
        return res.status(401).json({ error: "Not authorized, no token" });
    }
};
// ------------------------------------------------------------------

// MODIFIED Signup
router.post("/signup", async(req, res) => {
    // ADDED companyName
    const { name, email, password, role, phone, companyName } = req.body;

    if (!name || !email || !password || !role || !phone) {
        return res.status(400).json({ error: "Missing required signup fields." });
    }

    // NEW validation for employer company name
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

        // ADDED companyname field for Supabase
        companyname: role === "employer" ? companyName : null,

        cvfilename: "",
        jobpostcount: 0,

        subscription_jsonb: role === "employer" ?
            { active: true, plan: "buzz" } :
            { active: false, plan: "none" },
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

    const token = jwt.sign({ id: data.id, role: data.role },
        process.env.JWT_SECRET, { expiresIn: "1d" }
    );
    res.json({ message: "Signup successful", token, user: userData });
});

// Login
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
        console.error(
            "Login attempt error:",
            error ? error.message : "User not found"
        );
        return res.status(400).json({ error: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, data.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials." });

    const { password: userPassword, ...userData } = data;

    const token = jwt.sign({ id: data.id, role: data.role },
        process.env.JWT_SECRET, { expiresIn: "1d" }
    );
    res.json({ message: "Login successful", token, user: userData });
});

// Fetch current user profile using JWT
router.get("/me", protect, async(req, res) => {
    const userId = req.user.id;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !data) {
        console.error(
            "Fetch user data error:",
            error ? error.message : "User data not found"
        );
        return res.status(404).json({ error: "User not found" });
    }

    const { password, ...userData } = data;
    res.json({ user: userData });
});

export default router;