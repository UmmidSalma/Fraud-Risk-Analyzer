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
   initiateTransaction() {
       const fw = document.getElementById('txn-form');
       const sc = document.getElementById('txn-scan-ui');
       const vf = document.getElementById('txn-verify-ui');

       // Hide form, show scan
       fw.style.display = 'none';
       sc.style.display = 'block';

       // Simulate AI Risk analysis
       setTimeout(() => {
           sc.style.display = 'none';
           vf.style.display = 'block';
           
           // Generate random risk 
           const risk = Math.floor(Math.random() * 25);
           const res = document.getElementById('txn-ai-result');
           res.textContent = `[AI Engine: Risk score ${risk}% - Safe Context. Proceed with PIN]`;
           if(risk > 15) {
               res.className = 'warn mb-1';
           } else {
               res.className = 'neon mb-1';
           }
       }, 2500);
   },

   finalizeTransaction() {
       this.navigate('user-transaction-result');
       // Reset transaction form in background
       setTimeout(() => {
           document.getElementById('txn-form').style.display = 'flex';
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
