const app = {
  navigate(pageName) {
    const allPages = document.querySelectorAll('.page-view');
    allPages.forEach(page => page.classList.remove('active'));
    const selectedPage = document.getElementById(pageName);
    if (selectedPage) {
      selectedPage.classList.add('active');
      window.scrollTo(0, 0);
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
  
  initiateTransaction() {
    const amount = document.getElementById('transaction-amount').value;
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    document.getElementById('transaction-form').style.display = 'none';
    document.getElementById('transaction-verification').style.display = 'block';
  },
  
  finalizeTransaction() {
    alert('Transaction processed successfully!');
    document.getElementById('transaction-form').style.display = 'block';
    document.getElementById('transaction-verification').style.display = 'none';
    document.getElementById('transaction-amount').value = '';
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
  
  init() {
    // Initialize app - can add startup logic here
    console.log('App initialized');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => app.init());
