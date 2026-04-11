const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sentinel-kinetic-super-secret-key';

// Middleware to authenticate JWT
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user_id = decoded.user_id;
        next();
    });
};

router.use(authenticate);

// 1. Get User Profile
router.get('/profile', (req, res) => {
    db.get(`SELECT user_id, name, email, mobile, city, dob, two_factor_enabled, daily_limit, transaction_limit, night_restriction, auto_save_beneficiary FROM Users WHERE user_id = ?`, [req.user_id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

// 2. Update Profile & Settings
router.post('/settings', (req, res) => {
    const { 
        two_factor_enabled, 
        daily_limit, 
        transaction_limit, 
        night_restriction, 
        auto_save_beneficiary 
    } = req.body;
    
    db.run(`UPDATE Users SET 
            two_factor_enabled = COALESCE(?, two_factor_enabled),
            daily_limit = COALESCE(?, daily_limit),
            transaction_limit = COALESCE(?, transaction_limit),
            night_restriction = COALESCE(?, night_restriction),
            auto_save_beneficiary = COALESCE(?, auto_save_beneficiary)
            WHERE user_id = ?`,
        [two_factor_enabled, daily_limit, transaction_limit, night_restriction, auto_save_beneficiary, req.user_id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Settings updated successfully' });
        }
    );
});

// 3. Set/Update Transaction PIN
router.post('/pin', async (req, res) => {
    const { current_password, new_pin } = req.body;
    
    db.get('SELECT password_hash FROM Users WHERE user_id = ?', [req.user_id], async (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        const match = await bcrypt.compare(current_password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Incorrect password' });
        
        const pin_hash = await bcrypt.hash(new_pin.toString(), 10);
        db.run('UPDATE Users SET transaction_pin_hash = ? WHERE user_id = ?', [pin_hash, req.user_id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to update PIN' });
            res.json({ message: 'Transaction PIN securely updated' });
        });
    });
});

// 4. Get Trusted Devices
router.get('/devices', (req, res) => {
    db.all(`SELECT device_id, device_name, os, ip_address, last_used, trusted_flag 
            FROM User_Devices WHERE user_id = ? ORDER BY last_used DESC`, [req.user_id], (err, devices) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(devices);
    });
});

// 5. Revoke Device
router.post('/devices/revoke', (req, res) => {
    const { device_id } = req.body;
    db.run(`UPDATE User_Devices SET trusted_flag = 0 WHERE user_id = ? AND device_id = ?`, [req.user_id, device_id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to revoke device' });
        res.json({ message: 'Device revoked successfully' });
    });
});

// 6. User Dashboard Metrics
router.get('/dashboard', (req, res) => {
    db.all(`SELECT amount, risk_level, status FROM Transactions WHERE user_id = ?`, [req.user_id], (err, txns) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        let secured = 0, lastTransfer = 0, flagged = 0;
        if(txns.length > 0) {
            lastTransfer = txns[txns.length-1].amount;
            txns.forEach(t => {
                if(t.status === 'COMPLETED') secured++;
                if(t.risk_level === 'Moderate' || t.risk_level === 'High') flagged++;
            });
        }
        res.json({ secured, lastTransfer, flagged });
    });
});

// 7. User Transaction History
router.get('/history', (req, res) => {
    db.all(`SELECT * FROM Transactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20`, [req.user_id], (err, txns) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(txns);
    });
});

// 8. User Alerts (Notifications)
router.get('/alerts', (req, res) => {
    db.all(`SELECT t.transaction_id, t.risk_level, f.risk_reason, f.flagged_at 
            FROM Transactions t JOIN Fraud_Logs f ON t.transaction_id = f.transaction_id 
            WHERE t.user_id = ? ORDER BY f.flagged_at DESC LIMIT 15`, [req.user_id], (err, alerts) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(alerts);
    });
});

module.exports = router;
