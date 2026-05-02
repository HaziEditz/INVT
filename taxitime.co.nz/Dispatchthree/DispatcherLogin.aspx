<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BookaWaka — Dispatcher</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    /* ── Site footer ── */
    .bw-login-footer {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 26px;
      background: rgba(10,12,18,0.96);
      border-top: 1px solid rgba(245,190,30,0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      font-size: 11px;
      font-weight: 400;
      color: rgba(255,255,255,0.55);
      letter-spacing: 0.3px;
    }
    .bw-login-footer a {
      color: rgba(245,190,30,0.85);
      text-decoration: none;
      font-weight: 600;
      margin-left: 4px;
      transition: color 0.15s;
    }
    .bw-login-footer a:hover { color: #f5be1e; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --gold:   #f5be1e;
      --gold10: rgba(245,190,30,0.10);
      --gold20: rgba(245,190,30,0.20);
      --dark:   #07090e;
      --card:   rgba(255,255,255,0.035);
      --border: rgba(255,255,255,0.08);
      --text1:  #ffffff;
      --text2:  #94a3b8;
      --text3:  #475569;
      --input:  rgba(255,255,255,0.05);
      --inputH: rgba(255,255,255,0.08);
      --red:    #ef4444;
    }

    html, body {
      height: 100%;
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0d0f14;
      color: var(--text1);
      overflow-x: hidden;
    }

    /* ── Subtle background texture ─────────────────────────────── */
    .bg { display: none; }
    .grid-overlay { display: none; }

    /* ── SPLASH SCREEN ─────────────────────────────────────────── */
    #splash {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0d0f14;
      animation: splashExit 0.7s cubic-bezier(0.4,0,0.2,1) 2.6s forwards;
      pointer-events: none;
    }

    @keyframes splashExit {
      0%   { transform: translateY(0); opacity: 1; }
      100% { transform: translateY(-100%); opacity: 0; }
    }

    .splash-logo-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      animation: splashLogoIn 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.2s both;
    }

    @keyframes splashLogoIn {
      0%   { opacity: 0; transform: scale(0.5) translateY(30px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }

    .splash-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      animation: splashIconPulse 2s ease-in-out 1.2s infinite alternate;
    }

    .splash-logo-img {
      height: 40px;
      width: auto;
      display: block;
    }

    .splash-icon {
      background: rgba(255,255,255,0.96);
      border-radius: 14px;
      padding: 12px 20px;
      box-shadow: 0 0 60px rgba(245,190,30,0.3), 0 8px 32px rgba(0,0,0,0.5);
      animation: splashIconPulse 2s ease-in-out 1.2s infinite alternate;
    }

    @keyframes splashIconPulse {
      from { box-shadow: 0 0 40px rgba(245,190,30,0.25), 0 8px 32px rgba(0,0,0,0.5); }
      to   { box-shadow: 0 0 70px rgba(245,190,30,0.5), 0 8px 32px rgba(0,0,0,0.5); }
    }

    .splash-brand {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -1px;
      color: var(--text1);
    }

    .splash-sub {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--text2);
      margin-top: -10px;
      animation: splashSubIn 0.7s ease 0.8s both;
    }

    @keyframes splashSubIn {
      0%   { opacity: 0; transform: translateY(12px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .splash-powered {
      position: absolute;
      bottom: 40px;
      font-size: 11px;
      color: var(--text3);
      letter-spacing: 0.5px;
      animation: splashSubIn 0.7s ease 1.2s both;
    }

    .splash-powered span {
      color: var(--gold);
      font-weight: 600;
    }

    .splash-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--gold), rgba(245,190,30,0.3));
      border-radius: 0 2px 0 0;
      width: 0;
      animation: splashBarFill 2.3s cubic-bezier(0.4,0,0.2,1) 0.3s forwards;
    }

    @keyframes splashBarFill {
      0%   { width: 0%; }
      60%  { width: 75%; }
      100% { width: 100%; }
    }

    /* ── MAIN LAYOUT ───────────────────────────────────────────── */
    #mainContent {
      position: relative;
      z-index: 1;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      opacity: 0;
      animation: mainFadeIn 0.8s ease 3.1s forwards;
    }

    @keyframes mainFadeIn {
      0%   { opacity: 0; transform: translateY(24px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .layout {
      display: flex;
      gap: 0;
      width: 100%;
      max-width: 1000px;
      min-height: 600px;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px var(--border);
    }

    /* ── Left brand panel ─────────────────────────────────────── */
    .brand-panel {
      flex: 1 1 50%;
      background: #111420;
      border-right: 1px solid rgba(255,255,255,0.09);
      padding: 52px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .brand-panel::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: #f5be1e;
      opacity: 0.6;
    }

    .brand-glow { display: none; }

    .brand-logo {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .bw-wordmark {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bw-wordmark-icon {
      width: 36px; height: 36px;
      background: #1a7d96;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bw-wordmark-icon svg {
      width: 18px; height: 18px;
    }
    .bw-wordmark-text {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
    }

    .brand-logo .logo-sub {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--text3);
    }

    .brand-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 40px 0;
    }

    .brand-eyebrow {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 16px;
    }

    .brand-headline {
      font-size: 36px;
      font-weight: 800;
      line-height: 1.18;
      letter-spacing: -1.2px;
      color: var(--text1);
      margin-bottom: 18px;
    }

    .brand-headline em {
      font-style: normal;
      color: var(--gold);
    }

    .brand-desc {
      font-size: 14px;
      line-height: 1.75;
      color: var(--text2);
      max-width: 340px;
      margin-bottom: 40px;
    }

    .brand-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: var(--border);
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .stat-item {
      background: rgba(255,255,255,0.025);
      padding: 16px 20px;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 800;
      color: var(--text1);
      letter-spacing: -0.5px;
    }

    .stat-label {
      font-size: 11px;
      color: var(--text3);
      font-weight: 500;
      margin-top: 2px;
    }

    .brand-footer {
      font-size: 11px;
      color: var(--text3);
    }

    .brand-footer span {
      color: var(--text2);
    }

    /* ── Right login panel ────────────────────────────────────── */
    .login-panel {
      flex: 0 0 420px;
      background: rgba(10,13,20,0.85);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      padding: 52px 44px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }

    .login-panel::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
    }

    .login-header {
      margin-bottom: 32px;
    }

    .login-header h2 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.6px;
      color: var(--text1);
      margin-bottom: 6px;
    }

    .login-header p {
      font-size: 13.5px;
      color: var(--text2);
      line-height: 1.5;
    }

    /* ── Form ─────────────────────────────────────────────────── */
    .form-group {
      margin-bottom: 18px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text2);
      letter-spacing: 0.3px;
      margin-bottom: 8px;
    }

    .input-wrap {
      position: relative;
    }

    .input-wrap input {
      width: 100%;
      padding: 12px 16px;
      background: var(--input);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      font-size: 14px;
      font-family: inherit;
      color: var(--text1);
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
      outline: none;
    }

    .input-wrap input::placeholder {
      color: var(--text3);
    }

    .input-wrap input:focus {
      background: var(--inputH);
      border-color: rgba(245,190,30,0.5);
      box-shadow: 0 0 0 3px rgba(245,190,30,0.08);
    }

    .input-wrap input.error {
      border-color: rgba(239,68,68,0.6);
      box-shadow: 0 0 0 3px rgba(239,68,68,0.08);
    }

    .input-hint {
      font-size: 11px;
      font-weight: 400;
      color: var(--text3);
      margin-left: 6px;
    }

    /* ── Error box ────────────────────────────────────────────── */
    .error-box {
      display: none;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 9px;
      padding: 11px 14px;
      margin-bottom: 18px;
      font-size: 13px;
      color: #fca5a5;
      font-weight: 500;
      animation: shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97);
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-6px); }
      40%       { transform: translateX(6px); }
      60%       { transform: translateX(-4px); }
      80%       { transform: translateX(4px); }
    }

    /* ── Button ───────────────────────────────────────────────── */
    .btn-login {
      width: 100%;
      padding: 13px;
      background: var(--gold);
      color: #1a1100;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      letter-spacing: -0.2px;
      margin-top: 6px;
      position: relative;
      overflow: hidden;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    }

    .btn-login::after {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 60%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
      transform: skewX(-20deg);
      transition: left 0.5s ease;
    }

    .btn-login:hover {
      box-shadow: 0 8px 28px rgba(245,190,30,0.35);
      transform: translateY(-1px);
    }

    .btn-login:hover::after {
      left: 140%;
    }

    .btn-login:active {
      transform: translateY(0) scale(0.99);
    }

    .btn-login:disabled {
      background: rgba(245,190,30,0.3);
      color: rgba(26,17,0,0.5);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-login:disabled::after { display: none; }

    /* ── Spinner ──────────────────────────────────────────────── */
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(26,17,0,0.3);
      border-top-color: #1a1100;
      border-radius: 50%;
      animation: spin 0.65s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Divider ──────────────────────────────────────────────── */
    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 22px 0;
      font-size: 11px;
      color: var(--text3);
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    /* ── Signup card ──────────────────────────────────────────── */
    .signup-card {
      background: rgba(255,255,255,0.025);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      text-align: center;
    }

    .signup-card p {
      font-size: 12.5px;
      color: var(--text2);
      margin-bottom: 12px;
      line-height: 1.6;
    }

    .btn-contact {
      display: inline-block;
      padding: 9px 22px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      color: var(--text1);
      cursor: pointer;
      text-decoration: none;
      transition: border-color 0.2s, background 0.2s;
    }

    .btn-contact:hover {
      border-color: rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.05);
    }

    .footer-note {
      margin-top: 28px;
      font-size: 11px;
      color: var(--text3);
      text-align: center;
    }

    /* ── Service Type & Plan Selector Cards ──────────────────── */
    .type-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 4px;
    }
    .type-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      padding: 10px 8px;
      background: var(--input);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 9px;
      cursor: pointer;
      transition: border-color 0.18s, background 0.18s;
      font-size: 12px;
      color: var(--text2);
      font-weight: 500;
      text-align: center;
      user-select: none;
    }
    .type-card:hover { border-color: rgba(255,255,255,0.2); background: var(--inputH); }
    .type-card.selected { border-color: var(--gold); background: var(--gold10); color: var(--text1); }
    .type-card .type-icon { font-size: 20px; }

    .plan-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 4px;
    }
    .plan-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 6px 10px;
      background: var(--input);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 9px;
      cursor: pointer;
      transition: border-color 0.18s, background 0.18s;
      text-align: center;
      user-select: none;
    }
    .plan-card:hover { border-color: rgba(255,255,255,0.2); background: var(--inputH); }
    .plan-card.selected { border-color: var(--gold); background: var(--gold10); }
    .plan-card.selected .plan-name { color: var(--gold); }
    .plan-name { font-size: 12px; font-weight: 700; color: var(--text1); }
    .plan-price { font-size: 11px; color: var(--text2); }
    .plan-tag { font-size: 10px; background: var(--gold20); color: var(--gold); border-radius: 4px; padding: 1px 5px; font-weight: 600; }

    /* ── Sign Up Modal ────────────────────────────────────────── */
    #signupModal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(6px);
      z-index: 9999;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
    }

    .modal-box {
      background: #0f1218;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 36px 40px;
      width: 500px;
      max-width: 94vw;
      position: relative;
      box-shadow: 0 40px 80px rgba(0,0,0,0.6);
      margin: auto;
      animation: modalIn 0.35s cubic-bezier(0.34,1.56,0.64,1);
    }

    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.92) translateY(20px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    .modal-close {
      position: absolute;
      top: 16px; right: 20px;
      background: rgba(255,255,255,0.07);
      border: none;
      border-radius: 50%;
      width: 30px; height: 30px;
      font-size: 18px;
      cursor: pointer;
      color: var(--text2);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }

    .modal-close:hover { background: rgba(255,255,255,0.14); }

    .modal-box h3 {
      font-size: 20px;
      font-weight: 700;
      color: var(--text1);
      margin-bottom: 4px;
    }

    .modal-box > p {
      font-size: 13px;
      color: var(--text2);
      margin-bottom: 24px;
      line-height: 1.6;
    }

    .su-input {
      width: 100%;
      padding: 9px 12px;
      background: var(--input);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 8px;
      font-family: inherit;
      font-size: 13px;
      color: var(--text1);
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .su-input::placeholder { color: var(--text3); }
    .su-input:focus { border-color: rgba(245,190,30,0.4); }

    .su-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text2);
      margin-bottom: 5px;
    }

    .su-section {
      font-size: 10px;
      font-weight: 700;
      color: var(--text3);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
      margin-top: 6px;
    }

    .btn-submit {
      margin-top: 20px;
      width: 100%;
      padding: 13px;
      background: var(--gold);
      border: none;
      border-radius: 9px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      color: #1a1100;
      transition: opacity 0.2s;
    }

    .btn-submit:disabled { opacity: 0.45; cursor: not-allowed; }

    #suError {
      display: none;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 8px;
      padding: 11px 14px;
      color: #fca5a5;
      font-size: 13px;
      margin-bottom: 16px;
    }

    /* ── Responsive ───────────────────────────────────────────── */
    @media (max-width: 800px) {
      .layout { flex-direction: column; border-radius: 20px; max-width: 480px; }
      .brand-panel { padding: 40px 36px; border-right: none; border-bottom: 1px solid var(--border); flex: none; }
      .brand-stats { display: none; }
      .brand-main { padding: 24px 0; }
      .brand-headline { font-size: 28px; }
      .login-panel { flex: none; padding: 40px 36px; }
    }

    @media (max-width: 480px) {
      #mainContent { padding: 20px 16px; }
      .brand-panel { padding: 32px 24px; }
      .login-panel { padding: 32px 24px; }
    }
  </style>
</head>
<body>

  <!-- ── Animated background ── -->
  <div class="bg">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>
  <div class="grid-overlay"></div>

  <!-- ── Splash Screen ── -->
  <div id="splash">
    <div class="splash-logo-wrap">
      <div class="splash-icon">
        <img src="assets/img/bookawaka-logo.png" alt="BookaWaka" class="splash-logo-img" />
      </div>
      <div class="splash-sub">Dispatcher Console</div>
    </div>
    <div class="splash-powered">Dispatch platform — <span>Powered by BookaWaka</span></div>
    <div class="splash-bar"></div>
  </div>

  <!-- ── Main content ── -->
  <div id="mainContent">
    <div class="layout">

      <!-- Left: Branding -->
      <div class="brand-panel">
        <div class="brand-glow"></div>

        <div class="brand-logo">
          <div class="bw-wordmark">
            <div class="bw-wordmark-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="bw-wordmark-text">BookaWaka</span>
          </div>
          <div class="logo-sub" style="margin-top:8px;">Dispatch Platform</div>
        </div>

        <div class="brand-main">
          <div class="brand-eyebrow">Professional Dispatch</div>
          <h1 class="brand-headline">
            Real-time control<br />
            of your entire<br />
            <em>fleet.</em>
          </h1>
          <p class="brand-desc">
            Track drivers live, create and dispatch jobs instantly, manage zones, and communicate with your team — all from one powerful console.
          </p>
          <div class="brand-stats">
            <div class="stat-item">
              <div class="stat-value">Live</div>
              <div class="stat-label">Driver tracking</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">Auto</div>
              <div class="stat-label">Job dispatch</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">Zone</div>
              <div class="stat-label">Queue management</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">Safe</div>
              <div class="stat-label">Tenant isolation</div>
            </div>
          </div>
        </div>

        <div class="brand-footer">
          Powered by <span>BookaWaka &mdash; New Zealand</span>
        </div>
      </div>

      <!-- Right: Login form -->
      <div class="login-panel">
        <div class="login-header">
          <h2>Welcome back</h2>
          <p>Sign in to your dispatcher console to continue.</p>
        </div>

        <div class="error-box" id="errorBox"></div>

        <form id="loginForm" onsubmit="return false;">
          <div class="form-group">
            <label for="inputDispatcherName">Your name</label>
            <div class="input-wrap">
              <input
                type="text"
                id="inputDispatcherName"
                name="dispatcherName"
                placeholder="e.g. Abdullhagul"
                autocomplete="name"
                required
                maxlength="60"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="inputEmail">Email address</label>
            <div class="input-wrap">
              <input
                type="email"
                id="inputEmail"
                name="email"
                placeholder="dispatch@yourfleet.co.nz"
                autocomplete="email"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="inputPassword">Password</label>
            <div class="input-wrap">
              <input
                type="password"
                id="inputPassword"
                name="Password"
                placeholder="••••••••"
                autocomplete="current-password"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="inputCompanyId">
              Company ID
              <span class="input-hint">(optional — from your approval email)</span>
            </label>
            <div class="input-wrap">
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
          </div>

          <button type="submit" class="btn-login" id="btnLogin">Sign in</button>
        </form>

        <div class="divider">or</div>

        <div class="signup-card">
          <p>New to BookaWaka?<br />Set up your fleet account in minutes.</p>
          <button type="button" class="btn-contact" onclick="openSignup()">Create Account</button>
        </div>

        <div class="footer-note">
          &copy; 2026 BookaWaka &mdash; New Zealand
        </div>
      </div>

    </div>
  </div>

  <!-- ── Sign Up Modal ── -->
  <div id="signupModal" onclick="if(event.target===this)closeSignup()">
    <div class="modal-box">
      <button class="modal-close" onclick="closeSignup()">&times;</button>
      <h3>Join as an Operator</h3>
      <p>Set up your account in minutes. Choose your service type and plan below.</p>

      <!-- Success: Free Trial (auto-approved, logged in immediately) -->
      <div id="suSuccessTrial" style="display:none;text-align:center;padding:32px 0;">
        <div style="font-size:48px;margin-bottom:14px;">🎉</div>
        <div style="font-size:17px;font-weight:700;color:var(--text1);margin-bottom:8px;">You're live — trial started!</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px;">Log in now with your email and password. Your Company ID is:</div>
        <div id="suTrialCompanyId" style="font-size:22px;font-weight:800;color:var(--gold);letter-spacing:2px;margin:10px 0;"></div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:20px;">Copy this — you'll need it to log in.</div>
        <button class="btn-submit" style="max-width:200px;margin:0 auto;" onclick="closeSignup()">Got it, go to login</button>
      </div>

      <!-- Success: Paid plan (pending review) -->
      <div id="suSuccessPending" style="display:none;text-align:center;padding:32px 0;">
        <div style="font-size:48px;margin-bottom:14px;">✅</div>
        <div style="font-size:17px;font-weight:700;color:var(--text1);margin-bottom:8px;">Application received!</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px;">We'll review your application and contact you at</div>
        <div id="suSubmittedEmail" style="font-size:14px;font-weight:600;color:var(--gold);margin-bottom:16px;"></div>
        <div style="font-size:12px;color:var(--text3);">Our team will be in touch within 1 business day to arrange your account setup.</div>
      </div>

      <form id="suForm" onsubmit="submitSignup();return false;" autocomplete="on">
        <div id="suError"></div>
        <div style="display:flex;flex-direction:column;gap:14px;">

          <!-- Service Type -->
          <div>
            <div class="su-section">What type of service do you operate?</div>
            <div class="type-grid" style="margin-top:10px;">
              <div class="type-card selected" data-type="taxi" onclick="selectType('taxi')">
                <span class="type-icon">🚕</span>Taxi / Transport
              </div>
              <div class="type-card" data-type="restaurant" onclick="selectType('restaurant')">
                <span class="type-icon">🍔</span>Restaurant / Food Delivery
              </div>
              <div class="type-card" data-type="freight" onclick="selectType('freight')">
                <span class="type-icon">📦</span>Freight / Courier
              </div>
              <div class="type-card" data-type="all" onclick="selectType('all')">
                <span class="type-icon">🔄</span>All Services
              </div>
            </div>
          </div>

          <!-- Company Details -->
          <div class="su-section">Company Details</div>
          <div>
            <label class="su-label">Company / Fleet Name *</label>
            <input id="suCompany" class="su-input" type="text" placeholder="e.g. Invercargill Taxis Ltd" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label class="su-label">Business Number <span style="font-weight:400;color:var(--text3)">(opt.)</span></label>
              <input id="suBizNum" class="su-input" type="text" placeholder="e.g. 1234567" />
            </div>
            <div>
              <label class="su-label">Vehicle / Fleet Size <span style="font-weight:400;color:var(--text3)">(opt.)</span></label>
              <input id="suFleet" class="su-input" type="number" min="1" placeholder="e.g. 12" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label class="su-label">Operating Region <span style="font-weight:400;color:var(--text3)">(opt.)</span></label>
              <input id="suArea" class="su-input" type="text" placeholder="e.g. Invercargill" />
            </div>
            <div>
              <label class="su-label">Country <span style="font-weight:400;color:var(--text3)">(opt.)</span></label>
              <select id="suCountry" class="su-input" style="background:var(--input);color:var(--text1);">
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

          <!-- Your Details -->
          <div class="su-section" style="margin-top:2px;">Your Details</div>
          <div>
            <label class="su-label">Your Full Name *</label>
            <input id="suName" class="su-input" type="text" placeholder="e.g. Jane Smith" />
          </div>
          <div>
            <label class="su-label">Email Address *</label>
            <input id="suEmail" class="su-input" type="email" placeholder="jane@yourfleet.co.nz" />
          </div>
          <div>
            <label class="su-label">Phone Number <span style="font-weight:400;color:var(--text3)">(opt.)</span></label>
            <input id="suPhone" class="su-input" type="tel" placeholder="e.g. 021 555 0000" />
          </div>
          <div>
            <label class="su-label">Password *</label>
            <input id="suPass" class="su-input" type="password" placeholder="Minimum 6 characters" />
          </div>
          <div>
            <label class="su-label">Confirm Password *</label>
            <input id="suPassConfirm" class="su-input" type="password" placeholder="Repeat your password" />
          </div>

          <!-- Plan Selection -->
          <div>
            <div class="su-section" style="margin-bottom:10px;">Choose a Plan</div>
            <div class="plan-grid">
              <div class="plan-card selected" data-plan="free_trial" onclick="selectPlan('free_trial')">
                <div class="plan-name">Free Trial</div>
                <div class="plan-price">14 days free</div>
                <div class="plan-tag">No card</div>
              </div>
              <div class="plan-card" data-plan="starter" onclick="selectPlan('starter')">
                <div class="plan-name">Starter</div>
                <div class="plan-price">$99/mo</div>
                <div class="plan-tag">Up to 20</div>
              </div>
              <div class="plan-card" data-plan="pro" onclick="selectPlan('pro')">
                <div class="plan-name">Pro</div>
                <div class="plan-price">$199/mo</div>
                <div class="plan-tag">Unlimited</div>
              </div>
            </div>
            <div id="suPlanNote" style="font-size:11px;color:var(--text3);margin-top:8px;text-align:center;">
              Free trial starts immediately — no card needed. Upgrade anytime.
            </div>
          </div>

        </div>
        <button id="suBtn" class="btn-submit" type="submit">Start Free Trial</button>
        <p style="text-align:center;font-size:12px;color:var(--text3);margin:12px 0 0;">Already have an account? Just sign in above.</p>
      </form>
    </div>
  </div>

  <script>
    var _suServiceType = 'taxi';
    var _suPlan        = 'free_trial';

    var _planNotes = {
      free_trial: 'Free trial starts immediately — no card needed. Upgrade anytime.',
      starter:    'Starter plan: up to 20 drivers. Our team will contact you to arrange payment.',
      pro:        'Pro plan: unlimited drivers. Our team will contact you to arrange payment.',
    };
    var _planBtnLabels = {
      free_trial: 'Start Free Trial',
      starter:    'Apply for Starter',
      pro:        'Apply for Pro',
    };

    function selectType(type) {
      _suServiceType = type;
      document.querySelectorAll('.type-card').forEach(function(c) {
        c.classList.toggle('selected', c.dataset.type === type);
      });
    }

    function selectPlan(plan) {
      _suPlan = plan;
      document.querySelectorAll('.plan-card').forEach(function(c) {
        c.classList.toggle('selected', c.dataset.plan === plan);
      });
      var note = document.getElementById('suPlanNote');
      if (note) note.textContent = _planNotes[plan] || '';
      var btn = document.getElementById('suBtn');
      if (btn && !btn.disabled) btn.textContent = _planBtnLabels[plan] || 'Submit';
    }

    function openSignup() {
      document.getElementById('signupModal').style.display = 'flex';
      document.getElementById('suError').style.display = 'none';
      document.getElementById('suSuccessTrial').style.display = 'none';
      document.getElementById('suSuccessPending').style.display = 'none';
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
          company: company, name: name, email: email, phone: phone,
          password: pass, businessNumber: bizNum, fleetSize: fleet,
          area: area, country: country || 'NZ',
          serviceType: _suServiceType,
          plan: _suPlan
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.textContent = _planBtnLabels[_suPlan] || 'Submit';
        if (data && data.error) { showSuError(data.error); return; }
        document.getElementById('suForm').style.display = 'none';
        if (data.autoApproved && data.companyId) {
          document.getElementById('suTrialCompanyId').textContent = data.companyId;
          document.getElementById('suSuccessTrial').style.display = 'block';
        } else {
          document.getElementById('suSubmittedEmail').textContent = email;
          document.getElementById('suSuccessPending').style.display = 'block';
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = _planBtnLabels[_suPlan] || 'Submit';
        showSuError('Could not submit your request. Please check your connection and try again.');
      });
    }

    function showSuError(msg) {
      var box = document.getElementById('suError');
      box.textContent = msg;
      box.style.display = 'block';
    }
  </script>

  <!-- Firebase SDK -->
  <!-- Firebase v9 compat — same API as v4, with all security/perf improvements -->
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></script>
  <script>
    var firebaseConfig = {
      apiKey:            "AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA",
      authDomain:        "taxilatest.firebaseapp.com",
      databaseURL:       "https://taxilatest.firebaseio.com",
      projectId:         "taxilatest",
      storageBucket:     "taxilatest.appspot.com",
      messagingSenderId: "986098722414"
    };
    firebase.initializeApp(firebaseConfig);

    // ── Firebase adminAccess gate ─────────────────────────────────────────────
    // Checks adminAccess/{companyId}/{uid} in Firebase.
    // Returns a promise:
    //   true  → node exists (company is authorised in Firebase)
    //   false → node is explicitly absent (super admin removed this company)
    //   null  → Firebase unreachable / permission error (don't block — fall
    //           through to the server store check)
    function _bwCheckFirebaseAccess(companyId, uid) {
      if (!companyId || !uid) return Promise.resolve(null);
      return firebase.database()
        .ref('adminAccess/' + companyId + '/' + uid)
        .once('value')
        .then(function(snap) { return snap.exists() ? true : false; })
        .catch(function() { return null; });
    }

    // ── Pre-populate name field from localStorage if a name was saved before ──
    (function() {
      var _saved = localStorage.getItem('TT_Name') || '';
      if (_saved && !/^\d+$/.test(_saved.trim())) {
        var _nameEl = document.getElementById('inputDispatcherName');
        if (_nameEl) _nameEl.value = _saved;
      }
    })();

    // ── Auto-login if Firebase already has a session ─────────────────────────
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) return;
      var userEmail = user.email || '';
      // Use the name stored from a previous form login if it's a proper name.
      // Never derive the name from the email or Firebase profile on auto-login —
      // the dispatcher must explicitly type their name at least once via the form.
      var _cachedName = (localStorage.getItem('TT_Name') || '').trim();
      var _hasValidName = _cachedName && !/^\d+$/.test(_cachedName);
      // If no valid name stored, show the form so the dispatcher can enter their name.
      if (!_hasValidName) return;
      var name = _cachedName;
      var cachedCid = localStorage.getItem('TT_CId') || '';

      var cidPromise = firebase.database().ref('users/' + user.uid + '/companyId').once('value')
        .then(function(snap) {
          var fbCid = snap.val();
          if (fbCid) return fbCid;
          return fetch('/api/session/company-by-email?email=' + encodeURIComponent(userEmail))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) {
              if (data && data.companyId) return data.companyId;
              return cachedCid || null;
            })
            .catch(function() { return cachedCid || null; });
        })
        .catch(function() {
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
        // Check Firebase adminAccess — if super admin removed this company,
        // the node won't exist and we block immediately (returns false).
        // null means Firebase was unreachable — fall through to server check.
        return _bwCheckFirebaseAccess(cid, user.uid).then(function(fbOk) {
          if (fbOk === false) {
            console.warn('[auto-login] adminAccess not found in Firebase for companyId=' + cid);
            localStorage.removeItem('TT_CId');
            return; // stays on login page; no error shown (silently blocked)
          }
          return fetch('/api/session/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: cid, uid: user.uid }),
            credentials: 'include'
          }).then(function(resp) {
          if (resp && resp.ok) {
            return resp.json().then(function(data) {
              localStorage.setItem('TT_Name',    name);
              localStorage.setItem('TT_DId',     '1051');
              localStorage.setItem('TT_Country', 'NZ');
              localStorage.setItem('TT_CId',     data.companyId || cid);
              localStorage.setItem('TT_Company', data.company   || '');
              localStorage.setItem('Country',    'NZ');
              window.location.replace('Default.aspx');
            });
          } else {
            console.warn('[auto-login] server rejected companyId ' + cid + '; showing login form.');
            if (cid === cachedCid) localStorage.removeItem('TT_CId');
          }
        });
        }); // end _bwCheckFirebaseAccess.then
      }).catch(function(err) {
        console.warn('[auto-login] unexpected error; showing login form.', err);
      });
    });

    // ── Mock-server login fallback ───────────────────────────────────────────
    function _mockLogin(email, firebaseErrorCode, nameOverride) {
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
          var name = nameOverride || ((u.UserFName || '') + ' ' + (u.UserLName || '')).trim() || email.split('@')[0];
          var cid  = String(u.CompanyId || '');
          fetch('/api/session/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: cid, uid: String(u.Id || '') }),
            credentials: 'include'
          }).then(function(resp) {
            if (resp && resp.ok) {
              return resp.json().then(function(d) {
                localStorage.setItem('TT_Name',    name);
                localStorage.setItem('TT_DId',     String(u.Id || '1051'));
                localStorage.setItem('TT_Country', u.Country || 'NZ');
                localStorage.setItem('TT_CId',     d.companyId || cid);
                localStorage.setItem('TT_Company', d.company   || '');
                localStorage.setItem('Country',    u.Country || 'NZ');
                window.location.href = 'Default.aspx';
              });
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

    // ── Login form submission ─────────────────────────────────────────────────
    document.getElementById('loginForm').addEventListener('submit', function() {
      var nameEl      = document.getElementById('inputDispatcherName');
      var emailEl     = document.getElementById('inputEmail');
      var passwordEl  = document.getElementById('inputPassword');
      var companyIdEl = document.getElementById('inputCompanyId');
      var btnEl       = document.getElementById('btnLogin');
      var errorBox    = document.getElementById('errorBox');

      var dispatcherName = (nameEl ? nameEl.value.trim() : '');
      var email     = emailEl.value.trim();
      var password  = passwordEl.value.trim();
      var manualCid = (companyIdEl.value || '').replace(/\s/g, '');

      errorBox.style.display = 'none';
      if (nameEl) nameEl.classList.remove('error');
      emailEl.classList.remove('error');
      passwordEl.classList.remove('error');
      companyIdEl.classList.remove('error');

      if (!dispatcherName) {
        if (nameEl) nameEl.classList.add('error');
        showError('Please enter your name so jobs show who dispatched them.');
        if (nameEl) nameEl.focus();
        return;
      }
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
      btnEl.innerHTML = '<span class="spinner"></span>Signing in…';

      function resolveCompanyId(uid) {
        if (manualCid) return Promise.resolve(manualCid);
        // Chain: Firebase DB → server uid lookup → server email lookup
        // Each step is a fallback in case the previous one has no data.
        return firebase.database().ref('users/' + uid + '/companyId').once('value')
          .then(function(snap) {
            var fbCid = snap.val();
            if (fbCid) return String(fbCid);
            // Firebase DB has no companyId for this uid — try the server's uid-based lookup
            // (reliable once the user has ever logged in and the uid was synced to the store)
            return fetch('/api/session/company-by-uid?uid=' + encodeURIComponent(uid))
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(data) {
                if (data && data.companyId) return String(data.companyId);
                // Last resort: match by email
                return fetch('/api/session/company-by-email?email=' + encodeURIComponent(email))
                  .then(function(r) { return r.ok ? r.json() : null; })
                  .then(function(data) { return (data && data.companyId) ? String(data.companyId) : null; });
              });
          })
          .catch(function() {
            // Firebase unreachable — go straight to server lookups
            return fetch('/api/session/company-by-uid?uid=' + encodeURIComponent(uid))
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(data) {
                if (data && data.companyId) return String(data.companyId);
                return fetch('/api/session/company-by-email?email=' + encodeURIComponent(email))
                  .then(function(r) { return r.ok ? r.json() : null; })
                  .then(function(d) { return (d && d.companyId) ? String(d.companyId) : null; })
                  .catch(function() { return null; });
              })
              .catch(function() { return null; });
          });
      }

      // Guard flag — ensures only ONE path (Firebase or fallback) ever completes login
      var _authSettled = false;

      // Soft warning after 8s — lets the user know we're still working, not broken
      var _slowTimer = setTimeout(function() {
        if (_authSettled) return;
        var box = document.getElementById('errorBox');
        box.textContent = 'Still connecting — please wait a moment…';
        box.style.display = 'block';
        box.style.background = '#fff8e1';
        box.style.color = '#7a5700';
        box.style.borderColor = '#ffe082';
      }, 8000);

      // Hard fallback after 25s — only fires if Firebase is genuinely hung
      var authTimeout = setTimeout(function() {
        if (_authSettled) return;
        _authSettled = true;
        var box = document.getElementById('errorBox');
        box.style.background = '';
        box.style.color = '';
        box.style.borderColor = '';
        _mockLogin(email, 'auth/timeout', dispatcherName);
      }, 25000);

      firebase.auth().signInWithEmailAndPassword(email, password)
        .then(function(result) {
          if (_authSettled) return; // timeout already fired — don't double-complete
          _authSettled = true;
          clearTimeout(_slowTimer);
          clearTimeout(authTimeout);
          // Hide the "still connecting" soft warning if it appeared
          var box = document.getElementById('errorBox');
          box.style.display = 'none';
          box.style.background = '';
          box.style.color = '';
          box.style.borderColor = '';
          var user = result.user;
          // Always use what the dispatcher typed — never derive from Firebase email
          var name = dispatcherName || user.displayName || email.split('@')[0];

          return resolveCompanyId(user.uid).then(function(cid) {
            if (!cid) {
              resetBtn();
              showError('Your account was found but your Company ID could not be resolved. Please enter your Company ID in the field above and try again.');
              companyIdEl.classList.add('error');
              companyIdEl.focus();
              return;
            }
            // Check Firebase adminAccess before issuing the session.
            // false = super admin explicitly removed this company from Firebase.
            return _bwCheckFirebaseAccess(cid, user.uid).then(function(fbOk) {
              if (fbOk === false) {
                resetBtn();
                showError('This account has been removed. Please contact BookaWaka support.');
                return;
              }
            return fetch('/api/session/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ companyId: cid, uid: user.uid }),
              credentials: 'include'
            }).then(function(resp) {
              if (resp && resp.ok) {
                return resp.json().then(function(data) {
                  localStorage.setItem('TT_Name',    name);
                  localStorage.setItem('TT_DId',     '1051');
                  localStorage.setItem('TT_Country', 'NZ');
                  localStorage.setItem('TT_CId',     data.companyId || cid);
                  localStorage.setItem('TT_Company', data.company   || '');
                  localStorage.setItem('Country',    'NZ');
                  window.location.href = 'Default.aspx';
                });
              } else {
                return resp.json().catch(function() { return {}; }).then(function(body) {
                  resetBtn();
                  var errMsg = (body && body.error) ? body.error : '';
                  var inactiveStatuses = ['deactivated', 'deleted', 'pending', 'rejected'];
                  if (body && inactiveStatuses.includes(body.status)) {
                    showError(errMsg || 'This account is not currently active. Please contact BookaWaka support.');
                  } else if (body && body.error === 'Unknown company') {
                    showError('The Company ID "' + cid + '" is not recognised. Please check your Company ID and try again.');
                    companyIdEl.classList.add('error');
                    companyIdEl.focus();
                  } else {
                    showError(errMsg || 'Session could not be established. Please try again.');
                  }
                });
              }
            }).catch(function() {
              resetBtn();
              showError('Session setup failed. Please check your connection and try again.');
            });
            }); // end _bwCheckFirebaseAccess.then
          }); // end resolveCompanyId.then
        })
        .catch(function(error) {
          if (_authSettled) return; // hard timeout already fired — don't conflict
          _authSettled = true;
          clearTimeout(_slowTimer);
          clearTimeout(authTimeout);
          var box = document.getElementById('errorBox');
          box.style.background = '';
          box.style.color = '';
          box.style.borderColor = '';
          var wrongCreds = (error.code === 'auth/user-not-found' ||
                            error.code === 'auth/wrong-password'  ||
                            error.code === 'auth/invalid-credential' ||
                            error.code === 'auth/invalid-email');
          if (wrongCreds) {
            resetBtn();
            showError('Incorrect email or password. Please try again.');
          } else {
            _mockLogin(email, error.code, dispatcherName);
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

    // Handle URL params on load
    (function() {
      var params = new URLSearchParams(window.location.search);
      var reason = params.get('reason');
      var signup = params.get('signup');
      var plan   = params.get('plan');

      // Auto-open signup modal — triggered by ?signup=1 (e.g. from the marketing website)
      if (signup === '1') {
        openSignup();
        // Pre-select a plan if specified — e.g. ?signup=1&plan=pro
        if (plan && document.querySelector('.plan-card[data-plan="' + plan + '"]')) {
          selectPlan(plan);
        }
      }

      // Errors / notices from server redirects
      if (reason === 'account_inactive') {
        showError('This account has been deactivated or deleted. Please contact BookaWaka support.');
      } else if (reason === 'session_revoked') {
        showError('Your session was ended by an administrator. Please sign in again.');
      }

      // Clean the URL so messages don't persist on refresh
      if (reason || signup) {
        history.replaceState(null, '', window.location.pathname);
      }
    })();
  </script>

<!-- ── Site footer ── -->
<div class="bw-login-footer">
    <i class="fa fa-globe" style="margin-right:5px;opacity:0.4;font-size:9px;"></i>
    Operated by <a href="https://bookawaka.com" target="_blank" rel="noopener">bookawaka.com</a>
</div>
</body>
</html>
