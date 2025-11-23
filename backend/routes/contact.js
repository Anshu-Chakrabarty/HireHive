import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

// 📌 Contact Form Handler - Save message into DB
router.post("/", async(req, res) => {
    try {
        const { name, email, message } = req.body;

        // 1️⃣ Required Fields Check
        if (!name || !email || !message) {
            return res.status(400).json({
                error: "All fields (name, email, message) are required."
            });
        }

        // 2️⃣ Email Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email address." });
        }

        // 3️⃣ Basic Sanitization
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanMessage = message.trim();

        if (cleanMessage.length < 5) {
            return res.status(400).json({ error: "Message is too short." });
        }

        // 4️⃣ Database Save
        const { error } = await supabase
            .from("contact_messages")
            .insert([{
                name: cleanName,
                email: cleanEmail,
                message: cleanMessage,
                status: "new"
            }]);

        if (error) {
            console.error("Contact form save error:", error);
            return res.status(500).json({ error: "Failed to save message." });
        }

        console.log(`📩 New Contact Message from ${cleanName} (${cleanEmail})`);

        // 5️⃣ Success Response
        res.status(202).json({
            message: "Message received! Our support team will respond shortly."
        });
    } catch (err) {
        console.error("Server Contact Error:", err.message);
        res.status(500).json({ error: "Internal server error." });
    }
});

export default router;