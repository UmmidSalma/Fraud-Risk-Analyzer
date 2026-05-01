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
       if(res.ok && res.data) {
           document.getElementById('dashValSecured').textContent = res.data.secured;
           document.getElementById('dashValLast').textContent = '$' + res.data.lastTransfer;
           document.getElementById('dashValBalance').textContent = '$' + (100000 - res.data.lastTransfer).toFixed(2); // Simulated balance
       }
       
       const histRes = await this.fetchWithAuth('/api/user/history');
       let weeklyTotals = [0, 0, 0, 0, 0, 0, 0];
       let weekdayLabels = [];
       if(histRes.ok && histRes.data) {
           const cont = document.getElementById('dashRecentAct');
           cont.innerHTML = '';
           histRes.data.slice(0, 3).forEach(t => {
               const color = t.status === 'COMPLETED' ? 'neon' : 'warn';
               cont.innerHTML += `<div class="list-row"><span class="txt">Transfer to ${t.receiver_id}</span><span class="txt ${color}">-$${t.amount}</span></div>`;
           });
           const today = new Date();
           const startDate = new Date(today);
           startDate.setHours(0, 0, 0, 0);
           startDate.setDate(startDate.getDate() - 6);
           for(let i = 0; i < 7; i++) {
               const labelDate = new Date(startDate);
               labelDate.setDate(startDate.getDate() + i);
               weekdayLabels.push(labelDate.toLocaleDateString('en-US', { weekday: 'short' }));
           }
           histRes.data.forEach(t => {
               const txDate = new Date(t.timestamp || t.created_at || t.date);
               if(isNaN(txDate)) return;
               txDate.setHours(0, 0, 0, 0);
               const diffDays = Math.round((txDate - startDate) / (1000 * 60 * 60 * 24));
               if(diffDays >= 0 && diffDays < 7) {
                   weeklyTotals[diffDays] += Number(t.amount || 0);
               }
           });
       }

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
       const gauge = document.querySelector('.gauge-fill');
       if(gauge) {
           const percent = Math.min(100, Math.max(35, Math.round((weeklyTotals.reduce((sum, v) => sum + v, 0) / 700) * 100)));
           const radius = 50;
           const circumference = 2 * Math.PI * radius;
           gauge.style.strokeDasharray = `${circumference} ${circumference}`;
           const offset = circumference - (percent / 100) * circumference;
           setTimeout(() => { gauge.style.strokeDashoffset = offset; }, 100);
           const gaugeText = document.getElementById('gaugeValue');
           if(gaugeText) gaugeText.textContent = `${percent}%`;
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
       const requestUrl = url.startsWith('http') ? url : `http://localhost:4000${url}`;
       const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
       const res = await fetch(requestUrl, { ...options, headers });
       if(res.status === 401) { this.logout(); return { ok: false, error: 'Session expired' }; }
       const data = await res.json().catch(()=>({}));
       return { ok: res.ok, data, error: data.error };
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
   async initiateTransaction() {
  console.log("🚀 Button clicked");

  const amount = document.getElementById('txnAmount').value;
  const receiver = document.getElementById('txnReceiver').value.trim() || 'Unknown Recipient';

  if (!amount || isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  this.pendingTransaction = {
      email: this.userEmail || localStorage.getItem('userEmail'),
      amount: parseFloat(amount),
      receiver,
      transactionId: `TXN${Date.now()}`
  };

  document.getElementById('txn-form').style.display = 'none';
  document.getElementById('txn-scan-ui').style.display = 'block';
  document.getElementById('btn-initiate-txn').disabled = true;

  try {
    const response = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

    const result = await response.json();   // ✅ MUST come before using result
    console.log("ML RESULT:", result);

    document.getElementById('txn-scan-ui').style.display = 'none';
    document.getElementById('txn-verify-ui').style.display = 'block';

    document.getElementById('txn-ai-result').innerText =
      "Risk: " + result.risk_level + " (" + result.risk_score + "%)";

    const risk = result.risk_level.toUpperCase();
    this.pendingTransaction.risk_score = result.risk_score || 0;
    this.pendingTransaction.risk_level = result.risk_level || 'SAFE';
    this.pendingTransaction.status = (risk.includes('HIGH') || risk.includes('MODERATE')) ? 'PAUSED_OTP' : 'COMPLETED';

    if (risk.includes("HIGH") || risk.includes("MODERATE")) {
      console.log("⚠️ Calling OTP API");

      await fetch("http://127.0.0.1:5000/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: this.pendingTransaction.email
        })
      });

      console.log("✅ OTP API CALLED");
    } else {
      const saved = await this.recordTransaction({
          email: this.pendingTransaction.email,
          amount: this.pendingTransaction.amount,
          receiver: this.pendingTransaction.receiver,
          transactionId: this.pendingTransaction.transactionId,
          status: 'COMPLETED',
          risk_score: this.pendingTransaction.risk_score,
          risk_level: this.pendingTransaction.risk_level
      });
      if (saved && saved.ok) {
          alert('✅ Transaction completed and saved to history.');
          this.resetTxnForm();
          this.loadUserHistory();
          this.navigate('user-transaction-history');
          return;
      }
    }

  } catch (error) {
    console.error(error);
    alert("Error connecting to backend");
  }
},
  
  async finalizeTransaction() {
  const otp = document.getElementById('txnOtp').value;

  const response = await fetch("http://127.0.0.1:5000/verify-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      otp: otp,
      email: localStorage.getItem("userEmail")   
    })
  });

  const result = await response.json();

  if (result.message === "OTP verified") {
    const saved = await this.recordTransaction({
        email: this.pendingTransaction?.email || localStorage.getItem('userEmail'),
        amount: this.pendingTransaction?.amount,
        receiver: this.pendingTransaction?.receiver,
        transactionId: this.pendingTransaction?.transactionId || `TXN${Date.now()}`,
        status: 'COMPLETED',
        risk_score: this.pendingTransaction?.risk_score,
        risk_level: this.pendingTransaction?.risk_level
    });

    if (saved && saved.ok) {
        alert("✅ Transaction successful and saved to history.");
        this.resetTxnForm();
        this.loadUserHistory();
        this.navigate('user-transaction-history');
        return;
    }

    alert("✅ Transaction Successful");
    this.navigate('view-user-dashboard');
  } else {
    alert("❌ Invalid OTP");
  }
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
    clearInterval(interval);
    sc.style.display = 'none';
    alert('ML server not running');
    this.resetTxnForm();
    return;
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
