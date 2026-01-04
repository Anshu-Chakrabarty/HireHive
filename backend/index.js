import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Import Routes
import authRoutes from "./routes/auth.js";
import seekerRoutes from "./routes/seeker.js";
import contactRoutes from "./routes/contact.js";
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/adminRoutes.js';
import adminAuth from './middleware/adminAuth.js';

// --- FIX: IMPORT BOTH EMPLOYER FILES WITH DIFFERENT NAMES ---
import employerMainRoutes from "./routes/employer.js";       // Your original file (Jobs, etc.)
import employerSearchRoutes from './routes/employerRoutes.js'; // The new file (Find Applicants)

dotenv.config();

// --- CRITICAL STARTUP CHECK ---
if (!process.env.JWT_SECRET) {
    console.error("CRITICAL ERROR: JWT_SECRET environment variable is missing.");
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("CRITICAL ERROR: Supabase configuration environment variables are missing.");
}

console.log(`Server starting on Node version: ${process.version}`);
console.log(`Running in environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Attempting to bind to PORT: ${process.env.PORT || 5005}`);

const app = express();

// --- Middleware Setup ---
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://localhost:5500",
    "http://localhost:5173",
    "https://hirehive.in",
    "https://www.hirehive.in",
    "https://hirehive-frontend.onrender.com",
    "https://hirehive.vercel.app",
    "https://hirehive-admin.onrender.com"
];

if (process.env.CLIENT_ORIGIN) {
    allowedOrigins.push(process.env.CLIENT_ORIGIN);
}

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const isAllowed = allowedOrigins.includes(origin) ||
                origin.endsWith(".onrender.com") ||
                origin.endsWith(".vercel.app");

            if (isAllowed) {
                callback(null, true);
            } else {
                console.warn(`CORS blocked request from origin: ${origin}`);
                callback(new Error(`Not allowed by CORS: ${origin}`), false);
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        credentials: true
    })
);

app.use(express.json());

// --- Status Check Endpoints ---
app.get("/api/status", (req, res) => {
    res.json({
        message: "HireHive API is alive and running!",
        port: process.env.PORT || 5005,
    });
});
app.get("/", (req, res) => res.send("HireHive API is running."));

// --- Route Mounting ---
app.use('/api/public', publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/seeker", seekerRoutes);
app.use("/api/contact", contactRoutes);

// --- MOUNT BOTH EMPLOYER ROUTES ---
// Express will check employerMainRoutes first, then employerSearchRoutes
app.use("/api/employer", employerMainRoutes);
app.use("/api/employer", employerSearchRoutes);

// Protected Admin Routes
app.use('/api/admin', adminAuth, adminRoutes);

// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(`[SERVER ERROR] ${err.stack}`);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        path: req.path
    });
});

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
    console.log("-----------------------------------------");
    console.log(`🚀 HireHive API Integrated & Running`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌍 Env: ${process.env.NODE_ENV || "development"}`);
    console.log("-----------------------------------------");
});