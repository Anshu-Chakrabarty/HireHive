import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';

const router = express.Router();
const saltRounds = 10;

// Signup
router.post('/signup', async(req, res) => {
    const { name, email, password, role, phone } = req.body; // Added 'phone' for future use/profile data

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Prepare profile defaults based on role
    let profileData = {
        name,
        email,
        phone, // Include phone from the frontend for OTP login later
        password: hashedPassword,
        role,
        skills: [],
        education: '',
        cvFileName: '',
        // Initialize subscription status (needed for employer dashboard)
        subscription: (role === 'employer') ? { active: false, plan: 'basic' } : { active: false, plan: 'none' }
    };

    // Safety check for admin role (should ideally be done with a separate backend key)
    if (email === "admin@hirehive.com") profileData.role = "admin";

    const { data, error } = await supabase
        .from('users')
        .insert([profileData])
        .select()
        .single();

    if (error) {
        // Handle unique constraint violation (user already exists)
        if (error.code === '23505') {
            return res.status(409).json({ error: 'User with this email already exists.' });
        }
        return res.status(400).json({ error: error.message });
    }

    // Generate JWT and send success response
    const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Signup successful', token, user: data });
});

// Login (remains the same)
router.post('/login', async(req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !data) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, data.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });

    // Ensure the returned user object doesn't include the hashed password for security
    const { password: userPassword, ...userData } = data;

    const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Send back the user data (without password) and the token
    res.json({ message: 'Login successful', token, user: userData });
});

export default router;