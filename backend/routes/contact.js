import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

/**
 * 📌 Contact Form Handler
 * Saves message into DB and passes errors to global handler
 */
router.post("/", async(req, res, next) => {
    try {
        const { name, email, message } = req.body;

        // 1. Required Fields Check
        if (!name || !email || !message) {
            return res.status(400).json({
                error: "All fields (name, email, message) are required."
            });
        }

        // 2. Email Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email address." });
        }

        // 3. Basic Sanitization
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanMessage = message.trim();

        if (cleanMessage.length < 5) {
            return res.status(400).json({ error: "Message is too short." });
        }

        // 4. Database Save via Supabase
        const { error } = await supabase
            .from("contact_messages")
            .insert([{
                name: cleanName,
                email: cleanEmail,
                message: cleanMessage,
                status: "new"
            }]);

        // If Supabase returns an error, throw it to the catch block
        if (error) {
            console.error("Database Error:", error.message);
            throw error;
        }

        console.log(`📩 New Contact Message from ${cleanName}`);

        // 5. Success Response
        res.status(201).json({
            message: "Message received! Our support team will respond shortly."
        });

    } catch (err) {
        // 6. Global Error Integration
        // This passes the error to the middleware in your main index.js
        next(err);
    }
});

export default router;