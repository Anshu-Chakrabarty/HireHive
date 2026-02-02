console.log("🔥🔥🔥 BACKEND INDEX.JS LOADED 🔥🔥🔥");


import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from 'path';              // Required for file paths
import { fileURLToPath } from 'url';  // Required for ES Modules

// Import Routes
import authRoutes from "./routes/auth.js";
import seekerRoutes from "./routes/seeker.js";
import contactRoutes from "./routes/contact.js";
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/adminRoutes.js';
import adminAuth from './middleware/adminAuth.js';
import paymentRoutes from './routes/paymentRoutes.js';

// Import Employer Files
import employerMainRoutes from "./routes/employer.js";
import employerSearchRoutes from './routes/employerRoutes.js';

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

// --- 1. DEFINE __dirname (Required for ES Modules) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
                callback(null, false);
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Verify", "X-Merchant-Id"],
        credentials: true
    })
);

app.options('*', cors());

app.use(express.json());

// --- Status Check Endpoints ---
app.get("/api/status", (req, res) => {
    res.json({
        message: "HireHive API is alive and running!",
        port: process.env.PORT || 5005,
    });
});

// --- Route Mounting ---
app.use('/api/public', publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/seeker", seekerRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/employer", employerMainRoutes);
app.use("/api/talent", employerSearchRoutes);
app.use("/api/payment", paymentRoutes);
app.use('/api/admin', adminAuth, adminRoutes);

// ==========================================
// 🚀 SERVE FRONTEND (FROM ROOT / PARENT FOLDER)
// ==========================================

// 1. Serve Static Assets (CSS, JS, Images)
// We go UP one level ('../') to find style.css and app.js
app.use(express.static(path.join(__dirname, '../'), {
    etag: false,
    index: false // 👈 We handle index.html manually below
}));

// 2. Serve index.html with STRICT NO-CACHE
// This catches the root URL ('/') and any other non-API routes.
app.get('*', (req, res) => {
    // Safety: Don't serve HTML for failed API calls
    if (req.path.startsWith('/api')) {
         return res.status(404).json({ error: "API endpoint not found" });
    }

    // Force browser to revalidate index.html every single time
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Serve the file from the parent directory
    res.sendFile(path.join(__dirname, '../index.html'));
});

// ==========================================

// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(`[SERVER ERROR] ${err.stack}`);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        path: req.path
    });
});

// Use the port Render provides dynamically, or default to 5005 for local development
const PORT = process.env.PORT || 5005;

// Binding to '0.0.0.0' allows the server to accept connections from outside the container
app.listen(PORT, '0.0.0.0', () => {
    console.log("-----------------------------------------");
    console.log(`🚀 HireHive API Integrated & Running`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌍 Env: ${process.env.NODE_ENV || "development"}`);
    console.log("-----------------------------------------");
});