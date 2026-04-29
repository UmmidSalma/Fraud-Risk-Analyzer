// SecureWith.AI Backend Server
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// In-memory storage (in production, use a database)
const users = {};
const otps = {};
const transactions = [];

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
app.post('/api/auth/register', (req, res) => {
  const { email, mobile, password, name, pin } = req.body;

  if (!email || !mobile || !password || !name || !pin) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (users[email]) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  // Generate and store OTP
  const otp = generateOTP();
  otps[email] = { otp, timestamp: Date.now(), mobile };

  // Store user temporarily
  users[email] = {
    email,
    mobile,
    password, // In production, hash this!
    name,
    pin,
    registered: false,
  };

  res.json({
    success: true,
    message: 'OTP sent to email and SMS',
    email,
    mobile,
    otp: otp, // Return OTP for testing (in production, remove this)
  });
});

// Verify OTP for Registration
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!otps[email] || otps[email].otp !== otp) {
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }

  // Mark user as registered
  if (users[email]) {
    users[email].registered = true;
  }

  delete otps[email];

  res.json({
    success: true,
    message: 'Registration successful',
    email,
  });
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!users[email] || users[email].password !== password) {
    return res.status(400).json({ success: false, message: 'Invalid credentials' });
  }

  if (!users[email].registered) {
    return res.status(400).json({ success: false, message: 'Please verify your email first' });
  }

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      email: users[email].email,
      name: users[email].name,
      mobile: users[email].mobile,
    },
  });
});

// ==================== TRANSACTION ENDPOINTS ====================

// Initiate Neural Scan
app.post('/api/transaction/neural-scan', (req, res) => {
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

  // Simulate neural scan analysis
  const scanResult = {
    deviceFingerprint: 'DEV-' + Math.random().toString(36).substr(2, 12).toUpperCase(),
    locationRisk: Math.random() > 0.7 ? 'HIGH' : 'LOW',
    behaviorScore: (Math.random() * 100).toFixed(2),
    anomalyDetected: Math.random() > 0.8,
    riskLevel: Math.random() > 0.6 ? 'LOW' : 'MEDIUM',
    fraudProbability: (Math.random() * 30).toFixed(2) + '%',
  };

  res.json({
    success: true,
    message: 'Neural scan completed',
    transactionId: generateTransactionId(),
    scanResult,
    recommendation: scanResult.riskLevel === 'LOW' ? 'APPROVED' : 'REVIEW_REQUIRED',
  });
});

// Process Transaction
app.post('/api/transaction/process', (req, res) => {
  const { email, amount, receiver, pin, transactionId } = req.body;

  if (!email || !amount || !receiver || !pin || !transactionId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (!users[email]) {
    return res.status(400).json({ success: false, message: 'User not found' });
  }

  if (users[email].pin !== pin) {
    return res.status(400).json({ success: false, message: 'Invalid PIN' });
  }

  // Create transaction record
  const transaction = {
    id: transactionId,
    email,
    amount,
    receiver,
    timestamp: new Date().toISOString(),
    status: 'COMPLETED',
    deviceId: 'DEV-' + Math.random().toString(36).substr(2, 12),
    timestamp: Date.now(),
  };

  transactions.push(transaction);

  res.json({
    success: true,
    message: 'Transaction completed successfully',
    transaction,
  });
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
  }));

  res.json({
    success: true,
    users: userList,
    totalUsers: userList.length,
  });
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

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  SecureWith.AI Backend Server Running         ║');
  console.log(`║  Server: http://localhost:${PORT}                    ║`);
  console.log('║  API Docs: http://localhost:3000/api/health   ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
});
