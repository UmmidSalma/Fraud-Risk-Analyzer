const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sentinel-kinetic-super-secret-key';

// Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    jwt.verify(authHeader.split(' ')[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user_id = decoded.user_id;
        next();
    });
};
router.use(authenticate);

// Artificial Intelligence Engine Simulation (Module 6)
function calculateRiskScore(txn, user, currentDeviceId) {
    let score = 0;
    const reasons = [];

    // 1. Amount Deviation
    if (txn.amount > user.transaction_limit) { score += 40; reasons.push('Exceeds user transaction limit'); }
    else if (txn.amount > (user.daily_limit / 2)) { score += 15; reasons.push('High relative amount'); }

    // 2. Frequency Anomaly & 7. Velocity
    // Usually queried from DB, stubbed here:
    if (txn.velocity_ms < 1000) { score += 20; reasons.push('Impossible human velocity (Bot suspected)'); }

    // 3. New Beneficiary Risk
    if (txn.receiver_type === 'New') { score += 15; reasons.push('New beneficiary'); }
    if (txn.receiver_age === 'New') { score += 10; reasons.push('Beneficiary account is very new'); }

    // 4. Night-Time Risk
    const hour = new Date().getHours();
    if (hour >= 23 || hour <= 6) {
        score += 10;
        reasons.push('Night-time transaction window');
        if (user.night_restriction) { score += 30; reasons.push('Night restriction violation'); }
    }

    // 5. Device Mismatch
    let isCurrentDeviceTrusted = false;
    // Handled out-of-band via DB check usually, we assume from frontend flag for now:
    if (txn.device_trust_flag === false) { score += 25; reasons.push('Untrusted device signature'); }

    // 6. Location Mismatch
    if (txn.location_changed) { score += 15; reasons.push('Geographic anomaly'); }

    // 8. Behavioral Deviation
    if (txn.payment_type !== 'UPI' && txn.amount > 5000) { score += 5; } // Mild heuristic

    // Clamp score
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    let level = 'Safe';
    if (score >= 31 && score <= 70) level = 'Moderate';
    if (score > 70) level = 'High';

    return { score, level, reasons: reasons.join(', ') || 'Normal behavior' };
}

router.post('/process', (req, res) => {
    const { amount, payment_type, receiver_id, receiver_age, receiver_type, location_changed, device_id, device_trust_flag, velocity_ms } = req.body;
    
    // Fetch user settings
    db.get('SELECT * FROM Users WHERE user_id = ?', [req.user_id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });

        const risk = calculateRiskScore({
            amount: parseFloat(amount),
            payment_type, receiver_id, receiver_age, receiver_type, location_changed, device_trust_flag, velocity_ms
        }, user, device_id);

        const status = risk.level === 'High' ? 'BLOCKED' : risk.level === 'Moderate' ? 'PAUSED_OTP' : 'COMPLETED';

        db.run(`INSERT INTO Transactions (user_id, amount, payment_type, receiver_id, receiver_type, device_id, location, risk_score, risk_level, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.user_id, amount, payment_type, receiver_id, receiver_type, device_id, 'Captured IP Coord', risk.score, risk.level, status],
        function(errT) {
            const txnId = this.lastID;
            
            if (risk.level !== 'Safe') {
                db.run('INSERT INTO Fraud_Logs (transaction_id, risk_reason) VALUES (?, ?)', [txnId, risk.reasons]);
            }
            
            if (status === 'BLOCKED') {
                // Return immediately for blocked
                return res.json({ txnId, status, risk_score: risk.score, risk_level: risk.level, message: 'High fraud risk detected. Transaction blocked.', reasons: risk.reasons });
            } 
            else if (status === 'PAUSED_OTP') {
                // Send Mock OTP for Moderate
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                console.log(`[SYS-MAIL] TXN Verification OTP for ${user.email} (TXN ${txnId}): ${otp}`);
                return res.json({ txnId, status, risk_score: risk.score, risk_level: risk.level, message: 'Unusual transaction detected. Verify via OTP.', otp_required: true, server_mock_otp: otp });
            } 
            else {
                return res.json({ txnId, status, risk_score: risk.score, risk_level: risk.level, message: 'Transaction processed securely.' });
            }
        });
    });
});

// Confirm PAUSED transaction
router.post('/confirm-otp', (req, res) => {
    const { txnId, entered_otp, real_otp } = req.body; // Using simple mock pass for demo
    if (entered_otp !== real_otp) {
        return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    db.run('UPDATE Transactions SET status = ? WHERE transaction_id = ? AND user_id = ?', ['COMPLETED', txnId, req.user_id], (err) => {
        if(err) return res.status(500).json({ error: 'DB Error' });
        res.json({ message: 'Transaction unsealed and completed!' });
    });
});

// Get History
router.get('/history', (req, res) => {
    db.all('SELECT * FROM Transactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20', [req.user_id], (err, rows) => {
        if(err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

module.exports = router;
