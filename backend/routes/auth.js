// --- Backend: routes/auth.js (REPLACE ENTIRE FILE) ---
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';

const router = express.Router();
const saltRounds = 10;

// Signup
router.post('/signup', async(req, res) => {
    const { name, email, password, role, phone } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password is required for signup.' });
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

        // FIX: CHANGED COLUMN NAMES TO SNAKE_CASE FOR SUPABASE/POSTGRES
        cv_file_name: '',
        job_post_count: 0,

        // subscription and subscription_status remain snake_case for DB
        subscription: (role === 'employer') ?
            { active: true, plan: 'buzz' } :
            { active: false, plan: 'none' },
        subscription_status: (role === 'employer') ? 'buzz' : 'none'
    };

    if (email === "admin@hirehive.com") profileData.role = "admin";

    const { data, error } = await supabase
        .from('users')
        .insert([profileData])
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'User with this email already exists.' });
        }
        return res.status(400).json({ error: error.message });
    }

    // Prepare user data without password for frontend
    // NOTE: The data returned here still uses snake_case, which is fine for the client's current setup.
    const { password: userPassword, ...userData } = data;

    const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Signup successful', token, user: userData });
});

// Login
router.post('/login', async(req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !data) return res.status(400).json({ error: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, data.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials.' });

    const { password: userPassword, ...userData } = data;

    const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', token, user: userData });
});

export default router;