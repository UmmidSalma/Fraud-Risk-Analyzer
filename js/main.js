/* =============================================
   SENTINEL KINETIC — AI FRAUD DETECTOR SPA
   js/main.js
   ============================================= */

const app = {
   role: null, // 'user' or 'admin'
   init() {
       // Start at login
       this.navigate('user-login');
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
   
   async registerSendOtp() {
       const email = document.getElementById('regEmail').value;
       const mobile = document.getElementById('regMobile').value;
       if(!email || !mobile) return alert("Email and Mobile required!");
       
       try {
           const res = await fetch('/api/auth/send-otp', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ email, mobile })
           });
           const data = await res.json();
           if(res.ok) {
               document.getElementById('reg-primary-form').style.display = 'none';
               document.getElementById('reg-otp-ui').style.display = 'block';
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
           dob: document.getElementById('regDob').value,
           city: document.getElementById('regCity').value,
           password: document.getElementById('regPassword').value,
           otp: document.getElementById('regOtp').value
       };
       const res = await fetch('/api/auth/register', {
           method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
       });
       if(res.ok) {
           alert("Registration Successful!");
           this.navigate('user-login');
       } else {
           const data = await res.json();
           alert(data.error);
       }
   },
   
   async loginSubmit() {
       const identity = document.getElementById('loginIdentity').value;
       const password = document.getElementById('loginPassword').value;
       
       if(identity === 'admin' || identity === 'root') {
           return this.login('admin');
       }
       
       try {
           const res = await fetch('/api/auth/login', {
               method: 'POST', headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ identity, password })
           });
           const data = await res.json();
           
           if(res.ok) {
               if(data.requireOtp) {
                   document.getElementById('login-primary-form').style.display = 'none';
                   document.getElementById('login-otp-ui').style.display = 'block';
                   window.loginEmailContext = data.email;
               } else {
                   localStorage.setItem('token', data.token);
                   this.login('user');
               }
           } else {
               alert(data.error || 'Login failed');
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
           this.login('user');
       } else {
           alert(data.error);
       }
   },

   // --- MODULE 3, 4, 8: USER METRICS & LISTS ---
   async loadUserDashboard() {
       const res = await this.fetchWithAuth('/api/user/dashboard');
       if(res.ok && res.data) {
           document.getElementById('dashValSecured').textContent = res.data.secured;
           document.getElementById('dashValLast').textContent = '$' + res.data.lastTransfer;
           document.getElementById('dashValBalance').textContent = '$' + (100000 - res.data.lastTransfer).toFixed(2); // Simulated balance
       }
       
       const histRes = await this.fetchWithAuth('/api/user/history');
       if(histRes.ok && histRes.data) {
           const cont = document.getElementById('dashRecentAct');
           cont.innerHTML = '';
           histRes.data.slice(0, 3).forEach(t => {
               const color = t.status === 'COMPLETED' ? 'neon' : 'warn';
               cont.innerHTML += `<div class="list-row"><span class="txt">Transfer to ${t.receiver_id}</span><span class="txt ${color}">-$${t.amount}</span></div>`;
           });
       }
   },
   
   async loadUserHistory() {
       const res = await this.fetchWithAuth('/api/user/history');
       if(res.ok && res.data) {
           const tbody = document.getElementById('userHistoryTbody');
           tbody.innerHTML = '';
           res.data.forEach(t => {
               let s_class = 'neon';
               if(t.status === 'BLOCKED') s_class = 'danger-c';
               if(t.status === 'PAUSED_OTP') s_class = 'warn';
               tbody.innerHTML += `<tr><td>TXN-${t.transaction_id}</td><td>${new Date(t.timestamp).toLocaleDateString()}</td><td>${t.receiver_id}</td><td class="warn">-$${t.amount}</td><td class="${s_class}">${t.status}</td></tr>`;
           });
       }
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
       const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
       const res = await fetch(url, { ...options, headers });
       if(res.status === 401) { this.logout(); return { ok: false, error: 'Session expired' }; }
       const data = await res.json().catch(()=>({}));
       return { ok: res.ok, data, error: data.error };
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
           two_factor_enabled: document.getElementById('prof2fa').checked ? 1 : 0,
           daily_limit: parseFloat(document.getElementById('profDailyLimit').value),
           transaction_limit: parseFloat(document.getElementById('profTxnLimit').value),
           night_restriction: document.getElementById('profNightRes').checked ? 1 : 0,
           auto_save_beneficiary: document.getElementById('profAutoSave').checked ? 1 : 0,
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
   async initiateTransaction() {
       const fw = document.getElementById('txn-form');
       const sc = document.getElementById('txn-scan-ui');
       const vf = document.getElementById('txn-verify-ui');

       const amount = document.getElementById('txnAmount').value;
       const receiver_id = document.getElementById('txnReceiver').value;
       const payment_type = document.getElementById('txnPaymentType').value;
       const receiver_age = document.getElementById('txnReceiverAge').value;
       const receiver_type = document.getElementById('txnReceiverType').value;

       if(!amount || !receiver_id) return alert('Enter amount and receiver');

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
       const payload = {
           amount, payment_type, receiver_id, receiver_age, receiver_type,
           location_changed: false, // simulated
           device_trust_flag: true, // simulated based on current auth
           velocity_ms: Math.random() > 0.8 ? 500 : 5000 // randomly simulate bot velocity sometimes
       };

       const res = await this.fetchWithAuth('/api/txn/process', { method: 'POST', body: JSON.stringify(payload) });
       
       clearInterval(interval);
       sc.style.display = 'none';

       if(res.ok) {
           const { status, risk_score, risk_level, message, reasons, txnId, server_mock_otp } = res.data;
           window.currentTxnId = txnId;
           window.mockRealOtp = server_mock_otp;

           if(status === 'BLOCKED') {
               // High Risk => Block immediately
               alert(`🚨 HIGH RISK BLOCKED (${risk_score}%)\nReason: ${reasons}`);
               this.navigate('user-dashboard'); // kick back to dash
               this.resetTxnForm();
           } else if(status === 'PAUSED_OTP') {
               // Moderate Risk => Pause for OTP
               vf.style.display = 'block';
               const resEl = document.getElementById('txn-ai-result');
               resEl.textContent = `[AI Engine: Risk score ${risk_score}% - ${message}]`;
               resEl.className = 'warn mb-1';
           } else {
               // Safe => Process immediately
               this.navigate('user-transaction-result');
               this.resetTxnForm();
           }
       } else {
           alert(res.error || 'Failed to process transaction');
           this.resetTxnForm();
       }
   },

   async finalizeTransaction() {
       const otp = document.getElementById('txnOtp').value;
       const res = await this.fetchWithAuth('/api/txn/confirm-otp', {
           method: 'POST', body: JSON.stringify({ txnId: window.currentTxnId, entered_otp: otp, real_otp: window.mockRealOtp })
       });

       if(res.ok) {
           this.navigate('user-transaction-result');
           this.resetTxnForm();
       } else {
           alert(res.error);
       }
   },

   resetTxnForm() {
       setTimeout(() => {
           document.getElementById('txn-form').style.display = 'block';
           document.getElementById('txn-scan-ui').style.display = 'none';
           document.getElementById('txn-verify-ui').style.display = 'none';
           document.getElementById('txnAmount').value = '';
           document.getElementById('txnReceiver').value = '';
       }, 1000);
   }
};

document.addEventListener('DOMContentLoaded', () => {
   app.init();
});
