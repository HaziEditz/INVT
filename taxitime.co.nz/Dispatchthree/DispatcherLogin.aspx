<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BookaWaka — Dispatcher Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117;
      min-height: 100vh;
      display: flex;
      align-items: stretch;
    }

    /* ── Left panel ─────────────────────────────────── */
    .brand-panel {
      flex: 1 1 45%;
      background: linear-gradient(135deg, #1a1d21 0%, #0f1117 50%, #1a2340 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      padding: 60px 56px;
      position: relative;
      overflow: hidden;
    }

    .brand-panel::before {
      content: '';
      position: absolute;
      top: -120px; right: -120px;
      width: 420px; height: 420px;
      background: radial-gradient(circle, rgba(250,190,30,0.10) 0%, transparent 70%);
      pointer-events: none;
    }

    .brand-panel::after {
      content: '';
      position: absolute;
      bottom: -80px; left: -80px;
      width: 320px; height: 320px;
      background: radial-gradient(circle, rgba(79,106,255,0.10) 0%, transparent 70%);
      pointer-events: none;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 56px;
    }

    .brand-logo .taxi-icon {
      width: 48px; height: 48px;
      background: #f5be1e;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
    }

    .brand-logo .brand-name {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.3px;
    }

    .brand-logo .brand-tagline {
      font-size: 11px;
      color: #6b7280;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .brand-headline {
      font-size: 38px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.15;
      letter-spacing: -1px;
      margin-bottom: 20px;
    }

    .brand-headline span {
      color: #f5be1e;
    }

    .brand-desc {
      font-size: 15px;
      color: #9ca3af;
      line-height: 1.7;
      max-width: 380px;
      margin-bottom: 48px;
    }

    .brand-features {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #d1d5db;
      font-size: 14px;
      font-weight: 500;
    }

    .feature-dot {
      width: 8px; height: 8px;
      background: #f5be1e;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── Right panel (login form) ───────────────────── */
    .login-panel {
      flex: 0 0 420px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 56px 48px;
      min-height: 100vh;
    }

    .login-header {
      margin-bottom: 36px;
    }

    .login-header h2 {
      font-size: 26px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }

    .login-header p {
      font-size: 14px;
      color: #6b7280;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 7px;
    }

    .form-group input {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: #111827;
      background: #f9fafb;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }

    .form-group input:focus {
      border-color: #f5be1e;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(245,190,30,0.12);
    }

    .form-group input.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239,68,68,0.10);
    }

    .btn-login {
      width: 100%;
      padding: 13px;
      background: #1a1d21;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-top: 8px;
      letter-spacing: -0.2px;
    }

    .btn-login:hover { background: #2d3035; }
    .btn-login:active { transform: scale(0.99); }

    .btn-login:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }

    .error-box {
      display: none;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #dc2626;
      font-weight: 500;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 28px 0;
      color: #d1d5db;
      font-size: 12px;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }

    .signup-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
    }

    .signup-card p {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 12px;
      line-height: 1.5;
    }

    .btn-contact {
      display: inline-block;
      padding: 9px 20px;
      background: transparent;
      border: 1.5px solid #d1d5db;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      color: #374151;
      cursor: pointer;
      text-decoration: none;
      transition: border-color 0.2s, color 0.2s;
    }

    .btn-contact:hover { border-color: #9ca3af; color: #111827; }

    .footer-note {
      margin-top: 32px;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }

    /* ── Spinner inside button ──────────────────────── */
    .spinner {
      display: inline-block;
      width: 15px; height: 15px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Demo hint ──────────────────────────────────── */
    .demo-hint {
      background: rgba(245,190,30,0.08);
      border: 1px solid rgba(245,190,30,0.3);
      border-radius: 7px;
      padding: 10px 14px;
      margin-bottom: 20px;
      font-size: 12px;
      color: #92650a;
    }

    /* ── Responsive ─────────────────────────────────── */
    @media (max-width: 860px) {
      body { flex-direction: column; }
      .brand-panel {
        flex: none;
        padding: 40px 32px;
        min-height: auto;
      }
      .brand-headline { font-size: 28px; }
      .brand-features { display: none; }
      .login-panel {
        flex: none;
        min-height: auto;
        padding: 40px 32px 48px;
      }
    }

    @media (max-width: 520px) {
      .brand-panel { padding: 32px 24px; }
      .login-panel { padding: 32px 20px 40px; }
    }
  </style>
</head>
<body>

  <!-- ── Left: Branding ── -->
  <div class="brand-panel">
    <div class="brand-logo">
      <div class="taxi-icon">🚗</div>
      <div>
        <div class="brand-name">BookaWaka</div>
        <div class="brand-tagline">Dispatch Console</div>
      </div>
    </div>

    <h1 class="brand-headline">
      Real-time dispatch<br />
      <span>at your fingertips.</span>
    </h1>

    <p class="brand-desc">
      Manage bookings, track drivers on a live map, and dispatch jobs efficiently — all from one professional dashboard.
    </p>

    <div class="brand-features">
      <div class="feature-item">
        <div class="feature-dot"></div>
        Live driver tracking on interactive map
      </div>
      <div class="feature-item">
        <div class="feature-dot"></div>
        Instant job creation and assignment
      </div>
      <div class="feature-item">
        <div class="feature-dot"></div>
        Zone queue management and auto-dispatch
      </div>
      <div class="feature-item">
        <div class="feature-dot"></div>
        Emergency alerts and driver communication
      </div>
    </div>
  </div>

  <!-- ── Right: Login form ── -->
  <div class="login-panel">
    <div class="login-header">
      <h2>Sign in</h2>
      <p>Enter your dispatcher credentials to continue.</p>
    </div>

    <div class="error-box" id="errorBox"></div>

    <form id="loginForm" onsubmit="return false;">
      <div class="form-group">
        <label for="inputEmail">Email address</label>
        <input
          type="email"
          id="inputEmail"
          name="email"
          placeholder="dispatch@bookawaka.co.nz"
          autocomplete="email"
          required
        />
      </div>

      <div class="form-group">
        <label for="inputPassword">Password</label>
        <input
          type="password"
          id="inputPassword"
          name="Password"
          placeholder="••••••••"
          autocomplete="current-password"
          required
        />
      </div>

      <div class="form-group">
        <label for="inputCompanyId" style="display:flex;align-items:center;gap:6px;">
          Company ID
          <span style="font-weight:400;color:#9ca3af;font-size:11px;">(optional — from your approval email)</span>
        </label>
        <input
          type="text"
          id="inputCompanyId"
          name="companyId"
          placeholder="e.g. 417942"
          autocomplete="off"
          maxlength="10"
          style="letter-spacing:2px;"
        />
      </div>

      <button type="submit" class="btn-login" id="btnLogin">Sign in</button>
    </form>

    <div class="divider">or</div>

    <div class="signup-card">
      <p>New to BookaWaka?<br />Set up your company account in minutes.</p>
      <button type="button" class="btn-contact" onclick="openSignup()">Create Account</button>
    </div>

    <div class="footer-note">
      &copy; 2026 BookaWaka &mdash; New Zealand
    </div>
  </div>

  <!-- ── Sign Up Modal ── -->
  <div id="signupModal" onclick="if(event.target===this)closeSignup()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;overflow-y:auto;">
    <div style="background:#fff;border-radius:14px;padding:32px 36px;width:500px;max-width:94vw;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);margin:auto;">
      <button onclick="closeSignup()" style="position:absolute;top:14px;right:18px;background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;">&times;</button>
      <h3 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111;">Request an Account</h3>
      <p style="font-size:13px;color:#6b7280;margin:0 0 22px;">Fill in your details below. Our team will review your request and be in touch within 1 business day. You'll receive a <strong>10-day free trial</strong> once approved.</p>

      <div id="suSuccess" style="display:none;text-align:center;padding:28px 0;">
        <div style="font-size:42px;margin-bottom:12px;">&#9989;</div>
        <div style="font-size:17px;font-weight:700;color:#111;margin-bottom:8px;">Request submitted!</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">We'll review your application and contact you at</div>
        <div id="suSubmittedEmail" style="font-size:14px;font-weight:600;color:#1a2535;margin-bottom:16px;"></div>
        <div style="font-size:12px;color:#9ca3af;">Once approved you'll get a 10-day free trial to explore the full platform.</div>
      </div>

      <form id="suForm" onsubmit="submitSignup();return false;" autocomplete="on">
        <div id="suError" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;color:#dc2626;font-size:13px;margin-bottom:16px;"></div>

        <div style="display:flex;flex-direction:column;gap:12px;">

          <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;padding-bottom:2px;border-bottom:1px solid #f3f4f6;">Company Details</div>

          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Company / Fleet Name *</label>
            <input id="suCompany" type="text" placeholder="e.g. Invercargill Taxis Ltd" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Business Number <span style="font-weight:400;color:#9ca3af;">(optional)</span></label>
              <input id="suBizNum" type="text" placeholder="e.g. 1234567" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Fleet Size <span style="font-weight:400;color:#9ca3af;">(optional)</span></label>
              <input id="suFleet" type="number" min="1" placeholder="e.g. 12" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Area / Region <span style="font-weight:400;color:#9ca3af;">(optional)</span></label>
              <input id="suArea" type="text" placeholder="e.g. Invercargill" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Country <span style="font-weight:400;color:#9ca3af;">(optional)</span></label>
              <select id="suCountry" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;background:#fff;">
                <option value="">Select…</option>
                <option value="NZ" selected>New Zealand</option>
                <option value="AU">Australia</option>
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;padding-bottom:2px;border-bottom:1px solid #f3f4f6;margin-top:4px;">Your Details</div>

          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Your Full Name *</label>
            <input id="suName" type="text" placeholder="e.g. Jane Smith" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Email Address *</label>
            <input id="suEmail" type="email" placeholder="jane@yourfleet.co.nz" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Phone Number <span style="font-weight:400;color:#9ca3af;">(optional)</span></label>
            <input id="suPhone" type="tel" placeholder="e.g. 021 555 0000" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Password *</label>
            <input id="suPass" type="password" placeholder="Minimum 6 characters" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;">Confirm Password *</label>
            <input id="suPassConfirm" type="password" placeholder="Repeat your password" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-family:inherit;font-size:13px;">
          </div>
        </div>

        <button id="suBtn" type="submit" style="margin-top:20px;width:100%;padding:12px;background:#f5be1e;border:none;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;color:#1a1d21;">
          Submit Request
        </button>
        <p style="text-align:center;font-size:12px;color:#9ca3af;margin:12px 0 0;">Already have an account? Just sign in above.</p>
      </form>
    </div>
  </div>

  <script>
    function openSignup() {
      document.getElementById('signupModal').style.display = 'flex';
      document.getElementById('suError').style.display = 'none';
      document.getElementById('suSuccess').style.display = 'none';
      document.getElementById('suForm').style.display = 'block';
    }
    function closeSignup() {
      document.getElementById('signupModal').style.display = 'none';
    }

    function submitSignup() {
      var company  = document.getElementById('suCompany').value.trim();
      var name     = document.getElementById('suName').value.trim();
      var email    = document.getElementById('suEmail').value.trim();
      var phone    = document.getElementById('suPhone').value.trim();
      var pass     = document.getElementById('suPass').value;
      var passConf = document.getElementById('suPassConfirm').value;
      var bizNum   = document.getElementById('suBizNum').value.trim();
      var fleet    = document.getElementById('suFleet').value.trim();
      var area     = document.getElementById('suArea').value.trim();
      var country  = document.getElementById('suCountry').value;

      document.getElementById('suError').style.display = 'none';

      if (!company)                              { showSuError('Please enter your company or fleet name.'); return; }
      if (!name)                                 { showSuError('Please enter your full name.'); return; }
      if (!email || !/\S+@\S+\.\S+/.test(email)){ showSuError('Please enter a valid email address.'); return; }
      if (!pass || pass.length < 6)              { showSuError('Password must be at least 6 characters.'); return; }
      if (pass !== passConf)                     { showSuError('Passwords do not match.'); return; }

      var btn = document.getElementById('suBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Submitting…';

      fetch('/DispatcherLogin.aspx/AccountRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company:        company,
          name:           name,
          email:          email,
          phone:          phone,
          password:       pass,
          businessNumber: bizNum,
          fleetSize:      fleet,
          area:           area,
          country:        country || 'NZ'
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.innerHTML = 'Submit Request';
        if (data && data.error) { showSuError(data.error); return; }
        document.getElementById('suForm').style.display = 'none';
        document.getElementById('suSubmittedEmail').textContent = email;
        document.getElementById('suSuccess').style.display = 'block';
      })
      .catch(function() {
        btn.disabled = false;
        btn.innerHTML = 'Submit Request';
        showSuError('Could not submit your request. Please check your connection and try again.');
      });
    }

    function showSuError(msg) {
      var box = document.getElementById('suError');
      box.textContent = msg;
      box.style.display = 'block';
    }
  </script>

  <!-- Firebase SDK (same version as dispatch console) -->
  <script src="https://www.gstatic.com/firebasejs/4.12.1/firebase.js"></script>
  <script>
    // ── Firebase initialisation ──────────────────────────────────────────────
    var firebaseConfig = {
      apiKey:            "AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA",
      authDomain:        "taxilatest.firebaseapp.com",
      databaseURL:       "https://taxilatest.firebaseio.com",
      projectId:         "taxilatest",
      storageBucket:     "taxilatest.appspot.com",
      messagingSenderId: "986098722414"
    };
    firebase.initializeApp(firebaseConfig);

    // ── If Firebase says user is already signed in, go straight to console ──
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) return; // not signed in — show the login form
      var name      = user.displayName || user.email.split('@')[0];
      var userEmail = user.email || '';
      var cachedCid = localStorage.getItem('TT_CId') || '';

      // Three-step fallback: Firebase DB → server email lookup → cached value
      var cidPromise = firebase.database().ref('users/' + user.uid + '/companyId').once('value')
        .then(function(snap) {
          var fbCid = snap.val();
          if (fbCid) return fbCid;
          // Step 2: Firebase DB has nothing — try the server
          return fetch('/api/session/company-by-email?email=' + encodeURIComponent(userEmail))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) {
              if (data && data.companyId) return data.companyId;
              return cachedCid || null;
            })
            .catch(function() { return cachedCid || null; });
        })
        .catch(function() {
          // Firebase DB read failed — try server lookup
          return fetch('/api/session/company-by-email?email=' + encodeURIComponent(userEmail))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) {
              return (data && data.companyId) ? data.companyId : (cachedCid || null);
            })
            .catch(function() { return cachedCid || null; });
        });

      cidPromise.then(function(cid) {
        if (!cid) {
          console.warn('[auto-login] no companyId found; showing login form.');
          return;
        }
        localStorage.setItem('TT_Name',    name);
        localStorage.setItem('TT_DId',     '1051');
        localStorage.setItem('TT_Country', 'NZ');
        localStorage.setItem('TT_CId',     cid);
        localStorage.setItem('Country',    'NZ');
        return fetch('/api/session/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: cid, uid: user.uid }),
          credentials: 'include'
        }).then(function(resp) {
          if (resp && resp.ok) {
            window.location.replace('Default.aspx');
          } else {
            console.warn('[auto-login] server rejected companyId ' + cid + '; showing login form.');
            // Clear bad cached value so it doesn't keep failing
            if (cid === cachedCid) localStorage.removeItem('TT_CId');
          }
        });
      }).catch(function(err) {
        console.warn('[auto-login] unexpected error; showing login form.', err);
      });
    });

    // ── Mock-server login fallback (used when Firebase auth is unavailable) ──
    function _mockLogin(email, firebaseErrorCode) {
      fetch('/DataManager/Data.aspx/LoginSelector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{ name: 'Username', value: email }, { name: 'Password', value: 'mock' }] })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var arr;
        try { arr = typeof data.d === 'string' ? JSON.parse(data.d) : data.d; } catch(e) { arr = null; }
        if (Array.isArray(arr) && arr.length > 0 && arr[0].CompanyId) {
          var u    = arr[0];
          var name = ((u.UserFName || '') + ' ' + (u.UserLName || '')).trim() || email.split('@')[0];
          var cid  = String(u.CompanyId || '1216');
          localStorage.setItem('TT_Name',    name);
          localStorage.setItem('TT_DId',     String(u.Id      || '1051'));
          localStorage.setItem('TT_Country', u.Country         || 'NZ');
          localStorage.setItem('TT_CId',     cid);
          localStorage.setItem('Country',    u.Country         || 'NZ');
          // Establish server-side session cookie for per-company data isolation
          fetch('/api/session/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: cid, uid: String(u.Id || '') }),
            credentials: 'include'
          }).then(function(resp) {
            if (resp && resp.ok) {
              window.location.href = 'Default.aspx';
            } else {
              resetBtn();
              showError('Session could not be established. Please try again.');
            }
          }).catch(function() {
            resetBtn();
            showError('Session setup failed. Please check your connection and try again.');
          });
        } else {
          resetBtn();
          showError('Sign-in failed. Please check your credentials and try again.');
        }
      })
      .catch(function() {
        resetBtn();
        showError('Sign-in failed. Please check your connection and try again.');
      });
    }

    // ── Login form submission ────────────────────────────────────────────────
    document.getElementById('loginForm').addEventListener('submit', function() {
      var emailEl     = document.getElementById('inputEmail');
      var passwordEl  = document.getElementById('inputPassword');
      var companyIdEl = document.getElementById('inputCompanyId');
      var btnEl       = document.getElementById('btnLogin');
      var errorBox    = document.getElementById('errorBox');

      var email     = emailEl.value.trim();
      var password  = passwordEl.value.trim();
      var manualCid = (companyIdEl.value || '').replace(/\s/g, '');

      errorBox.style.display = 'none';
      emailEl.classList.remove('error');
      passwordEl.classList.remove('error');
      companyIdEl.classList.remove('error');

      if (!email) {
        emailEl.classList.add('error');
        showError('Please enter your email address.');
        emailEl.focus();
        return;
      }
      if (!password) {
        passwordEl.classList.add('error');
        showError('Please enter your password.');
        passwordEl.focus();
        return;
      }

      btnEl.disabled = true;
      btnEl.innerHTML = '<span class="spinner"></span>Signing in...';

      // Resolve company ID using a three-step fallback chain:
      //  1. Manual Company ID field (typed by user)
      //  2. Firebase DB (users/{uid}/companyId)
      //  3. Server lookup by email (/api/session/company-by-email)
      function resolveCompanyId(uid) {
        // Step 1: manual input wins immediately
        if (manualCid) return Promise.resolve(manualCid);

        // Step 2: Firebase DB lookup
        return firebase.database().ref('users/' + uid + '/companyId').once('value')
          .then(function(snap) {
            var fbCid = snap.val();
            if (fbCid) return fbCid;

            // Step 3: server lookup by email (handles cases where Firebase DB write failed at approval)
            return fetch('/api/session/company-by-email?email=' + encodeURIComponent(email))
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(data) {
                if (data && data.companyId) return data.companyId;
                return null; // still not found
              });
          })
          .catch(function() {
            // Firebase DB unavailable — try server lookup directly
            return fetch('/api/session/company-by-email?email=' + encodeURIComponent(email))
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(data) { return data && data.companyId ? data.companyId : null; })
              .catch(function() { return null; });
          });
      }

      // 10-second timeout so the button never hangs forever
      var authTimeout = setTimeout(function() {
        _mockLogin(email, 'auth/timeout');
      }, 10000);

      firebase.auth().signInWithEmailAndPassword(email, password)
        .then(function(result) {
          clearTimeout(authTimeout);
          var user = result.user;
          var name = user.displayName || email.split('@')[0];

          return resolveCompanyId(user.uid).then(function(cid) {
            if (!cid) {
              resetBtn();
              showError('Your account was found but your Company ID could not be resolved. Please enter your Company ID in the field above and try again.');
              companyIdEl.classList.add('error');
              companyIdEl.focus();
              return;
            }

            localStorage.setItem('TT_Name',    name);
            localStorage.setItem('TT_DId',     '1051');
            localStorage.setItem('TT_Country', 'NZ');
            localStorage.setItem('TT_CId',     cid);
            localStorage.setItem('Country',    'NZ');

            // Establish BW_SID session cookie for server-side dispatch isolation
            return fetch('/api/session/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ companyId: cid, uid: user.uid }),
              credentials: 'include'
            }).then(function(resp) {
              if (resp && resp.ok) {
                window.location.href = 'Default.aspx';
              } else {
                return resp.json().catch(function() { return {}; }).then(function(body) {
                  resetBtn();
                  if (body && body.error === 'Unknown company') {
                    showError('The Company ID "' + cid + '" is not recognised. Please check your Company ID and try again.');
                    companyIdEl.classList.add('error');
                    companyIdEl.focus();
                  } else {
                    showError('Session could not be established. Please try again.');
                  }
                });
              }
            }).catch(function() {
              resetBtn();
              showError('Session setup failed. Please check your connection and try again.');
            });
          });
        })
        .catch(function(error) {
          clearTimeout(authTimeout);
          var wrongCreds = (error.code === 'auth/user-not-found' ||
                            error.code === 'auth/wrong-password'  ||
                            error.code === 'auth/invalid-credential' ||
                            error.code === 'auth/invalid-email');
          if (wrongCreds) {
            resetBtn();
            showError('Incorrect email or password. Please try again.');
          } else {
            _mockLogin(email, error.code);
          }
        });
    });

    function showError(msg) {
      var box = document.getElementById('errorBox');
      box.textContent = msg;
      box.style.display = 'block';
    }

    function resetBtn() {
      var btnEl = document.getElementById('btnLogin');
      btnEl.disabled = false;
      btnEl.innerHTML = 'Sign in';
    }

    document.getElementById('inputPassword').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
      }
    });
  </script>
</body>
</html>
