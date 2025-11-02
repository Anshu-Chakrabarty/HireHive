import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';

const router = express.Router();
const saltRounds = 10;
const VALID_ROLES = ['seeker', 'employer'];

// Signup
router.post('/signup', async(req, res) => {
    const { name, email, password, role, phone } = req.body;

    // CRITICAL: Server-side validation for all required fields
    if (!name || !email || !password || !role || !phone) {
        return res.status(400).json({ error: 'Missing required signup fields.' });
    }

    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid user role specified.' });
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    let profileData = {
        name,
        email,
        phone,
        password: hashedPassword,
        role,
        skills: [],
        education: '',

        // REVERTED to match SQL schema: all-lowercase column names
        cvfilename: '',
        jobpostcount: 0,

        subscription: (role === 'employer') ? { active: true, plan: 'buzz' } : { active: false, plan: 'none' },

        // REVERTED to match SQL schema: all-lowercase column name
        subscriptionstatus: (role === 'employer') ? 'buzz' : 'none'
    };

    // Admin role assignment (for initial setup)
    if (email === "admin@hirehive.com") profileData.role = "admin";

    const { data, error } = await supabase
        .from('users')
        .insert([profileData])
        .select()
        .single();

    if (error) {
        console.error("Supabase signup error:", error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'User with this email already exists.' });
        }
        return res.status(400).json({ error: error.message });
    }

    // Exclude password from the returned user object
    const { password: userPassword, ...userData } = data;

    const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Signup successful', token, user: userData });
});

// Login
router.post('/login', async(req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required for login.' });
    }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !data) {
        console.error("Login attempt error:", error ? error.message : "User not found");
        return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, data.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials.' });

    // Exclude password from the returned user object
    const { password: userPassword, ...userData } = data;

    const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', token, user: userData });
});

export default router;