const app = {
navigate(pageName) {
  const allPages = document.querySelectorAll('.page-view');
  allPages.forEach(page => page.classList.remove('active'));

  const selectedPage = document.getElementById(pageName);
  if (selectedPage) {
    selectedPage.classList.add('active');
    window.scrollTo(0, 0);
  }

  // ✅ ADD THIS BLOCK
  if (pageName === 'view-user-transaction') {
    this.resetTransactionUI();
  }
},
  
  loginSubmit() {
    const email = document.getElementById('loginIdentity').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
      alert('Please fill in all fields');
      return;
    }
    
    if (!this.validateEmail(email)) {
      alert('Invalid email format');
      return;
    }
    
    // Simulate login - navigate to dashboard
    localStorage.setItem('userEmail', email);
    this.navigate('view-user-dashboard');
  },
  
  loginVerifyOtp() {
    const otp = document.getElementById('loginOtp').value;
    if (!otp || otp.length !== 6) {
      alert('Please enter a valid 6-digit OTP');
      return;
    }
    this.navigate('view-user-dashboard');
  },
  
  registerSendOtp() {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    if (!email || !password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }
    
    if (!this.validateEmail(email)) {
      alert('Invalid email format');
      return;
    }
    
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    const strength = this.checkPasswordStrength(password);
    if (strength < 2) {
      alert('Password must contain uppercase, lowercase, numbers, and special characters');
      return;
    }
    
    // Show OTP verification section
    document.getElementById('reg-form').style.display = 'none';
    document.getElementById('reg-otp-ui').style.display = 'block';
    alert('OTP sent to ' + email);
  },
  
  registerSubmit() {
    const otp = document.getElementById('registerOtp').value;
    if (!otp || otp.length !== 6) {
      alert('Please enter a valid 6-digit OTP');
      return;
    }
    
    alert('Registration successful!');
    localStorage.setItem('userEmail', document.getElementById('registerEmail').value);
    this.navigate('view-user-dashboard');
  },
  
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  checkPasswordStrength(password) {
    let strength = 0;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  },

  resetTransactionUI() {
  document.getElementById('txn-form').style.display = 'block';
  document.getElementById('txn-scan-ui').style.display = 'none';
  document.getElementById('txn-verify-ui').style.display = 'none';

  document.getElementById('txnAmount').value = '';
  document.getElementById('txnOtp').value = '';

  const btn = document.getElementById('btn-initiate-txn');
  if (btn) btn.disabled = false;
},
  
  async initiateTransaction() {
  console.log("🚀 Button clicked");

  const amount = document.getElementById('txnAmount').value;

  if (!amount || isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

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

    if (risk.includes("HIGH") || risk.includes("MODERATE")) {
      console.log("⚠️ Calling OTP API");

      await fetch("http://127.0.0.1:5000/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: localStorage.getItem("userEmail")
        })
      });

      console.log("✅ OTP API CALLED");
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
    alert("✅ Transaction Successful");

    this.navigate('view-user-dashboard');
  } else {
    alert("❌ Invalid OTP");
  }
},

  
  logout() {
    localStorage.removeItem('userEmail');
    this.navigate('view-home');
  },
  
  updatePassword() {
    const oldPass = document.getElementById('old-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-new-password').value;
    
    if (!oldPass || !newPass || !confirmPass) {
      alert('Please fill in all fields');
      return;
    }
    
    if (newPass !== confirmPass) {
      alert('New passwords do not match');
      return;
    }
    
    alert('Password updated successfully!');
    document.getElementById('old-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-new-password').value = '';
  },
  
  updateSettings() {
    const notification = document.getElementById('notification-toggle').checked;
    const twoFactor = document.getElementById('2fa-toggle').checked;
    
    localStorage.setItem('notification', notification);
    localStorage.setItem('2fa', twoFactor);
    
    alert('Settings updated successfully!');
  },
  
  cancelSecurityKeyModal() {
    document.getElementById('security-key-modal').style.display = 'none';
  },
  
  verifySecurityKey() {
    const key = document.getElementById('security-key-input').value;
    if (!key || key.length < 8) {
      alert('Invalid security key');
      return;
    }
    alert('Security key verified!');
    document.getElementById('security-key-modal').style.display = 'none';
  },

  detectReceiverProfile() {
  console.log("Detecting receiver...");
},
  
  init() {
    // Initialize app - can add startup logic here
    console.log('App initialized');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => app.init());
