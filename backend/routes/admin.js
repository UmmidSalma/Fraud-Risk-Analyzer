const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sentinel-kinetic-super-secret-key';

// Dummy Admin Auth check (In a real app, verify they actually have an admin role)
const verifyAdmin = (req, res, next) => {
    // For our simplified demo, we use JWT or fallback
    next();
};
router.use(verifyAdmin);

// 1. Core Metrics (Dashboard)
router.get('/metrics', (req, res) => {
    const data = { totalFlagged: 0, revenueRisk: 0, totalTxns: 0, approvedTxns: 0 };
    
    db.all(`SELECT status, amount, risk_level FROM Transactions`, [], (err, rows) => {
        if (!err && rows) {
            data.totalTxns = rows.length;
            rows.forEach(r => {
                if(r.risk_level === 'High' || r.risk_level === 'Moderate') {
                    data.totalFlagged++;
                    data.revenueRisk += r.amount;
                }
                if(r.status === 'COMPLETED') data.approvedTxns++;
            });
        }
        res.json(data);
    });
});

// 2. All Users
router.get('/users', (req, res) => {
    db.all(`SELECT user_id, name, email, created_at FROM Users ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        // Simulating the user restriction/freeze state dynamically
        res.json(rows.map(r => ({...r, status: 'ACTIVE', role: r.email === 'admin@core.net' ? 'ADMIN' : 'USER'})));
    });
});

// 3. Flagged Transactions / Fraud Logs
router.get('/flagged', (req, res) => {
    const query = `
        SELECT f.log_id, f.risk_reason, f.flagged_at, t.transaction_id, t.risk_score, t.risk_level, t.amount, t.receiver_id 
        FROM Fraud_Logs f
        JOIN Transactions t ON f.transaction_id = t.transaction_id
        ORDER BY f.flagged_at DESC
        LIMIT 50
    `;
    db.all(query, [], (err, rows) => {
        if(err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
    });
});

module.exports = router;
