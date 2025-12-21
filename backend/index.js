import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import seekerRoutes from "./routes/seeker.js";
import employerRoutes from "./routes/employer.js";
import contactRoutes from "./routes/contact.js";
import publicRoutes from './routes/public.js';

dotenv.config();

// --- CRITICAL STARTUP CHECK ---
if (!process.env.JWT_SECRET) {
    console.error("CRITICAL ERROR: JWT_SECRET environment variable is missing.");
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error(
        "CRITICAL ERROR: Supabase configuration environment variables is missing."
    );
}
// RAZORPAY COMMENTED OUT
// if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
//     console.warn(
//         "WARNING: Razorpay environment variables are missing. Payment API will fail."
//     );
// }

console.log(`Server starting on Node version: ${process.version}`);
console.log(`Running in environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Attempting to bind to PORT: ${process.env.PORT || 5005}`);

const app = express();

// --- Middleware Setup ---
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://localhost:5500",
    "https://hirehive.in",
    "https://www.hirehive.in",
    "https://hirehive-frontend.onrender.com",
    "https://hirehive.vercel.app",
];

// If process.env.CLIENT_ORIGIN exists, add it to the list
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
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Added OPTIONS
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"], // Added X-Requested-With
        credentials: true // Crucial for session/auth persistence
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
app.use("/api/employer", employerRoutes);
app.use("/api/contact", contactRoutes);


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