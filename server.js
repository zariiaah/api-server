const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err);
    } else {
        console.log('✅ Database connected successfully');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Database query endpoint
app.post('/query', async (req, res) => {
    try {
        const { query, params = [] } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }
        
        console.log('📝 Executing query:', query);
        console.log('📝 Parameters:', params);
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            data: result.rows,
            rowCount: result.rowCount
        });
        
    } catch (error) {
        console.error('❌ Query error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Specific endpoints for common operations

// Initialize database
app.post('/init', async (req, res) => {
    try {
        const schema = `
            -- Enable UUID extension
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            
            -- Players table
            CREATE TABLE IF NOT EXISTS players (
                user_id BIGINT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Moderations table
            CREATE TABLE IF NOT EXISTS moderations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id BIGINT NOT NULL,
                moderator_id BIGINT NOT NULL,
                moderator_name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL CHECK (type IN ('ban', 'warning', 'kick')),
                reason TEXT NOT NULL,
                evidence TEXT[],
                duration_seconds INTEGER DEFAULT 0,
                issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                acknowledged BOOLEAN DEFAULT false,
                discord_message_id VARCHAR(255),
                FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE
            );
            
            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_moderations_user_id ON moderations(user_id);
            CREATE INDEX IF NOT EXISTS idx_moderations_type ON moderations(type);
            CREATE INDEX IF NOT EXISTS idx_moderations_issued_at ON moderations(issued_at);
            CREATE INDEX IF NOT EXISTS idx_moderations_is_active ON moderations(is_active);
            CREATE INDEX IF NOT EXISTS idx_moderations_expires_at ON moderations(expires_at);
            CREATE INDEX IF NOT EXISTS idx_moderations_moderator_id ON moderations(moderator_id);
        `;
        
        await pool.query(schema);
        
        res.json({ success: true, message: 'Database initialized successfully' });
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create or update player
app.post('/players', async (req, res) => {
    try {
        const { user_id, username } = req.body;
        
        const query = `
            INSERT INTO players (user_id, username, last_seen)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = $2,
                last_seen = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        
        const result = await pool.query(query, [user_id, username]);
        
        res.json({
            success: true,
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Player creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create moderation
app.post('/moderations', async (req, res) => {
    try {
        const { user_id, moderator_id, moderator_name, type, reason, evidence, duration_seconds } = req.body;
        
        const query = `
            INSERT INTO moderations 
            (user_id, moderator_id, moderator_name, type, reason, evidence, duration_seconds, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 
                CASE WHEN $7 > 0 THEN CURRENT_TIMESTAMP + INTERVAL '1 second' * $7 ELSE NULL END
            )
            RETURNING *;
        `;
        
        const result = await pool.query(query, [
            user_id, moderator_id, moderator_name, type, reason, evidence, duration_seconds
        ]);
        
        res.json({
            success: true,
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Moderation creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get player moderations
app.get('/players/:userId/moderations', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const query = `
            SELECT m.*, p.username as player_username
            FROM moderations m
            JOIN players p ON m.user_id = p.user_id
            WHERE m.user_id = $1
            ORDER BY m.issued_at DESC;
        `;
        
        const result = await pool.query(query, [userId]);
        
        res.json({
            success: true,
            data: result.rows
        });
        
    } catch (error) {
        console.error('❌ Get moderations error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get active moderations
app.get('/moderations/active/:userId/:type', async (req, res) => {
    try {
        const { userId, type } = req.params;
        
        const query = `
            SELECT m.*, p.username as player_username
            FROM moderations m
            JOIN players p ON m.user_id = p.user_id
            WHERE m.user_id = $1 AND m.type = $2 AND m.is_active = true
            ORDER BY m.issued_at DESC;
        `;
        
        const result = await pool.query(query, [userId, type]);
        
        res.json({
            success: true,
            data: result.rows
        });
        
    } catch (error) {
        console.error('❌ Get active moderations error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Cleanup expired moderations
app.post('/moderations/cleanup', async (req, res) => {
    try {
        const query = `
            UPDATE moderations 
            SET is_active = false 
            WHERE expires_at IS NOT NULL 
            AND expires_at < CURRENT_TIMESTAMP 
            AND is_active = true;
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            message: `Marked ${result.rowCount} expired moderations as inactive`
        });
        
    } catch (error) {
        console.error('❌ Cleanup error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get statistics
app.get('/statistics', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_moderations,
                COUNT(CASE WHEN type = 'ban' THEN 1 END) as total_bans,
                COUNT(CASE WHEN type = 'warning' THEN 1 END) as total_warnings,
                COUNT(CASE WHEN type = 'kick' THEN 1 END) as total_kicks,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_moderations,
                COUNT(CASE WHEN is_active = true AND type = 'ban' THEN 1 END) as active_bans,
                COUNT(CASE WHEN is_active = true AND type = 'warning' THEN 1 END) as active_warnings,
                COUNT(CASE WHEN issued_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as this_week_moderations
            FROM moderations;
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Statistics error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
