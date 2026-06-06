const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const UAParser = require('ua-parser-js');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sentinel-kinetic-super-secret-key';

// In-memory OTP store for simplicity. In production, use Redis.
const otps = {};

// Helper: Generate Device Fingerprint
function generateDeviceId(req) {
    const parser = new UAParser(req.headers['user-agent']);
    const os = parser.getOS().name || 'Unknown';
    const deviceType = parser.getDevice().type || 'Desktop';
    const browser = parser.getBrowser().name || 'Unknown';
    const rawString = `${req.headers['user-agent']}-${os}-${deviceType}`;
    
    return {
        id: crypto.createHash('sha256').update(rawString).digest('hex'),
        os,
        deviceType,
        browser,
        ip: req.ip || req.connection.remoteAddress
    };
}

// 1. Send OTP for Registration
router.post('/send-otp', (req, res) => {
    const { email, mobile } = req.body;
    if (!email || !mobile) return res.status(400).json({ error: 'Email and mobile required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 mins
    
    otps[email] = { otp, expiry };
    
    // Simulate sending OTP
    console.log(`[SYS-MAIL] OTP for ${email}: ${otp}`);
    console.log(`[SYS-SMS] OTP for ${mobile}: ${otp}`);
    
    res.json({ message: 'OTP sent successfully (Check server console for simulated OTP)' });
});

// 2. Register Account
router.post('/register', async (req, res) => {
    const { name, email, mobile, dob, city, password, otp } = req.body;

    // Verify OTP
    const storedOtp = otps[email];
    if (!storedOtp || storedOtp.otp !== otp || Date.now() > storedOtp.expiry) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    try {
        const password_hash = await bcrypt.hash(password, 10);
        
        db.run(`INSERT INTO Users (name, email, mobile, password_hash, city, dob) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, email, mobile, password_hash, city, dob],
            function(err) {
                if (err) return res.status(500).json({ error: 'User already exists or DB error' });
                
                const userId = this.lastID;
                const devInfo = generateDeviceId(req);

                // Register Device
                db.run(`INSERT INTO User_Devices (device_id, user_id, device_name, browser, os, ip_address, trusted_flag) 
                        VALUES (?, ?, ?, ?, ?, ?, 1)`,
                    [devInfo.id, userId, `${devInfo.os} ${devInfo.browser}`, devInfo.browser, devInfo.os, devInfo.ip],
                    (err2) => {
                        if (err2) console.error(err2);
                        delete otps[email]; // clear otp
                        res.json({ message: 'Registration successful' });
                    });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Login
const loginAttempts = {}; // Simple rate limiting

router.post('/login', (req, res) => {
    const { identity, password } = req.body;

    if (loginAttempts[identity] && loginAttempts[identity].count >= 5) {
        const lockoutTime = 15 * 60 * 1000; // 15 mins
        if (Date.now() - loginAttempts[identity].lastAttempt < lockoutTime) {
            return res.status(429).json({ error: 'Account locked due to multiple failed attempts. Try again later.' });
        } else {
            loginAttempts[identity] = { count: 0, lastAttempt: Date.now() };
        }
    }

    db.get(`SELECT * FROM Users WHERE email = ? OR mobile = ?`, [identity, identity], async (err, user) => {
        if (err || !user) {
            recordFailedAttempt(identity);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            recordFailedAttempt(identity);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Reset attempts
        delete loginAttempts[identity];

        // Device Check
        const devInfo = generateDeviceId(req);
        db.get(`SELECT * FROM User_Devices WHERE user_id = ? AND device_id = ?`, [user.user_id, devInfo.id], (err, device) => {
            if (device && device.trusted_flag === 1) {
                // Trusted -> Issue JWT
                const token = jwt.sign({ user_id: user.user_id }, JWT_SECRET, { expiresIn: '24h' });
                db.run(`UPDATE User_Devices SET last_used = CURRENT_TIMESTAMP WHERE device_id = ?`, [devInfo.id]);
                res.json({ token, message: 'Login successful', requireOtp: false });
            } else {
                // Untrusted/New -> Send OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                otps[user.email] = { otp, expiry: Date.now() + 5 * 60 * 1000, tempUser: user.user_id, devInfo };
                console.log(`[SYS-MAIL] Device verification OTP for ${user.email}: ${otp}`);
                res.json({ message: 'New device detected. OTP sent.', requireOtp: true, email: user.email });
            }
        });
    });
});

function recordFailedAttempt(identity) {
    if (!loginAttempts[identity]) loginAttempts[identity] = { count: 1, lastAttempt: Date.now() };
    else {
        loginAttempts[identity].count++;
        loginAttempts[identity].lastAttempt = Date.now();
    }
}

// 4. Verify Login OTP (For New Devices)
router.post('/verify-login-otp', (req, res) => {
    const { email, otp, trustDevice } = req.body;
    const stored = otps[email];

    if (!stored || stored.otp !== otp || Date.now() > stored.expiry) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const { tempUser, devInfo } = stored;
    
    // Create/Update Device Record
    const isTrusted = trustDevice ? 1 : 0;
    
    db.run(`INSERT OR REPLACE INTO User_Devices (device_id, user_id, device_name, browser, os, ip_address, trusted_flag) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [devInfo.id, tempUser, `${devInfo.os} ${devInfo.browser}`, devInfo.browser, devInfo.os, devInfo.ip, isTrusted],
        (err) => {
            const token = jwt.sign({ user_id: tempUser }, JWT_SECRET, { expiresIn: '24h' });
            delete otps[email];
            res.json({ token, message: 'Login successful' });
        }
    );
});

module.exports = router;
