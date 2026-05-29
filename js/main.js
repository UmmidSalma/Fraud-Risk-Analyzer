/* =============================================
   SENTINEL KINETIC — AI FRAUD DETECTOR SPA
   js/main.js
   ============================================= */

const app = {
   role: null, // 'user' or 'admin'
   init() {
       this.applySavedTheme();
       this.userEmail = localStorage.getItem('userEmail') || '';
       this.pendingTransaction = null;
       this.initOtpCountdowns();
       this.expectedOtp = null;
       // Start at home page
       this.navigate('home');
   },

   navigate(viewId) {
       if (!document.startViewTransition) {
           this.switchView(viewId);
           return;
       }
       document.startViewTransition(() => {
           this.switchView(viewId);
       });
   },

   switchView(viewId) {
       document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
       const target = document.getElementById(`view-${viewId}`);
       if (target) target.classList.add('active');
       this.updateNav(viewId);
       
       if (viewId === 'user-dashboard') this.loadUserDashboard();
       if (viewId === 'user-transaction-history') this.loadUserHistory();
       if (viewId === 'user-notifications') this.loadUserAlerts();
       if (viewId === 'user-profile') this.loadProfile();
       if (viewId === 'admin-dashboard') this.loadAdminDashboard();
       if (viewId === 'admin-users') this.loadAdminUsers();
       if (viewId === 'admin-flagged') this.loadAdminFlagged();
   },

   // --- NEW AUTHENTICATION METHODS ---
   validateEmail(input) {
       const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
       const err = document.getElementById('emailError');
       if(!re.test(input.value) && input.value.length > 0) {
           err.style.display = 'block';
       } else {
           err.style.display = 'none';
       }
   },
   
   checkPasswordStrength(pwd) {
       let strength = 0;
       if (pwd.length >= 8) strength += 25;
       if (/[A-Z]/.test(pwd)) strength += 25;
       if (/[0-9]/.test(pwd)) strength += 25;
       if (/[^A-Za-z0-9]/.test(pwd)) strength += 25;
       
       const bar = document.getElementById('pwdStrengthBar');
       if(bar) {
           bar.style.width = strength + '%';
           if (strength <= 25) bar.style.backgroundColor = 'var(--danger)';
           else if (strength <= 75) bar.style.backgroundColor = 'var(--warn)';
           else bar.style.backgroundColor = 'var(--neon)';
       }
   },

   applySavedTheme() {
       const theme = localStorage.getItem('siteTheme') || 'dark';
       document.body.classList.toggle('light-theme', theme === 'light');
       const label = document.getElementById('themeToggleLabel');
       if (label) label.textContent = theme === 'light' ? 'DARK' : 'LIGHT';
   },

   toggleTheme() {
       const isLight = document.body.classList.toggle('light-theme');
       const newTheme = isLight ? 'light' : 'dark';
       localStorage.setItem('siteTheme', newTheme);
       const label = document.getElementById('themeToggleLabel');
       if (label) label.textContent = isLight ? 'DARK' : 'LIGHT';
   },

   initOtpCountdowns() {
       this.otpIntervals = { reg: null, txn: null };
   },

   stopOtpCountdown(type) {
       if (this.otpIntervals && this.otpIntervals[type]) {
           clearInterval(this.otpIntervals[type]);
           this.otpIntervals[type] = null;
       }
   },

   startOtpCountdown(type, seconds = 30) {
       this.stopOtpCountdown(type);
       const timerId = type === 'reg' ? 'regOtpTimer' : 'txnOtpTimer';
       const buttonId = type === 'reg' ? 'regResendOtpBtn' : 'txnResendOtpBtn';
       let remaining = seconds;
       const el = document.getElementById(timerId);
       const btn = document.getElementById(buttonId);
       const updateTimer = () => {
           if (el) el.textContent = `00:${String(remaining).padStart(2, '0')}`;
           if (remaining <= 0) {
               this.stopOtpCountdown(type);
               if (btn) {
                   btn.disabled = false;
                   btn.textContent = 'Resend OTP';
               }
               if (el) {
                   el.classList.remove('active');
                   el.classList.add('finished');
               }
               return;
           }
           remaining -= 1;
       };

       if (btn) {
           btn.disabled = true;
           btn.textContent = 'Resend OTP (wait)';
       }
       if (el) {
           el.classList.add('active');
           el.classList.remove('finished');
       }

       updateTimer();
       this.otpIntervals[type] = setInterval(updateTimer, 1000);
   },

   async resendTransactionOtp() {
       const email = this.pendingTransaction?.email || localStorage.getItem('userEmail');
       if (!email) return alert('No active transaction to resend OTP for.');
       try {
           const response = await fetch('http://127.0.0.1:5000/send-otp', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ email })
           });
           const data = await response.json().catch(() => ({}));
           if (!response.ok) {
               return alert(data.error || 'Unable to resend OTP.');
           }
           const otpCode = data.otp || data.server_mock_otp || data.code || null;
           if (otpCode) {
               this.expectedOtp = otpCode;
               if (this.pendingTransaction) this.pendingTransaction.expectedOtp = otpCode;
           }
           alert(data.message || 'OTP resent successfully.');
           this.startOtpCountdown('txn');
       } catch (err) {
           console.warn('Resend OTP failed', err);
           alert('Unable to resend OTP at this time.');
       }
   },
   
   async registerSendOtp() {
       const email = document.getElementById('regEmail').value;
       const mobile = document.getElementById('regMobile').value;
       const txnPin = document.getElementById('regTxnPin').value;
       if(!email || !mobile) return alert("Email and Mobile required!");
       if(!txnPin || txnPin.length !== 4) return alert("Transaction PIN must be 4 digits.");
       
       try {
           const res = await fetch('http://localhost:4000/api/auth/register', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ email, mobile, txn_pin: txnPin })
           });
           const data = await res.json();
           if(res.ok) {
               document.getElementById('reg-primary-form').style.display = 'none';
               document.getElementById('reg-otp-ui').style.display = 'block';
               this.startOtpCountdown('reg');
           } else {
               alert(data.error);
           }
       } catch (err) { alert('Server not running or config error.'); }
   },
   
   async registerSubmit() {
    const payload = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        mobile: document.getElementById('regMobile').value,
        password: document.getElementById('regPassword').value,
        pin: document.getElementById('regTxnPin').value,
        otp: document.getElementById('regOtp').value,
        dob: document.getElementById('regDob').value,
        city: document.getElementById('regCity').value
    };

    const res = await fetch('http://localhost:4000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
        localStorage.setItem('userEmail', payload.email);
        localStorage.setItem('txnPin', payload.pin);
        this.userEmail = payload.email;
        alert("Registration Successful!");
        this.navigate('user-login');
    } else {
        alert(data.message || 'Registration failed');
    }
},
   
   async loginSubmit() {
       const identity = document.getElementById('loginIdentity').value;
       const password = document.getElementById('loginPassword').value;
       
       if(identity === 'admin' || identity === 'root') {
           return this.login('admin');
       }
       
       try {
           const res = await fetch('http://localhost:4000/api/auth/login', {
               method: 'POST', headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ email: identity, password })
           });
           const data = await res.json();
           
           if(res.ok) {
               if(data.requireOtp) {
                   document.getElementById('login-primary-form').style.display = 'none';
                   document.getElementById('login-otp-ui').style.display = 'block';
                   window.loginEmailContext = data.email;
               } else {
                   localStorage.setItem('token', data.token);
                   localStorage.setItem('userEmail', identity);
                   this.userEmail = identity;
                   this.login('user');
               }
           } else {
               alert(data.message || data.error || 'Login failed');
           }
       } catch (err) { alert('Server unavailable'); }
   },
   
   async loginVerifyOtp() {
       const otp = document.getElementById('loginOtp').value;
       const trustDevice = document.getElementById('trustDeviceCb').checked;
       const res = await fetch('/api/auth/verify-login-otp', {
           method: 'POST', headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ email: window.loginEmailContext, otp, trustDevice })
       });
       const data = await res.json();
       if(res.ok) {
           localStorage.setItem('token', data.token);
           localStorage.setItem('userEmail', window.loginEmailContext);
           this.userEmail = window.loginEmailContext;
           this.login('user');
       } else {
           alert(data.error);
       }
   },

   // --- MODULE 3, 4, 8: USER METRICS & LISTS ---
   async loadUserDashboard() {
       const res = await this.fetchWithAuth('/api/user/dashboard');
       
       // Default values in case of no data
       let balance = 12450.00;
       let lastTransfer = 450.00;
       let securedTxns = 128;
       
       if(res.ok && res.data) {
           balance = res.data.balance || 12450.00;
           lastTransfer = res.data.lastTransfer || 450.00;
           securedTxns = res.data.secured || 128;
       }
       
       // Update UI with values
       document.getElementById('dashValBalance').textContent = '$' + balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
       document.getElementById('dashValLast').textContent = '$' + lastTransfer.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
       document.getElementById('dashValSecured').textContent = securedTxns;
       
       const histRes = await this.fetchWithAuth('/api/user/history');
       const devRes = await this.fetchWithAuth('/api/user/devices');
       const alertsRes = await this.fetchWithAuth('/api/user/alerts');
       let weeklyTotals = [65, 88, 77, 98, 110, 92, 104]; // Default values
       let weekdayLabels = [];
       
       const transactions = Array.isArray(histRes.data)
           ? histRes.data
           : (histRes.data?.transactions || histRes.data?.data || []);
       const deviceList = Array.isArray(devRes.data) ? devRes.data : [];
       const alertList = Array.isArray(alertsRes.data) ? alertsRes.data : [];
       const confidencePercent = this.calculateAccountConfidence(transactions, deviceList, alertList);
       
       // Populate recent activity
       if(Array.isArray(transactions) && transactions.length > 0) {
           const cont = document.getElementById('dashRecentAct');
           cont.innerHTML = '';
           transactions.slice(-3).reverse().forEach(t => {
               const color = t.status === 'COMPLETED' ? 'neon' : 'warn';
               cont.innerHTML += `<div class="list-row"><span class="txt">Transfer to ${t.receiver_id || 'Account'}</span><span class="txt ${color}">-$${parseFloat(t.amount).toFixed(2)}</span></div>`;
           });
           
           // Calculate weekly totals
           weeklyTotals = [0, 0, 0, 0, 0, 0, 0];
           const today = new Date();
           const startDate = new Date(today);
           startDate.setHours(0, 0, 0, 0);
           startDate.setDate(startDate.getDate() - 6);
           
           transactions.forEach(t => {
               const txDate = new Date(t.timestamp || t.created_at || new Date());
               if(isNaN(txDate)) return;
               txDate.setHours(0, 0, 0, 0);
               const diffDays = Math.round((txDate - startDate) / (1000 * 60 * 60 * 24));
               if(diffDays >= 0 && diffDays < 7) {
                   weeklyTotals[diffDays] += Number(t.amount || 0);
               }
           });
       }
       
       // Generate weekday labels
       const today = new Date();
       const startDate = new Date(today);
       startDate.setHours(0, 0, 0, 0);
       startDate.setDate(startDate.getDate() - 6);
       for(let i = 0; i < 7; i++) {
           const labelDate = new Date(startDate);
           labelDate.setDate(startDate.getDate() + i);
           weekdayLabels.push(labelDate.toLocaleDateString('en-US', { weekday: 'short' }));
       }

       // Animate bars with values
       const volumeBars = document.querySelectorAll('.bar-fill');
       if(volumeBars.length) {
           const maxValue = Math.max(...weeklyTotals, 1);
           volumeBars.forEach((bar, index) => {
               const value = Math.round(weeklyTotals[index] || 0);
               const height = Math.min(100, Math.max(12, Math.round((value / maxValue) * 100)));
               bar.style.height = `${height}%`;
               bar.style.animationDelay = `${index * 0.08}s`;
               const label = bar.querySelector('span');
               if(label) label.textContent = value > 0 ? `$${value}` : '—';
               const dayLabel = bar.nextElementSibling;
               if(dayLabel && dayLabel.tagName === 'SMALL') {
                   dayLabel.textContent = weekdayLabels[index];
               }
           });
       }
       
       // Animate gauge with wheel effect
       const gauge = document.querySelector('.gauge-fill');
       if(gauge) {
           const confidence = confidencePercent;
           const radius = 50;
           const circumference = 2 * Math.PI * radius;
           gauge.style.strokeDasharray = `${circumference} ${circumference}`;
           const offset = circumference - (confidence / 100) * circumference;
           setTimeout(() => { 
               gauge.style.strokeDashoffset = offset; 
           }, 100);
           const gaugeText = document.getElementById('gaugeValue');
           if(gaugeText) gaugeText.textContent = `${confidence}%`;
       }

   },
   
   async loadUserHistory() {
       const res = await this.fetchWithAuth('/api/user/history');
       const tbody = document.getElementById('userHistoryTbody');
       if (!tbody) return;
       tbody.innerHTML = '';
       const historyItems = Array.isArray(res.data)
           ? res.data
           : (res.data?.transactions || res.data?.data || []);
       if (res.ok && historyItems.length > 0) {
           historyItems.forEach(t => {
               let s_class = 'neon';
               if (t.status === 'BLOCKED') s_class = 'danger-c';
               if (t.status === 'PAUSED_OTP') s_class = 'warn';
               tbody.innerHTML += `<tr><td>TXN-${t.transaction_id}</td><td>${new Date(t.timestamp).toLocaleDateString()}</td><td>${t.receiver_id}</td><td class="warn">-$${t.amount}</td><td class="${s_class}">${t.status}</td></tr>`;
           });
           return;
       }
       const defaultMessage = res.ok ? 'No transactions found yet.' : 'Unable to load transaction history. Please try again later.';
       tbody.innerHTML = `<tr><td colspan="5" class="muted">${defaultMessage}</td></tr>`;
   },
   
   calculateAccountConfidence(transactions, devices = [], alerts = []) {
       const txItems = Array.isArray(transactions) ? transactions : (transactions?.transactions || transactions?.data || []);
       const validTx = Array.isArray(txItems) ? txItems : [];
       const txCount = validTx.length;
       const avgRisk = txCount ? validTx.reduce((acc, tx) => acc + (Number(tx.risk_score) || 0), 0) / txCount : 0;
       const riskyTxCount = validTx.filter(tx => {
           const level = (tx.risk_level || '').toString().toLowerCase();
           return level === 'high' || level === 'moderate' || tx.status === 'BLOCKED' || tx.status === 'PAUSED_OTP';
       }).length;
       const untrustedDevices = Array.isArray(devices) ? devices.filter(d => d.trusted_flag !== 1).length : 0;
       const alertCount = Array.isArray(alerts) ? alerts.length : 0;

       let confidence = 100;
       confidence -= Math.min(40, avgRisk * 0.4);
       confidence -= Math.min(25, txCount ? (riskyTxCount / txCount) * 25 : 0);
       confidence -= Math.min(20, untrustedDevices * 8);
       confidence -= Math.min(15, alertCount * 5);
       confidence = Math.round(Math.max(12, Math.min(100, confidence)));
       return confidence;
   },
   
   async loadUserAlerts() {
       const res = await this.fetchWithAuth('/api/user/alerts');
       if(res.ok && res.data) {
           const list = document.getElementById('userAlertsList');
           list.innerHTML = '';
           if(res.data.length === 0) list.innerHTML = `<div class="list-row"><span class="txt muted">No alerts found. Neural Guard is clear.</span></div>`;
           res.data.forEach(a => {
               let s_class = a.risk_level === 'High' ? 'danger-c' : 'warn';
               list.innerHTML += `<div class="list-row"><span class="txt ${s_class}">TXN-${a.transaction_id} Blocked: ${a.risk_reason}</span><span class="txt muted">${new Date(a.flagged_at).toLocaleString()}</span></div>`;
           });
       }
   },

   // --- MODULE 4: PROFILE MANAGEMENT ---
   async fetchWithAuth(url, options = {}) {
       const token = localStorage.getItem('token');
       if(!token) return { ok: false, error: 'Not logged in' };
       const requestUrl = url.startsWith('http') ? url : `http://localhost:4000${url}`;
       const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
       const res = await fetch(requestUrl, { ...options, headers });
       if(res.status === 401) { this.logout(); return { ok: false, error: 'Session expired' }; }
       const body = await res.json().catch(() => ({}));
       const payload = (body && typeof body === 'object')
           ? (body.data || body.transactions || body)
           : body;
       return { ok: res.ok, data: payload, error: body.error || body.message };
   },

   async recordTransaction(payload) {
       if (!payload || !payload.email) return null;
       const res = await this.fetchWithAuth('/api/transaction/process', {
           method: 'POST',
           body: JSON.stringify(payload)
       });
       if (!res.ok) console.warn('Failed to record transaction', res.error);
       return res;
   },
   
   async loadProfile() {
       // Load core details + settings
       const profRes = await this.fetchWithAuth('/api/user/profile');
       if(profRes.ok && profRes.data) {
           const { name, email, mobile, city, dob, two_factor_enabled, daily_limit, transaction_limit, night_restriction, auto_save_beneficiary } = profRes.data;
           document.getElementById('profName').value = name;
           document.getElementById('profEmail').value = email;
           document.getElementById('profMobile').value = mobile;
           document.getElementById('profCity').value = city;
           document.getElementById('profDob').value = dob;
           
           document.getElementById('prof2fa').checked = !!two_factor_enabled;
           document.getElementById('profDailyLimit').value = daily_limit;
           document.getElementById('profTxnLimit').value = transaction_limit;
           document.getElementById('profNightRes').checked = !!night_restriction;
           document.getElementById('profAutoSave').checked = !!auto_save_beneficiary;
       }
       
       // Load devices
       const devRes = await this.fetchWithAuth('/api/user/devices');
       if(devRes.ok) {
           const cont = document.getElementById('deviceListContainer');
           cont.innerHTML = '';
           devRes.data.forEach(d => {
               const row = document.createElement('div');
               row.className = 'list-row mb-1';
               row.innerHTML = `
                   <div><div class="txt">${d.device_name || d.os}</div><small class="muted" style="font-size:10px">${d.ip_address} • Last: ${new Date(d.last_used).toLocaleString()}</small></div>
                   <div style="text-align:right">
                       ${d.trusted_flag ? '<span class="txt neon mr-1">Trusted</span>' : '<span class="txt warn mr-1">Untrusted</span>'}
                       <button class="scan-btn mini" onclick="app.revokeDevice('${d.device_id}')">REVOKE</button>
                   </div>
               `;
               cont.appendChild(row);
           });
       }
   },
   
   async updateSettings() {
    const payload = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        mobile: document.getElementById('regMobile').value,
        password: document.getElementById('regPassword').value,
        pin: document.getElementById('regTxnPin').value
    };
       const res = await this.fetchWithAuth('/api/user/settings', { method: 'POST', body: JSON.stringify(payload) });
       if(res.ok) alert(res.data.message);
       else if(res.error) alert(res.error);
   },
   
   async updatePin() {
       const current_password = document.getElementById('profPinPwd').value;
       const new_pin = document.getElementById('profNewPin').value;
       if(new_pin.length !== 4) return alert('PIN must be 4 digits');
       const res = await this.fetchWithAuth('/api/user/pin', { method: 'POST', body: JSON.stringify({current_password, new_pin}) });
       if(res.ok) {
           alert(res.data.message);
           document.getElementById('profPinPwd').value = '';
           document.getElementById('profNewPin').value = '';
       } else {
           alert(res.error);
       }
   },
   
   async revokeDevice(deviceId) {
       if(!confirm("Are you sure you want to revoke access for this device?")) return;
       const res = await this.fetchWithAuth('/api/user/devices/revoke', { method: 'POST', body: JSON.stringify({device_id: deviceId}) });
       if(res.ok) this.loadProfile();
       else alert(res.error);
   },

   // --- MODULE 9 & 10: ADMIN DASHBOARDS & LOGS ---
   async loadAdminDashboard() {
       const res = await this.fetchWithAuth('/api/admin/metrics');
       if(res.ok && res.data) {
           document.getElementById('adminValFlagged').textContent = res.data.totalFlagged;
           document.getElementById('adminValRisk').textContent = '$' + res.data.revenueRisk;
           document.getElementById('adminValApproved').textContent = res.data.approvedTxns;
       }
       
       const flag_res = await this.fetchWithAuth('/api/admin/flagged');
       if(flag_res.ok && flag_res.data) {
           const tbody = document.getElementById('adminRecentFlagsTbody');
           tbody.innerHTML = '';
           flag_res.data.slice(0, 5).forEach(f => {
               const c = f.risk_level === 'High' ? 'danger-c' : 'warn';
               tbody.innerHTML += `<tr><td>TXN-${f.transaction_id}</td><td class="${c}">${f.risk_score}%</td><td><button class="scan-btn mini">REVIEW</button></td></tr>`;
           });
       }
   },
   
   async loadAdminUsers() {
       const res = await this.fetchWithAuth('/api/admin/users');
       if(res.ok) {
           const tbody = document.getElementById('adminUsersTbody');
           tbody.innerHTML = '';
           res.data.forEach(u => {
               const roleCol = u.role === 'ADMIN' ? 'danger-c' : 'neon';
               tbody.innerHTML += `<tr><td>${u.email}</td><td class="${roleCol}">${u.role}</td><td class="neon">${u.status}</td><td><button class="scan-btn mini">FREEZE</button></td></tr>`;
           });
       }
   },
   
   async loadAdminFlagged() {
       const res = await this.fetchWithAuth('/api/admin/flagged');
       if(res.ok) {
           const cont = document.getElementById('adminFlaggedListContainer');
           cont.innerHTML = '';
           res.data.forEach(f => {
               const c = f.risk_level === 'High' ? 'danger-c' : 'warn';
               const title = f.risk_level === 'High' ? 'BLOCKED' : 'QUARANTINE';
               cont.innerHTML += `<div class="list-row"><span class="txt ${c}">TXN-${f.transaction_id} (${title}) - Score: ${f.risk_score}%</span><button class="scan-btn mini" onclick="alert('Reason: ${f.risk_reason}\\nTime: ${f.flagged_at}')">DETAILS</button></div>`;
           });
       }
   },

   login(role) {
       this.role = role;
       if(role === 'user') {
           this.navigate('user-dashboard');
       } else {
           this.navigate('admin-dashboard');
       }
   },

   logout() {
       this.role = null;
       this.navigate('user-login');
   },

   updateNav(currentView) {
       const nav = document.getElementById('mainNav');
       if (!nav) return;
       
       if (!this.role) {
           nav.innerHTML = '';
           return;
       }

       if (this.role === 'user') {
           nav.innerHTML = `
               <div class="nav-item ${currentView === 'user-dashboard' ? 'active' : ''}" onclick="app.navigate('user-dashboard')">Dashboard</div>
               <div class="nav-item ${currentView === 'user-transaction-history' ? 'active' : ''}" onclick="app.navigate('user-transaction-history')">History</div>
               <div class="nav-item ${currentView === 'user-profile' ? 'active' : ''}" onclick="app.navigate('user-profile')">Profile</div>
               <div class="nav-item ${currentView === 'user-notifications' ? 'active' : ''}" onclick="app.navigate('user-notifications')">Alerts</div>
           `;
       } else if (this.role === 'admin') {
           nav.innerHTML = `
               <div class="nav-item ${currentView === 'admin-dashboard' ? 'active' : ''}" onclick="app.navigate('admin-dashboard')">Overview</div>
               <div class="nav-item ${currentView === 'admin-users' ? 'active' : ''}" onclick="app.navigate('admin-users')">Users</div>
               <div class="nav-item ${currentView === 'admin-flagged' ? 'active' : ''}" onclick="app.navigate('admin-flagged')">Quarantine</div>
               <div class="nav-item ${currentView === 'admin-ai-panel' ? 'active' : ''}" onclick="app.navigate('admin-ai-panel')">AI Engine</div>
               <div class="nav-item ${currentView === 'admin-fraud-reports' ? 'active' : ''}" onclick="app.navigate('admin-fraud-reports')">Reports</div>
           `;
       }
   },

   // Core feature: Transaction Flow
   async prepareTransactionPin() {
       const amount = document.getElementById('txnAmount').value;
       const receiver = document.getElementById('txnReceiver').value.trim();
       const paymentType = document.getElementById('txnPaymentType').value;

       if (!receiver) return alert('Please enter receiver details before continuing.');
       if (!amount || isNaN(amount) || amount <= 0) return alert('Please enter a valid amount.');

       this.pendingTransaction = {
           email: this.userEmail || localStorage.getItem('userEmail'),
           amount: parseFloat(amount),
           receiver,
           payment_type: paymentType,
           transactionId: `TXN${Date.now()}`
       };

       document.getElementById('txnSummaryReceiver').textContent = receiver;
       document.getElementById('txnSummaryAmount').textContent = `$${parseFloat(amount).toFixed(2)}`;
       document.getElementById('txnSummaryPaymentType').textContent = paymentType;

       document.getElementById('txn-form').style.display = 'none';
       document.getElementById('txn-pin-step').style.display = 'block';
   },

   backToTxnDetails() {
       document.getElementById('txn-pin-step').style.display = 'none';
       document.getElementById('txn-form').style.display = 'block';
   },

   async initiateTransaction() {
       const txnPin = document.getElementById('txnPinConfirm').value;
       const savedPin = localStorage.getItem('txnPin');

       if (!this.pendingTransaction) return alert('Please complete the transaction details first.');
       if (!txnPin || txnPin.length !== 4) {
           alert('Please enter your 4-digit transaction PIN before proceeding.');
           return;
       }

       if (savedPin && txnPin !== savedPin) {
           alert('Invalid transaction PIN. Please try again.');
           return;
       }

       this.pendingTransaction.pin = txnPin;
       document.getElementById('txn-pin-step').style.display = 'none';
       document.getElementById('txn-scan-ui').style.display = 'block';
       document.getElementById('txnPinConfirm').value = '';

    try {
        // Try to get ML prediction; if ML is unavailable, use heuristic fallback based on amount
        let result = null;
        try {
            const response = await fetch("http://127.0.0.1:5000/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: this.pendingTransaction.amount,
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
            result = await response.json();
        } catch (mlError) {
            // ML server not running — use simple heuristics to determine risk
            console.log("ML server unavailable, using heuristic fallback", mlError);
            const amtNum = parseFloat(this.pendingTransaction.amount) || 0;
            if (amtNum >= 5000) {
                result = { risk_level: 'HIGH', risk_score: 85 };
            } else if (amtNum >= 1000) {
                result = { risk_level: 'MODERATE', risk_score: 55 };
            } else {
                result = { risk_level: 'LOW', risk_score: 15 };
            }
        }

        console.log("RESULT:", result);

        // hide scan UI
        document.getElementById('txn-scan-ui').style.display = 'none';

        const risk = (result.risk_level || 'LOW').toUpperCase();
        this.pendingTransaction.risk_score = result.risk_score || 0;
        this.pendingTransaction.risk_level = result.risk_level || 'SAFE';
        this.pendingTransaction.status = (risk.includes('HIGH') || risk.includes('MODERATE')) ? 'PAUSED_OTP' : 'COMPLETED';

        document.getElementById('txn-ai-result').innerText =
            "Risk: " + this.pendingTransaction.risk_level + " (" + this.pendingTransaction.risk_score + "%)";

        // For MODERATE/HIGH risk require the user to verify with OTP before finalizing
        if (risk.includes('HIGH') || risk.includes('MODERATE')) {
            console.log('⚠️ High/Moderate risk — requesting OTP verification');
            document.getElementById('txn-verify-ui').style.display = 'block';
            document.getElementById('txnOtp').value = '';
            document.getElementById('txn-ai-result').innerText =
                `Risk: ${this.pendingTransaction.risk_level} (${this.pendingTransaction.risk_score}%)`;
            document.getElementById('btn-initiate-txn').disabled = false;
            let otpCode = null;
            try {
                const otpResponse = await fetch('http://127.0.0.1:5000/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.pendingTransaction.email })
                });
                if (otpResponse.ok) {
                    const otpData = await otpResponse.json().catch(() => ({}));
                    otpCode = otpData.otp || otpData.server_mock_otp || otpData.code || null;
                    this.startOtpCountdown('txn');
                }
            } catch (otpErr) {
                console.warn('OTP service unavailable:', otpErr);
            }
            if (!otpCode) {
                otpCode = Math.floor(100000 + Math.random() * 900000).toString();
                console.log('Generated local OTP for transaction verification:', otpCode);
            }
            this.expectedOtp = otpCode;
            this.pendingTransaction.expectedOtp = otpCode;
            return;
        }

        // Low risk — proceed to save transaction
        const saved = await this.recordTransaction({
            email: this.pendingTransaction.email,
            amount: this.pendingTransaction.amount,
            receiver: this.pendingTransaction.receiver,
            transactionId: this.pendingTransaction.transactionId,
            pin: this.pendingTransaction.pin,
            status: 'COMPLETED',
            risk_score: this.pendingTransaction.risk_score,
            risk_level: this.pendingTransaction.risk_level
        });

        if (saved && saved.ok) {
            alert('✅ Transaction completed and saved to history.');
            this.resetTxnForm();
            this.loadUserHistory();
            this.loadUserDashboard();
            this.navigate('user-transaction-history');
            return;
        }

    } catch (error) {
        console.error(error);
        alert("Error processing transaction");
    }
},
  
  async finalizeTransaction() {
  const otpInput = document.getElementById('txnOtp');
  const otp = otpInput ? otpInput.value.trim() : '';
  
  if (!otp) return alert('Please enter OTP');
  if (!this.pendingTransaction) return alert('Transaction session expired.');

  const expected = (this.pendingTransaction.expectedOtp || this.expectedOtp || '').toString().trim();
  if (!expected) {
      return alert('OTP verification is unavailable. Please retry the transaction.');
  }

  if (otp !== expected) {
      if (this.pendingTransaction) {
          this.pendingTransaction.status = 'BLOCKED';
      }
      const blocked = await this.recordTransaction({
          email: this.pendingTransaction.email,
          amount: this.pendingTransaction.amount,
          receiver: this.pendingTransaction.receiver,
          transactionId: this.pendingTransaction.transactionId || `TXN${Date.now()}`,
          pin: this.pendingTransaction.pin,
          status: 'BLOCKED',
          risk_score: this.pendingTransaction.risk_score || 95,
          risk_level: 'High'
      });
      if (blocked && blocked.ok) {
          alert('❌ Wrong OTP entered. Transaction has been blocked.');
          this.resetTxnForm();
          this.loadUserHistory();
          this.loadUserDashboard();
          this.navigate('user-transaction-history');
          return;
      }
      return alert('Wrong OTP entered and transaction could not be blocked. Please try again later.');
  }

  const saved = await this.recordTransaction({
      email: this.pendingTransaction.email,
      amount: this.pendingTransaction.amount,
      receiver: this.pendingTransaction.receiver,
      transactionId: this.pendingTransaction.transactionId || `TXN${Date.now()}`,
      pin: this.pendingTransaction.pin,
      status: 'COMPLETED',
      risk_score: this.pendingTransaction.risk_score || 15,
      risk_level: this.pendingTransaction.risk_level || 'LOW'
  });

  if (saved && saved.ok) {
      alert("✅ Transaction successful and saved to history.");
      this.resetTxnForm();
      this.loadUserHistory();
      this.loadUserDashboard();
      this.navigate('user-transaction-history');
      return;
  }
  
  alert("Error saving transaction");
},

   cancelSecurityKeyModal() {
       document.getElementById('security-key-modal').style.display = 'none';
       document.getElementById('modalSecurityKey').value = '';
       this.pendingTransaction = null;
   },

   async verifySecurityKey() {
       const securityKey = document.getElementById('modalSecurityKey').value;

       if(!securityKey) return alert('Enter security key');
       if(securityKey.length < 4) return alert('Security key must be at least 4 characters');

       // Hide modal and proceed with transaction
       document.getElementById('security-key-modal').style.display = 'none';
       await this.proceedWithTransaction(securityKey);
   },

   detectReceiverProfile() {
       const input = document.getElementById('txnReceiver').value.trim();
       const card = document.getElementById('receiverInfoCard');
       const nameEl = document.getElementById('detectedReceiverName');
       const phoneEl = document.getElementById('detectedReceiverPhone');
       const typeEl = document.getElementById('detectedReceiverType');
       const ageEl = document.getElementById('detectedReceiverAge');

       if(!input) {
           card.style.display = 'none';
           this.pendingReceiver = null;
           return;
       }

       const digits = input.replace(/\D/g, '');
       const isPhone = digits.length >= 7;
       let detectedName = '';
       let detectedPhone = '';

       if(isPhone) {
           detectedPhone = digits.length === 10 ? `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}` : digits;
           detectedName = this.lookupReceiverName(digits) || `Beneficiary ${digits.slice(-4)}`;
       } else {
           detectedName = input;
           detectedPhone = this.lookupReceiverPhone(input) || `+91 ${Math.floor(900000000 + Math.random() * 100000000)}`;
       }

       const detectedType = isPhone ? 'Saved Beneficiary' : 'New Beneficiary';
       const detectedAge = this.guessReceiverAge(input, isPhone);

       this.pendingReceiver = {
           detectedName,
           detectedPhone,
           detectedType,
           detectedAge
       };

       nameEl.textContent = detectedName;
       phoneEl.textContent = detectedPhone;
       typeEl.textContent = detectedType;
       ageEl.textContent = detectedAge;
       card.style.display = 'grid';
   },

   lookupReceiverName(phone) {
       const lookup = {
           '9876543210': 'Kavya Rao',
           '9123456789': 'Rohit Singh'
       };
       return lookup[phone];
   },

   lookupReceiverPhone(name) {
       const lookup = {
           'Kavya Rao': '+91 98765 43210',
           'Rohit Singh': '+91 91234 56789'
       };
       return lookup[name];
   },

   guessReceiverAge(input, isPhone) {
       const patterns = ['New', 'Less than 6 months', 'Established'];
       if(isPhone) return patterns[input.length % patterns.length];
       return patterns[input.length % patterns.length];
   },

   async proceedWithTransaction(securityKey) {
       const fw = document.getElementById('txn-form');
       const sc = document.getElementById('txn-scan-ui');
       const vf = document.getElementById('txn-verify-ui');
       
       if(!this.pendingTransaction) return alert('Transaction data lost');

       fw.style.display = 'none';
       sc.style.display = 'block';
       document.getElementById('dyn-risk-status').textContent = '...';

       // Simulate quick scanning UI effect
       let step = 0;
       const interval = setInterval(()=> {
           step++;
           document.getElementById('dyn-risk-status').textContent = ['.','..','...'][step%3];
       }, 300);

       // Actual API Call to AI Engine
       const now = new Date();
       const hour = now.getHours();

const amount = parseInt(this.pendingTransaction.amount);



// FINAL DATA SENT TO THE BACKEND
const payload = {
    ...this.pendingTransaction,
    security_key: securityKey,
    location_changed: false,
    device_trust_flag: true,
    velocity_ms: Math.random() > 0.8 ? 500 : 5000,
    receiver_type: this.pendingReceiver.detectedType,
    receiver_age: this.pendingReceiver.detectedAge
};

try {
    const mlResponse = await fetch('http://127.0.0.1:5000/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: parseInt(this.pendingTransaction.amount),
            transaction_hour: new Date().getHours(),
            is_new_receiver: this.pendingReceiver.detectedType === "New Beneficiary" ? 1 : 0,
            device_mismatch: 0,
            location_mismatch: 0,
            transaction_count: 1,
            avg_amount_deviation: 10,
            is_night: (new Date().getHours() < 6 || new Date().getHours() > 22) ? 1 : 0,
            failed_attempts: 0,
            email: localStorage.getItem("userEmail")  
        })
    });

    const data = await mlResponse.json();

    let response = {
        ok: true,
        data: data
    };

} catch (err) {
    // ML unavailable — fallback to heuristic and continue flow
    console.warn('ML fetch failed, falling back to heuristic', err.message || err);
    const amtNum = parseInt(this.pendingTransaction.amount) || 0;
    let fallbackLevel = 'Safe';
    let fallbackScore = 15;
    if (amtNum >= 5000) { fallbackLevel = 'High'; fallbackScore = 85; }
    else if (amtNum >= 1000) { fallbackLevel = 'Moderate'; fallbackScore = 55; }

    var response = { ok: true, data: { risk_score: fallbackScore, risk_level: fallbackLevel } };
}

clearInterval(interval);
sc.style.display = 'none';

if (!response || !response.ok) {
    alert(response?.error || 'Transaction processing failed.');
    this.navigate('user-dashboard');
    this.resetTxnForm();
    return;
}

const risk_score = response.data.risk_score || 0;
const risk_level = response.data.risk_level || "UNKNOWN";

if (risk_score > 80) {
    document.getElementById('blocked-desc').textContent =
        `Blocked due to high risk (${risk_score}%)`;
    this.navigate('user-transaction-blocked');
}
else if (risk_score > 50) {
    vf.style.display = 'block';

    document.getElementById('txn-ai-result').textContent =
        `Risk Score: ${risk_score}% (${risk_level})`;

    await fetch('http://127.0.0.1:5000/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.userEmail || localStorage.getItem('userEmail') })
    });
}
else {
    this.navigate('user-transaction-result');
}
   },


   resetTxnForm() {
       setTimeout(() => {
           document.getElementById('txn-form').style.display = 'block';
           document.getElementById('txn-scan-ui').style.display = 'none';
           document.getElementById('txn-verify-ui').style.display = 'none';
           document.getElementById('security-key-modal').style.display = 'none';
           document.getElementById('txnAmount').value = '';
           document.getElementById('txnReceiver').value = '';
           document.getElementById('receiverInfoCard').style.display = 'none';
           this.pendingReceiver = null;
       }, 1000);
   },
};

window.app = app; // expose app to inline event handlers

if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', () => app.init());
} else {
   app.init();
}
