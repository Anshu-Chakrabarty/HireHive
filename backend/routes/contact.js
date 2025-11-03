import express from 'express';

const router = express.Router();

// Route to handle contact form submissions
router.post('/', (req, res) => {
    const { name, email, message } = req.body;

    // --- Basic Validation ---
    if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message fields are required." });
    }

    // --- LOGIC SIMULATION ---
    /* In a live application, this section would contain code to:
    1. Sanitize the inputs (to prevent XSS or injection).
    2. Save the message to a 'contact_inquiries' table in Supabase.
    3. Use a service like Nodemailer or SendGrid to send an internal email notification 
       to your support team (e.g., support@hirehive.com).
    */
    console.log(`\n--- CONTACT FORM RECEIVED ---`);
    console.log(`From: ${name} <${email}>`);
    console.log(`Message Snippet: ${message.substring(0, 50)}...`);
    console.log(`-----------------------------\n`);

    // Respond with success. The HTTP 202 status code is often used for accepted 
    // requests that will be processed asynchronously (like sending an email).
    res.status(202).json({
        message: "Contact message successfully received and forwarded to the support team."
    });
});

export default router;