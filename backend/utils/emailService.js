import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// --- BREVO (SENDINBLUE) CONFIGURATION ---
// Using Brevo SMTP Relay with Port 2525 to bypass Render/AWS firewall blocks.
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 2525, // <--- FIXED: Changed from 587 to 2525
    secure: false, // Must be false for port 2525
    auth: {
        user: process.env.EMAIL_USER, // Your Brevo Login Email
        pass: process.env.EMAIL_PASS // Your Brevo SMTP Key
    },
    tls: {
        rejectUnauthorized: false // Prevents handshake errors
    }
});

// Generic Send Function
export const sendEmail = async(to, subject, htmlContent) => {
    try {
        const mailOptions = {
            // Sends as "HireHive Team" <admin@hirehive.in>
            // Ensure admin@hirehive.in is verified in Brevo Senders list.
            from: `"HireHive Team" <admin@hirehive.in>`,
            to: to,
            subject: subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
};

// --- EMAIL TEMPLATES ---

export const sendWelcomeEmail = async(email, name, role) => {
    const subject = `Welcome to the Hive, ${name}! 🐝`;
    const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="background-color: #ffc107; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: #fff; margin: 0;">Welcome to HireHive!</h1>
            </div>
            <div style="padding: 20px; background-color: #fff;">
                <p style="font-size: 16px; color: #333;">Hi <strong>${name}</strong>,</p>
                <p style="font-size: 16px; color: #555;">We are thrilled to have you join us as a <strong>${role}</strong>.</p>
                <p style="font-size: 16px; color: #555;">
                    ${role === 'employer' 
                        ? 'You can now start posting jobs and building your dream team.' 
                        : 'Your next career move awaits! Complete your profile to get started.'}
                </p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://hirehive.in" style="background-color: #007bff; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
                </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                &copy; 2024 HireHive. All rights reserved.
            </div>
        </div>
    `;
    return sendEmail(email, subject, html);
};

export const sendJobAlertToSeekers = async(bccList, jobTitle, companyName) => {
    if (!bccList || bccList.length === 0) return;

    const subject = `New Job Alert: ${jobTitle} at ${companyName}`;
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #007bff;">New Opportunity Alert! 🚀</h2>
            <p>A new job matching your domain has just been posted.</p>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            <p><strong>Role:</strong> ${jobTitle}</p>
            <p><strong>Company:</strong> ${companyName}</p>
            <br/>
            <a href="https://hirehive.in" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Apply Now</a>
        </div>
    `;
    return sendEmail(bccList, subject, html);
};

export const sendApplicationAlertToEmployer = async(employerEmail, jobTitle, applicantName) => {
    const subject = `New Applicant: ${applicantName} for ${jobTitle}`;
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; border-left: 4px solid #28a745; background-color: #f9f9f9;">
            <h2 style="margin-top: 0; color: #28a745;">You have a new applicant! 📄</h2>
            <p><strong>${applicantName}</strong> has just applied for your job post: <strong>${jobTitle}</strong>.</p>
            <p>Visit your Employer Dashboard to review their application and CV.</p>
            <br/>
            <p style="font-size: 12px; color: #666;">Keep up the hiring momentum!</p>
        </div>
    `;
    return sendEmail(employerEmail, subject, html);
};