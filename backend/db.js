import { createClient } from '@supabase/supabase-js';
import pg from 'pg'; // Import PG for SQL queries
import dotenv from 'dotenv';

dotenv.config();

// 1. Check for Env Variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('❌ Missing Supabase Env Variables!');
}
if (!process.env.DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL!');
}

// 2. Export Supabase Client (For Storage/Auth)
export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// 3. Export PostgreSQL Pool (For SQL Queries)
const { Pool } = pg;
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});