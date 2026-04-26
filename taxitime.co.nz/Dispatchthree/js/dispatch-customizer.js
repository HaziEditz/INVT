(function () {
  'use strict';
  var STORAGE_KEY = 'bw_theme_v2';

  var ACCENTS = [
    { name: 'Gold',   value: '#f5be1e', dim: 'rgba(245,190,30,0.13)',  border: 'rgba(245,190,30,0.3)'  },
    { name: 'Sky',    value: '#38bdf8', dim: 'rgba(56,189,248,0.13)',   border: 'rgba(56,189,248,0.3)'  },
    { name: 'Green',  value: '#4ade80', dim: 'rgba(74,222,128,0.13)',   border: 'rgba(74,222,128,0.3)'  },
    { name: 'Violet', value: '#a78bfa', dim: 'rgba(167,139,250,0.13)', border: 'rgba(167,139,250,0.3)' },
    { name: 'Rose',   value: '#fb7185', dim: 'rgba(251,113,133,0.13)', border: 'rgba(251,113,133,0.3)' },
    { name: 'Orange', value: '#fb923c', dim: 'rgba(251,146,60,0.13)',   border: 'rgba(251,146,60,0.3)'  },
  ];

  var BACKGROUNDS = [
    { name: 'Dark',     bg: '#0d0f14', bg1: '#111420', bg2: '#161a26', bg3: '#1c2133' },
    { name: 'Darker',   bg: '#080a0e', bg1: '#0b0d13', bg2: '#10131c', bg3: '#151828' },
    { name: 'Charcoal', bg: '#111214', bg1: '#18191e', bg2: '#1e1f26', bg3: '#25262f' },
    { name: 'Navy',     bg: '#0a0d18', bg1: '#0f1322', bg2: '#141830', bg3: '#1a1e38' },
  ];

  var RADII = [
    { name: 'Rounded', value: '8px'  },
    { name: 'Sharp',   value: '3px'  },
    { name: 'Pill',    value: '14px' },
  ];

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }
  function savePrefs(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function applyPrefs(p) {
    var r = document.documentElement;
    var a  = ACCENTS.find(function(x){ return x.name === p.accent; })  || ACCENTS[0];
    var b  = BACKGROUNDS.find(function(x){ return x.name === p.bg; })  || BACKGROUNDS[0];
    var rd = RADII.find(function(x){ return x.name === p.radius; })    || RADII[0];
    r.style.setProperty('--bw-accent',        a.value);
    r.style.setProperty('--bw-accent-dim',    a.dim);
    r.style.setProperty('--bw-accent-border', a.border);
    r.style.setProperty('--bw-bg',  b.bg);
    r.style.setProperty('--bw-bg1', b.bg1);
    r.style.setProperty('--bw-bg2', b.bg2);
    r.style.setProperty('--bw-bg3', b.bg3);
    r.style.setProperty('--bw-radius', rd.value);
  }

  function refreshButtons(panel, prefs) {
    var curAccent = prefs.accent || 'Gold';
    var curBg     = prefs.bg     || 'Dark';
    var curRadius = prefs.radius || 'Rounded';

    panel.querySelectorAll('.bw-accent-btn').forEach(function(btn) {
      var active = btn.dataset.accent === curAccent;
      btn.style.border = active ? '2.5px solid #fff' : '2.5px solid transparent';
      btn.style.boxShadow = active ? '0 0 0 1px ' + btn.dataset.color : 'none';
      btn.style.transform = active ? 'scale(1.15)' : 'scale(1)';
    });

    panel.querySelectorAll('.bw-bg-btn').forEach(function(btn) {
      var active = btn.dataset.bg === curBg;
      btn.style.borderColor = active ? 'var(--bw-accent)' : 'rgba(255,255,255,0.1)';
      btn.style.background  = active ? 'var(--bw-accent-dim)' : 'rgba(255,255,255,0.04)';
      btn.style.color       = active ? 'var(--bw-accent)' : '#94a3b8';
    });

    panel.querySelectorAll('.bw-radius-btn').forEach(function(btn) {
      var active = btn.dataset.radius === curRadius;
      btn.style.borderColor = active ? 'var(--bw-accent)' : 'rgba(255,255,255,0.1)';
      btn.style.background  = active ? 'var(--bw-accent-dim)' : 'rgba(255,255,255,0.04)';
      btn.style.color       = active ? 'var(--bw-accent)' : '#94a3b8';
    });
  }

  function buildUI() {
    var prefs = loadPrefs();
    applyPrefs(prefs);

    /* ── Overlay ── */
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99996;background:rgba(0,0,0,0);pointer-events:none;transition:background .25s';

    /* ── Panel ── */
    var panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed;bottom:72px;right:20px;z-index:99997',
      'width:260px;background:#111420;border:1px solid rgba(255,255,255,0.12)',
      'border-radius:14px;box-shadow:0 20px 56px rgba(0,0,0,0.75)',
      'font-family:Inter,-apple-system,sans-serif;font-size:12px;color:#e8ecf0',
      'overflow:hidden',
      'transform:translateY(14px) scale(0.96);opacity:0',
      'transition:transform .22s cubic-bezier(.34,1.4,.64,1),opacity .18s',
      'pointer-events:none'
    ].join(';');

    /* ── Panel header ── */
    var hdr = document.createElement('div');
    hdr.style.cssText = 'background:#161a26;border-bottom:1px solid rgba(255,255,255,0.07);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;';
    hdr.innerHTML = '<span style="font-weight:700;font-size:13px;letter-spacing:-.2px">Theme</span>';

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background:rgba(255,255,255,0.07);border:none;border-radius:5px;width:22px;height:22px;cursor:pointer;color:#94a3b8;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:0;';
    hdr.appendChild(closeBtn);
    panel.appendChild(hdr);

    /* ── Section helper ── */
    function addSection(title) {
      var s = document.createElement('div');
      s.style.cssText = 'padding:10px 14px 3px;font-size:10px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#4a5568;';
      s.textContent = title;
      panel.appendChild(s);
    }

    /* ── Accent swatches ── */
    addSection('Accent colour');
    var accentRow = document.createElement('div');
    accentRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:7px;padding:2px 14px 10px;';
    ACCENTS.forEach(function(a) {
      var btn = document.createElement('button');
      btn.className = 'bw-accent-btn';
      btn.dataset.accent = a.name;
      btn.dataset.color  = a.value;
      btn.title = a.name;
      btn.style.cssText = 'width:28px;height:28px;border-radius:50%;background:' + a.value + ';cursor:pointer;transition:transform .15s,border .15s,box-shadow .15s;outline:none;';
      accentRow.appendChild(btn);
    });
    panel.appendChild(accentRow);

    /* ── Background presets ── */
    addSection('Background');
    var bgGrid = document.createElement('div');
    bgGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:2px 14px 10px;';
    BACKGROUNDS.forEach(function(b) {
      var btn = document.createElement('button');
      btn.className = 'bw-bg-btn';
      btn.dataset.bg = b.name;
      btn.style.cssText = 'padding:7px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#94a3b8;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;';
      var swatch = document.createElement('span');
      swatch.style.cssText = 'width:11px;height:11px;border-radius:3px;background:' + b.bg + ';border:1px solid rgba(255,255,255,0.15);flex-shrink:0;';
      btn.appendChild(swatch);
      btn.appendChild(document.createTextNode(b.name));
      bgGrid.appendChild(btn);
    });
    panel.appendChild(bgGrid);

    /* ── Corner radius ── */
    addSection('Corner style');
    var radRow = document.createElement('div');
    radRow.style.cssText = 'display:flex;gap:5px;padding:2px 14px 10px;';
    RADII.forEach(function(rd) {
      var btn = document.createElement('button');
      btn.className = 'bw-radius-btn';
      btn.dataset.radius = rd.name;
      btn.style.cssText = 'flex:1;padding:7px 4px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#94a3b8;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;text-align:center;transition:all .15s;';
      btn.textContent = rd.name;
      radRow.appendChild(btn);
    });
    panel.appendChild(radRow);

    /* ── Reset ── */
    var resetWrap = document.createElement('div');
    resetWrap.style.cssText = 'padding:4px 14px 14px;';
    var resetBtn = document.createElement('button');
    resetBtn.id = 'bwCustReset';
    resetBtn.style.cssText = 'width:100%;padding:8px;border-radius:6px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);color:#fca5a5;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;';
    resetBtn.textContent = 'Reset to defaults';
    resetWrap.appendChild(resetBtn);
    panel.appendChild(resetWrap);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    /* ── Apply initial active states ── */
    refreshButtons(panel, prefs);

    /* ── Open / close ── */
    var open = false;

    function show() {
      open = true;
      panel.style.transform  = 'translateY(0) scale(1)';
      panel.style.opacity    = '1';
      panel.style.pointerEvents = 'auto';
      overlay.style.background   = 'rgba(0,0,0,0.18)';
      overlay.style.pointerEvents = 'auto';
    }
    function hide() {
      open = false;
      panel.style.transform  = 'translateY(14px) scale(0.96)';
      panel.style.opacity    = '0';
      panel.style.pointerEvents = 'none';
      overlay.style.background   = 'rgba(0,0,0,0)';
      overlay.style.pointerEvents = 'none';
    }

    closeBtn.addEventListener('click', hide);
    overlay.addEventListener('click', hide);

    /* ── Button handlers (update in-place — no DOM removal) ── */
    panel.addEventListener('click', function(e) {
      var btn = e.target.closest('.bw-accent-btn, .bw-bg-btn, .bw-radius-btn');
      if (!btn) return;
      var p2 = loadPrefs();
      if (btn.dataset.accent) p2.accent = btn.dataset.accent;
      if (btn.dataset.bg)     p2.bg     = btn.dataset.bg;
      if (btn.dataset.radius) p2.radius = btn.dataset.radius;
      savePrefs(p2);
      applyPrefs(p2);
      refreshButtons(panel, p2);
    });

    resetBtn.addEventListener('click', function() {
      savePrefs({});
      applyPrefs({});
      refreshButtons(panel, {});
    });

    /* ── Trigger button ── */
    var trigger = document.createElement('button');
    trigger.title = 'Customise theme';
    trigger.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>';
    trigger.style.cssText = [
      'position:fixed;bottom:20px;right:20px;z-index:99998',
      'width:42px;height:42px;border-radius:50%',
      'background:#161a26;border:1px solid rgba(255,255,255,0.12)',
      'color:#8b95a6;cursor:pointer',
      'display:flex;align-items:center;justify-content:center',
      'box-shadow:0 4px 18px rgba(0,0,0,0.55)',
      'transition:background .15s,color .15s,border-color .15s'
    ].join(';');

    trigger.addEventListener('mouseenter', function() {
      trigger.style.background   = 'var(--bw-accent-dim)';
      trigger.style.color        = 'var(--bw-accent)';
      trigger.style.borderColor  = 'var(--bw-accent-border)';
    });
    trigger.addEventListener('mouseleave', function() {
      trigger.style.background  = '#161a26';
      trigger.style.color       = '#8b95a6';
      trigger.style.borderColor = 'rgba(255,255,255,0.12)';
    });
    trigger.addEventListener('click', function() {
      if (open) { hide(); } else { show(); }
    });

    document.body.appendChild(trigger);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
