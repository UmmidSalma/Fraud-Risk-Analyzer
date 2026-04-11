const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        db.serialize(() => {
            // Users Table
            db.run(`CREATE TABLE IF NOT EXISTS Users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                mobile TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                city TEXT,
                dob TEXT,
                two_factor_enabled BOOLEAN DEFAULT 0,
                transaction_pin_hash TEXT,
                daily_limit REAL DEFAULT 50000,
                transaction_limit REAL DEFAULT 10000,
                night_restriction BOOLEAN DEFAULT 0,
                auto_save_beneficiary BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // User_Devices Table
            db.run(`CREATE TABLE IF NOT EXISTS User_Devices (
                device_id TEXT PRIMARY KEY,
                user_id INTEGER,
                device_name TEXT,
                browser TEXT,
                os TEXT,
                ip_address TEXT,
                last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
                trusted_flag BOOLEAN DEFAULT 0,
                FOREIGN KEY(user_id) REFERENCES Users(user_id)
            )`);

            // Transactions Table
            db.run(`CREATE TABLE IF NOT EXISTS Transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                amount REAL,
                payment_type TEXT,
                receiver_id TEXT,
                receiver_type TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                device_id TEXT,
                location TEXT,
                risk_score REAL,
                risk_level TEXT,
                status TEXT,
                FOREIGN KEY(user_id) REFERENCES Users(user_id),
                FOREIGN KEY(device_id) REFERENCES User_Devices(device_id)
            )`);

            // Fraud_Logs Table
            db.run(`CREATE TABLE IF NOT EXISTS Fraud_Logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER,
                risk_reason TEXT,
                flagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(transaction_id) REFERENCES Transactions(transaction_id)
            )`);
            
            console.log('Tables created or verified.');
        });
    }
});

module.exports = db;
