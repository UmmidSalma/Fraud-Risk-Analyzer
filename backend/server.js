// SecureWith.AI Backend Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'securewith-ai-secret-key';
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS || 'mdivate588@gmail.com';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'zhgzqklcxowtxtem';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_ADDRESS,
    pass: EMAIL_PASSWORD,
  },
});

async function sendOtpEmail(to, otp) {
  const mailOptions = {
    from: EMAIL_ADDRESS,
    to,
    subject: 'SecureWith.AI Registration OTP',
    text: `Your registration OTP is ${otp}. It expires in 5 minutes.`,
  };

  return transporter.sendMail(mailOptions);
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('[REQ BODY]', JSON.stringify(req.body));
  }
  next();
});
app.use(express.static(path.join(__dirname, '..')));

// In-memory storage (in production, use a database)
const users = {};
const otps = {};
const transactions = [];

function findUserByIdentity(identity) {
  if (!identity) return null;
  if (users[identity]) return users[identity];
  return Object.values(users).find((u) => u.email === identity || u.mobile === identity) || null;
}

// Utility function to generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Utility function to generate Transaction ID
function generateTransactionId() {
  return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// ==================== USER AUTHENTICATION ENDPOINTS ====================

// Register User
app.post('/api/auth/register', async (req, res) => {
  const { name, email, mobile, password, pin, otp, txn_pin, dob, city } = req.body;
  const identity = email ? email.trim().toLowerCase() : '';

  if (!identity || !mobile) {
    return res.status(400).json({ success: false, message: 'Email and mobile are required' });
  }

  if (otp) {
    const stored = otps[identity];
    if (!stored || stored.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (!users[identity]) {
      return res.status(400).json({ success: false, message: 'Registration session not found' });
    }

    if (!name || !password || !pin) {
      return res.status(400).json({ success: false, message: 'Missing registration details' });
    }

    users[identity] = {
      email: identity,
      mobile,
      password,
      name,
      pin,
      dob,
      city,
      registered: true,
      status: users[identity]?.status || 'ACTIVE',
      freezeReason: users[identity]?.freezeReason || '',
      blockedAt: users[identity]?.blockedAt || null,
      createdAt: users[identity]?.createdAt || new Date().toISOString(),
    };

    delete otps[identity];

    return res.json({ success: true, message: 'Registration successful' });
  }

  const existing = findUserByIdentity(identity) || findUserByIdentity(mobile);
  if (existing && existing.registered) {
    return res.status(400).json({ success: false, message: 'Email or mobile already registered' });
  }

  const otpCode = generateOTP();
  // Make registration OTP valid for 5 minutes and log for dev
  otps[identity] = { otp: otpCode, expiry: Date.now() + (5 * 60 * 1000), email: identity, mobile };
  console.log(`[REG-OTP] OTP for ${identity}: ${otpCode} (expires in 5m)`);
  console.log('[REG-OTP] Current OTP store keys:', Object.keys(otps));

  users[identity] = {
    email: identity,
    mobile,
    password: '',
    name: '',
    pin: txn_pin || pin || '',
    dob: '',
    city: '',
    registered: false,
    status: 'ACTIVE',
    freezeReason: '',
    blockedAt: null,
    createdAt: new Date().toISOString(),
  };

  try {
    await sendOtpEmail(identity, otpCode);
    return res.json({ success: true, message: 'OTP sent to email. Please check your inbox.', email: identity, mobile });
  } catch (error) {
    console.error('OTP email send failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to send OTP email. Please try again later.' });
  }
});

// Verify OTP for Registration
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const emailKey = email ? email.trim().toLowerCase() : '';

  console.log('[REG-OTP-VERIFY] Incoming body:', { email, otp });
  console.log('[REG-OTP-VERIFY] Current OTP store keys:', Object.keys(otps));
  const stored = otps[emailKey];
  console.log(`[REG-OTP-VERIFY] Attempt for ${emailKey}: entered=${otp}, stored=${stored ? stored.otp : 'none'}`);
  if (!stored || stored.otp !== otp || (stored.expiry && Date.now() > stored.expiry)) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  // Mark user as registered
  if (users[emailKey]) {
    users[emailKey].registered = true;
  }

  delete otps[emailKey];

  res.json({
    success: true,
    message: 'Registration successful',
    email: emailKey,
  });
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const identity = email ? email.trim() : '';

  let user = users[identity];
  if (!user) {
    user = Object.values(users).find((u) => u.email === identity || u.mobile === identity);
  }

  if (!user || user.password !== password) {
    return res.status(400).json({ success: false, message: 'Invalid credentials' });
  }

  if (user.status === 'BLOCKED') {
    return res.status(403).json({ success: false, message: 'Your account has been blocked by admin.' });
  }

  if (!user.registered) {
    return res.status(400).json({ success: false, message: 'Please verify your email first' });
  }

  const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '12h' });

  res.json({
    success: true,
    message: 'Login successful',
    token,
    requireOtp: false,
    user: {
      email: user.email,
      name: user.name,
      mobile: user.mobile,
    },
  });
});

// Middleware to verify auth token for user routes
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: 'Invalid token' });
    req.userEmail = decoded.email;
    next();
  });
}

// Minimal user endpoints used by the front-end
app.get('/api/user/dashboard', authenticate, (req, res) => {
  const userTxns = transactions.filter((t) => t.email === req.userEmail);
  const secured = userTxns.filter((t) => t.status === 'COMPLETED').length;
  const lastTransfer = userTxns.length > 0 ? userTxns[userTxns.length - 1].amount : 0;
  const flagged = userTxns.filter((t) => t.status === 'PAUSED_OTP' || t.status === 'BLOCKED').length;
  res.json({ success: true, data: { secured, lastTransfer, flagged } });
});

app.get('/api/user/history', authenticate, (req, res) => {
  const userTxns = transactions
    .filter((t) => t.email === req.userEmail)
    .map((t) => ({
      transaction_id: t.transaction_id,
      timestamp: t.timestamp,
      receiver_id: t.receiver_id,
      amount: t.amount,
      status: t.status,
      risk_level: t.risk_level,
      risk_score: t.risk_score
    }));
  res.json({ success: true, data: userTxns });
});

app.get('/api/user/alerts', authenticate, (req, res) => {
  const alertTxns = transactions
    .filter((t) => t.email === req.userEmail && (t.status === 'BLOCKED' || t.status === 'PAUSED_OTP'))
    .map((t) => ({
      transaction_id: t.transaction_id,
      risk_level: t.risk_level || 'Moderate',
      risk_reason: t.status === 'BLOCKED' ? 'High risk detected' : 'OTP verification required',
      flagged_at: t.timestamp
    }));
  res.json({ success: true, data: alertTxns });
});

// ==================== TRANSACTION ENDPOINTS ====================

// Initiate Neural Scan
app.post('/api/transaction/neural-scan', async (req, res) => {
  const { email, amount, receiver, pin } = req.body;

  if (!email || !amount || !receiver || !pin) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (!users[email]) {
    return res.status(400).json({ success: false, message: 'User not found' });
  }

  if (users[email].pin !== pin) {
    return res.status(400).json({ success: false, message: 'Invalid Transaction PIN' });
  }

  try {
    // CALLING YOUR ML BACKEND
    const mlResponse = await fetch('http://127.0.0.1:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(amount),
        transaction_hour: new Date().getHours(),
        is_new_receiver: 1,
        device_mismatch: 0,
        location_mismatch: 0,
        transaction_count: 3,
        avg_amount_deviation: 0.2,
        is_night: 0,
        failed_attempts: 0
      })
    });

    const mlData = await mlResponse.json();

    const riskScore = mlData.risk_score;
    const riskLevel = mlData.risk_level;

    let recommendation = 'APPROVED';
    if (riskScore > 80) recommendation = 'BLOCKED';
    else if (riskScore > 50) recommendation = 'REVIEW_REQUIRED';

    return res.json({
      success: true,
      message: 'Neural scan completed (ML)',
      transactionId: generateTransactionId(),
      scanResult: {
        riskScore,
        riskLevel
      },
      recommendation
    });
  } catch (err) {
    console.error("ML ERROR:", err);
    return res.status(500).json({
      success: false,
      message: 'ML server not reachable'
    });
  }
});

// Process Transaction
app.post('/api/transaction/process', (req, res) => {
  const { email, amount, receiver, pin, transactionId, status, risk_score, risk_level } = req.body;

  if (!email || !amount || !receiver || !transactionId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (!users[email]) {
    return res.status(400).json({ success: false, message: 'User not found' });
  }

  if (users[email].pin && users[email].pin !== pin) {
    return res.status(400).json({ success: false, message: 'Invalid Transaction PIN' });
  }

  const transaction = {
    transaction_id: transactionId,
    email,
    amount,
    receiver_id: receiver,
    timestamp: new Date().toISOString(),
    status: status || 'COMPLETED',
    deviceId: 'WEB',
    risk_score: risk_score || 0,
    risk_level: risk_level || 'Safe'
  };

  transactions.push(transaction);

  res.json({
    success: true,
    message: 'Transaction completed successfully',
    transaction,
  });
});

// Send OTP for transaction verification (used for PAUSED/High-risk flows)
app.post('/api/transaction/send-otp', async (req, res) => {
  const { email, transactionId, mobile } = req.body;

  if (!email) return res.status(400).json({ success: false, message: 'Email required' });

  const otpCode = generateOTP();
  const key = transactionId ? `${email}:${transactionId}` : email;
  // Keep OTP valid for 5 minutes to match user expectation
  otps[key] = { otp: otpCode, expiry: Date.now() + (5 * 60 * 1000), transactionId, email, mobile, pendingTransaction: req.body.pendingTransaction || null };

  try {
    // Try to send email (best-effort) and always log SMS for dev
    try { await sendOtpEmail(email, otpCode); } catch (e) { console.warn('Email OTP failed', e.message || e); }
    console.log(`[SYS-SMS] TXN Verification OTP for ${mobile || (users[email] && users[email].mobile) || 'unknown'} (TXN ${transactionId || 'N/A'}): ${otpCode}`);

    return res.json({ success: true, message: 'OTP sent to email and mobile (check server logs)', server_mock_otp: otpCode, transactionId });
  } catch (err) {
    console.error('Transaction OTP send failed:', err);
    return res.status(500).json({ success: false, message: 'Unable to send OTP' });
  }
});

// Verify Transaction OTP and complete transaction
app.post('/api/transaction/verify-otp', authenticate, (req, res) => {
  const { transactionId, otp } = req.body;
  const email = req.userEmail ? req.userEmail.trim().toLowerCase() : '';

  if (!transactionId || !otp) return res.status(400).json({ success: false, message: 'transactionId and otp required' });

  const key = `${email}:${transactionId}`;
  const stored = otps[key] || otps[email];
  console.log(`[SYS-SMS-VERIFY] Verifying OTP for ${email} with key ${key} - stored keys: ${Object.keys(otps).join(', ')}`);
  if (!stored) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  if (stored.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  if (stored.expiry && Date.now() > stored.expiry) { delete otps[key]; return res.status(400).json({ success: false, message: 'Invalid or expired OTP' }); }

  // Build transaction payload from stored pendingTransaction (sent when OTP requested)
  const pending = stored.pendingTransaction || {};
  const transaction = {
    transaction_id: transactionId,
    email: email,
    amount: pending.amount || req.body.amount || 0,
    receiver_id: pending.receiver || req.body.receiver || 'UNKNOWN',
    timestamp: new Date().toISOString(),
    status: 'COMPLETED',
    deviceId: pending.deviceId || 'WEB',
    risk_score: pending.risk_score || req.body.risk_score || 0,
    risk_level: pending.risk_level || req.body.risk_level || 'Safe'
  };

  transactions.push(transaction);
  // clean up OTP entry
  delete otps[key];

  return res.json({ success: true, message: 'OTP verified and transaction completed', transaction });
});

// Get Transaction History
app.get('/api/transaction/history/:email', (req, res) => {
  const { email } = req.params;

  if (!users[email]) {
    return res.status(400).json({ success: false, message: 'User not found' });
  }

  const userTransactions = transactions.filter((t) => t.email === email);

  res.json({
    success: true,
    transactions: userTransactions,
  });
});

// ==================== FRAUD DETECTION ENDPOINTS ====================

// Analyze Transaction for Fraud
app.post('/api/fraud/analyze', (req, res) => {
  const { amount, email, deviceId, location } = req.body;

  const analysis = {
    transactionId: generateTransactionId(),
    riskScore: Math.floor(Math.random() * 100),
    fraudProbability: (Math.random() * 50).toFixed(2) + '%',
    flaggedReasons: [],
    recommendation: 'APPROVED',
  };

  // Add some fraud reasons randomly
  if (analysis.riskScore > 60) {
    analysis.flaggedReasons.push('Unusual transaction amount');
    analysis.recommendation = 'REVIEW_REQUIRED';
  }

  if (analysis.riskScore > 80) {
    analysis.flaggedReasons.push('Location mismatch detected');
    analysis.recommendation = 'BLOCKED';
  }

  res.json({
    success: true,
    analysis,
  });
});

// ==================== ADMIN ENDPOINTS ====================

// Get All Users (Admin)
app.get('/api/admin/users', (req, res) => {
  const userList = Object.values(users).map((user) => ({
    email: user.email,
    name: user.name,
    mobile: user.mobile,
    registered: user.registered,
    status: user.status || 'ACTIVE',
    role: user.email === 'admin@core.net' ? 'ADMIN' : 'USER',
    createdAt: user.createdAt || new Date().toISOString(),
    dob: user.dob || '',
    city: user.city || '',
    freezeReason: user.freezeReason || '',
  }));

  res.json({
    success: true,
    data: userList,
    totalUsers: userList.length,
  });
});

app.post('/api/admin/users/freeze', (req, res) => {
  console.log('[ADMIN] Freeze request body:', req.body);
  const { email, reason } = req.body || {};
  if (!email) {
    console.warn('[ADMIN] Freeze failed: missing email');
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const user = findUserByIdentity(email.toLowerCase());
  if (!user) {
    console.warn('[ADMIN] Freeze failed: user not found for', email);
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (user.email === 'admin@core.net') {
    console.warn('[ADMIN] Freeze failed: attempted admin freeze', email);
    return res.status(403).json({ success: false, message: 'Cannot freeze an admin account' });
  }

  user.status = 'BLOCKED';
  user.freezeReason = reason || 'Other';
  user.blockedAt = new Date().toISOString();
  console.log('[ADMIN] User frozen:', user.email, user.freezeReason);

  res.json({ success: true, message: `${user.email} has been blocked by admin` });
});

// Get All Transactions (Admin)
app.get('/api/admin/transactions', (req, res) => {
  res.json({
    success: true,
    transactions,
    totalTransactions: transactions.length,
    totalAmount: transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0),
  });
});

// Get Fraud Statistics
app.get('/api/admin/fraud-stats', (req, res) => {
  const stats = {
    totalTransactions: transactions.length,
    flaggedTransactions: Math.floor(transactions.length * 0.15),
    blockedTransactions: Math.floor(transactions.length * 0.05),
    averageRiskScore: (Math.random() * 50).toFixed(2),
    lastUpdated: new Date().toISOString(),
  };

  res.json({
    success: true,
    stats,
  });
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SecureWith.AI API Server Running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
  });
});

// ==================== START SERVER ====================

function listRoutes() {
  const routes = [];
  if (app._router && app._router.stack) {
    app._router.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase()).join(',');
        routes.push(`${methods} ${layer.route.path}`);
      }
    });
  }
  console.log('Registered routes:', routes.join(' | '));
}

function startServer(port) {
  const server = app.listen(port, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  SecureWith.AI Backend Server Running         ║');
    console.log(`║  Server: http://localhost:${port}                    ║`);
    console.log(`║  API Docs: http://localhost:${port}/api/health   ║`);
    console.log('╚════════════════════════════════════════════════╝');
    console.log('');
    listRoutes();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);
