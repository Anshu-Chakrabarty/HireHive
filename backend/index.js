// --- Backend: index.js (REPLACE ENTIRE FILE) ---
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import authRoutes from './routes/auth.js';
import seekerRoutes from './routes/seeker.js';
import employerRoutes from './routes/employer.js';

dotenv.config();

const app = express();

// --- Middleware Setup ---
// Define the allowed origins dynamically. 
const allowedOrigins = [
    'http://127.0.0.1:5500', // Local Dev
    'http://localhost:3000', // Standard Dev port
    process.env.CLIENT_ORIGIN, // Vercel Preview URL
    'https://hirehive.in' // FIX: Explicitly allow custom domain
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Allow dynamic Vercel/Render preview domains
            if (origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) {
                callback(null, true);
            } else {
                callback(new Error(`Not allowed by CORS: ${origin}`), false);
            }
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- Heartbeat Function (FIX: Prevents Render Cold Start) ---
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;

if (RENDER_EXTERNAL_URL && RENDER_EXTERNAL_URL.startsWith('https://')) {
    const keepAlive = () => {
        https.get(RENDER_EXTERNAL_URL, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                // Success log is suppressed to keep console clean, but ping happens
            }
        }).on('error', (err) => {
            console.error(`[Heartbeat] Ping error: ${err.message}. Server may be sleeping or restarting.`);
        });
    };

    // Ping every 10 minutes (600,000 milliseconds)
    setInterval(keepAlive, 600000);
}
// --- End Heartbeat ---

// --- Status Check Endpoint ---
app.get('/', (req, res) => {
    res.send('HireHive API is alive!');
});
app.get('/api/status', (req, res) => {
    res.json({
        message: 'HireHive API is running!',
        port: process.env.PORT || 5000
    });
});

// --- Route Mounting ---
app.use('/api/auth', authRoutes);
app.use('/api/seeker', seekerRoutes);
app.use('/api/employer', employerRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));