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

    if (!name || !email || !password || !role || !phone) {
        return res.status(400).json({ error: 'Missing required signup fields.' });
    }

    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid user role specified.' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    let profileData = {
        name,
        email,
        phone,
        password: hashedPassword,
        role,
        skills: [],
        education: '',

        cvfilename: '',
        jobpostcount: 0,

        // CRITICAL FIX: Renamed 'subscription' to 'subscription_jsonb' to match SQL schema
        subscription_jsonb: (role === 'employer') ? { active: true, plan: 'buzz' } : { active: false, plan: 'none' },

        // This is correct as it matches the all-lowercase SQL column
        subscriptionstatus: (role === 'employer') ? 'buzz' : 'none'
    };

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

    const { password: userPassword, ...userData } = data;

    const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', token, user: userData });
});

export default router;