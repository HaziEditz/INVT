<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Taxi Time — Dispatcher Login</title>
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
      <div class="taxi-icon">🚕</div>
      <div>
        <div class="brand-name">Taxi Time</div>
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

    <div class="demo-hint" id="demoHint">
      <strong>Demo mode:</strong> Enter any username and password to access the dispatch console.
    </div>

    <div class="error-box" id="errorBox"></div>

    <form id="loginForm" onsubmit="return false;">
      <div class="form-group">
        <label for="inputEmail">Username or Email</label>
        <input
          type="text"
          id="inputEmail"
          name="Username"
          placeholder="dispatch@taxitime.co.nz"
          autocomplete="username"
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

      <button type="submit" class="btn-login" id="btnLogin">Sign in</button>
    </form>

    <div class="divider">or</div>

    <div class="signup-card">
      <p>Need a dispatcher account?<br />Contact your fleet administrator to get access.</p>
      <a href="mailto:admin@taxitime.co.nz" class="btn-contact">Request Access</a>
    </div>

    <div class="footer-note">
      &copy; 2026 Taxi Time &mdash; Invercargill, New Zealand
    </div>
  </div>

  <script>
    // ── If already logged in, skip straight to the console ──
    (function() {
      var id = localStorage.getItem('TT_DId');
      var name = localStorage.getItem('TT_Name');
      if (id && name) {
        window.location.replace('Default.aspx');
      }
    })();

    // ── Login form submission ────────────────────────────────
    document.getElementById('loginForm').addEventListener('submit', function() {
      var emailEl    = document.getElementById('inputEmail');
      var passwordEl = document.getElementById('inputPassword');
      var btnEl      = document.getElementById('btnLogin');
      var errorBox   = document.getElementById('errorBox');

      var username = emailEl.value.trim();
      var password = passwordEl.value.trim();

      // Clear previous errors
      errorBox.style.display = 'none';
      emailEl.classList.remove('error');
      passwordEl.classList.remove('error');

      if (!username) {
        emailEl.classList.add('error');
        showError('Please enter your username or email.');
        emailEl.focus();
        return;
      }
      if (!password) {
        passwordEl.classList.add('error');
        showError('Please enter your password.');
        passwordEl.focus();
        return;
      }

      // Disable button and show spinner
      btnEl.disabled = true;
      btnEl.innerHTML = '<span class="spinner"></span>Signing in...';

      var payload = JSON.stringify({
        action: 'DispatcherLogin',
        data: [
          { name: 'Username', value: username },
          { name: 'Password', value: password }
        ]
      });

      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'DataManager/Data.aspx/LoginSelector', true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
          try {
            var response = JSON.parse(xhr.responseText);
            var data = response.d;
            // Try to parse as JSON array (success response)
            var parsed;
            try { parsed = JSON.parse(data); } catch(e) { parsed = null; }

            if (Array.isArray(parsed) && parsed.length > 0) {
              var user = parsed[0];
              // Store session in localStorage
              localStorage.setItem('TT_Name',    (user.UserFName || 'Dispatcher').trim());
              localStorage.setItem('TT_DId',     String(user.Id      || '1051'));
              localStorage.setItem('TT_Country', String(user.Country || 'NZ'));
              localStorage.setItem('TT_CId',     String(user.CompanyId || ''));
              // Legacy key used by Default.aspx for country
              localStorage.setItem('Country', String(user.Country || 'NZ'));
              // Navigate to dispatch console
              window.location.href = 'Default.aspx';
            } else {
              // Server returned a string error or empty array
              var msg = (typeof data === 'string' && data.length > 0 && data !== '[]')
                ? data
                : 'Incorrect username or password. Please try again.';
              resetBtn();
              showError(msg);
            }
          } catch (e) {
            resetBtn();
            showError('An unexpected error occurred. Please try again.');
          }
        } else {
          resetBtn();
          showError('Unable to connect. Please check your network and try again.');
        }
      };
      xhr.send(payload);
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

    // Allow Enter key in password field to submit
    document.getElementById('inputPassword').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
      }
    });
  </script>
</body>
</html>
