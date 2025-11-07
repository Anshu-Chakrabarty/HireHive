import express from 'express';

const router = express.Router();

// Route to handle contact form submissions
router.post('/', (req, res) => {
    const { name, email, message } = req.body;

    // --- Basic Validation ---
    if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message fields are required." });
    }

    // --- Enhanced Validation: Check Email Format ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format. Please check your entry." });
    }

    // --- SECURITY STEP: Input Sanitization Placeholder ---
    const sanitizedName = name.trim();
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedMessage = message.trim();

    // --- LOGIC SIMULATION ---
    console.log(`\n--- CONTACT FORM RECEIVED ---`);
    console.log(`From: ${sanitizedName} <${sanitizedEmail}>`);
    console.log(`Message Snippet: ${sanitizedMessage.substring(0, 50)}...`);
    console.log(`-----------------------------\n`);

    /* In a live application, this section would contain code to:
       1. Save the message to Supabase.
       2. Use Nodemailer/SendGrid to send an internal email notification.
    */

    // Respond with success. 202 (Accepted) is perfect for asynchronous processing.
    res.status(202).json({
        message: "Contact message successfully received and forwarded to the support team."
    });
});

export default router;