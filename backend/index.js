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
// Enable CORS for client-server communication (important since frontend is on different port/domain)
app.use(cors({
    origin: 'http://127.0.0.1:5500', // Assuming you are serving index.html via Live Server (or adjust as necessary)
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