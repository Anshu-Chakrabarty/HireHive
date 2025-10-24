import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Import your modular routes
import authRoutes from './routes/auth.js';
import seekerRoutes from './routes/seeker.js';
import employerRoutes from './routes/employer.js';

// Load environment variables from .env file
dotenv.config();

const app = express();

// --- Middleware Setup ---
// Define the allowed origins dynamically. 
const allowedOrigins = [
    'http://127.0.0.1:5500', // Local Dev (Live Server)
    'http://localhost:3000', // Standard Dev port
    process.env.CLIENT_ORIGIN // Your live Vercel domain (must be set in Render environment variables)
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow if the origin is in our allowed list
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Allow dynamic preview URLs from Vercel/Render
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

// Enable body parser for application/json requests
app.use(express.json());

// --- Status Check Endpoint ---
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