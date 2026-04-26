(function () {
  var STORAGE_KEY = 'bw_theme_v1';

  var ACCENTS = [
    { name: 'Gold',    value: '#f5be1e', dim: 'rgba(245,190,30,0.12)',  border: 'rgba(245,190,30,0.28)'  },
    { name: 'Sky',     value: '#38bdf8', dim: 'rgba(56,189,248,0.12)',   border: 'rgba(56,189,248,0.28)'  },
    { name: 'Green',   value: '#4ade80', dim: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.28)'  },
    { name: 'Violet',  value: '#a78bfa', dim: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.28)' },
    { name: 'Rose',    value: '#fb7185', dim: 'rgba(251,113,133,0.12)',  border: 'rgba(251,113,133,0.28)' },
    { name: 'Orange',  value: '#fb923c', dim: 'rgba(251,146,60,0.12)',   border: 'rgba(251,146,60,0.28)'  },
  ];

  var BACKGROUNDS = [
    { name: 'Dark',      bg: '#0d0f14', bg1: '#111420', bg2: '#161a26', bg3: '#1c2133' },
    { name: 'Darker',    bg: '#080a0e', bg1: '#0b0d13', bg2: '#10131c', bg3: '#151828' },
    { name: 'Charcoal',  bg: '#111214', bg1: '#18191e', bg2: '#1e1f26', bg3: '#25262f' },
    { name: 'Navy',      bg: '#0a0d18', bg1: '#0f1322', bg2: '#141830', bg3: '#1a1e38' },
  ];

  var RADII = [
    { name: 'Rounded', value: '8px' },
    { name: 'Sharp',   value: '4px' },
    { name: 'Pill',    value: '12px' },
  ];

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }

  function savePrefs(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) {}
  }

  function applyPrefs(p) {
    var r = document.documentElement;
    var a = ACCENTS.find(function(x) { return x.name === p.accent; }) || ACCENTS[0];
    var b = BACKGROUNDS.find(function(x) { return x.name === p.bg; }) || BACKGROUNDS[0];
    var rd = RADII.find(function(x) { return x.name === p.radius; }) || RADII[0];

    r.style.setProperty('--bw-accent',        a.value);
    r.style.setProperty('--bw-accent-dim',    a.dim);
    r.style.setProperty('--bw-accent-border', a.border);
    r.style.setProperty('--bw-bg',            b.bg);
    r.style.setProperty('--bw-bg1',           b.bg1);
    r.style.setProperty('--bw-bg2',           b.bg2);
    r.style.setProperty('--bw-bg3',           b.bg3);
    r.style.setProperty('--bw-radius',        rd.value);
  }

  function buildPanel() {
    var p = loadPrefs();

    var overlay = document.createElement('div');
    overlay.id = 'bwCustomizerOverlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0)',
      'pointer-events:none;transition:background 0.25s'
    ].join(';');

    var panel = document.createElement('div');
    panel.id = 'bwCustomizerPanel';
    panel.style.cssText = [
      'position:fixed;bottom:72px;right:20px;z-index:99999',
      'width:252px;background:#111420;border:1px solid rgba(255,255,255,0.12)',
      'border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,0.7)',
      'font-family:Inter,-apple-system,sans-serif;font-size:12px;color:#e8ecf0',
      'overflow:hidden;transform:translateY(12px) scale(0.97);opacity:0',
      'transition:transform 0.22s cubic-bezier(0.34,1.3,0.64,1),opacity 0.2s',
      'pointer-events:none'
    ].join(';');

    var headerHtml = [
      '<div style="background:#161a26;border-bottom:1px solid rgba(255,255,255,0.07);',
      'padding:12px 14px;display:flex;align-items:center;justify-content:space-between;">',
      '<div style="font-weight:700;font-size:13px;letter-spacing:-0.2px;">Theme</div>',
      '<button id="bwCustClose" style="background:rgba(255,255,255,0.07);border:none;',
      'border-radius:5px;width:22px;height:22px;cursor:pointer;color:#94a3b8;',
      'font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>',
      '</div>'
    ].join('');

    function section(title) {
      return '<div style="padding:10px 14px 4px;font-size:10px;font-weight:700;',
             'letter-spacing:1.2px;text-transform:uppercase;color:#4a5568;">' + title + '</div>';
    }

    var accentHtml = section('Accent colour');
    accentHtml += '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;">';
    ACCENTS.forEach(function(a) {
      var active = (p.accent === a.name || (!p.accent && a.name === 'Gold'));
      accentHtml += [
        '<button data-accent="' + a.name + '" title="' + a.name + '"',
        'style="width:28px;height:28px;border-radius:50%;background:' + a.value + ';',
        'border:' + (active ? '2px solid #fff' : '2px solid transparent') + ';',
        'box-shadow:' + (active ? '0 0 0 1px ' + a.value : 'none') + ';',
        'cursor:pointer;transition:transform 0.15s,border 0.15s;" class="bw-accent-btn"></button>'
      ].join('');
    });
    accentHtml += '</div>';

    var bgHtml = section('Background');
    bgHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:0 14px 10px;">';
    BACKGROUNDS.forEach(function(b) {
      var active = (p.bg === b.name || (!p.bg && b.name === 'Dark'));
      bgHtml += [
        '<button data-bg="' + b.name + '"',
        'style="padding:7px 8px;border-radius:6px;border:1px solid ',
        (active ? 'var(--bw-accent)' : 'rgba(255,255,255,0.1)') + ';',
        'background:' + (active ? 'var(--bw-accent-dim)' : 'rgba(255,255,255,0.04)') + ';',
        'color:' + (active ? 'var(--bw-accent)' : '#94a3b8') + ';',
        'font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;',
        'display:flex;align-items:center;gap:6px;transition:all 0.15s;" class="bw-bg-btn">',
        '<span style="width:12px;height:12px;border-radius:3px;background:' + b.bg + ';',
        'border:1px solid rgba(255,255,255,0.15);flex-shrink:0;"></span>' + b.name + '</button>'
      ].join('');
    });
    bgHtml += '</div>';

    var radiiHtml = section('Corner style');
    radiiHtml += '<div style="display:flex;gap:5px;padding:0 14px 14px;">';
    RADII.forEach(function(rd) {
      var active = (p.radius === rd.name || (!p.radius && rd.name === 'Rounded'));
      radiiHtml += [
        '<button data-radius="' + rd.name + '"',
        'style="flex:1;padding:7px 4px;border-radius:6px;border:1px solid ',
        (active ? 'var(--bw-accent)' : 'rgba(255,255,255,0.1)') + ';',
        'background:' + (active ? 'var(--bw-accent-dim)' : 'rgba(255,255,255,0.04)') + ';',
        'color:' + (active ? 'var(--bw-accent)' : '#94a3b8') + ';',
        'font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;',
        'text-align:center;transition:all 0.15s;" class="bw-radius-btn">' + rd.name + '</button>'
      ].join('');
    });
    radiiHtml += '</div>';

    var resetHtml = [
      '<div style="padding:0 14px 14px;">',
      '<button id="bwCustReset" style="width:100%;padding:8px;border-radius:6px;',
      'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);',
      'color:#fca5a5;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;">',
      'Reset to defaults</button></div>'
    ].join('');

    panel.innerHTML = headerHtml + accentHtml + bgHtml + radiiHtml + resetHtml;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    var isOpen = false;

    function open() {
      isOpen = true;
      panel.style.transform = 'translateY(0) scale(1)';
      panel.style.opacity = '1';
      panel.style.pointerEvents = 'auto';
      overlay.style.background = 'rgba(0,0,0,0.15)';
      overlay.style.pointerEvents = 'auto';
    }

    function close() {
      isOpen = false;
      panel.style.transform = 'translateY(12px) scale(0.97)';
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
      overlay.style.background = 'rgba(0,0,0,0)';
      overlay.style.pointerEvents = 'none';
    }

    document.getElementById('bwCustClose').addEventListener('click', close);
    overlay.addEventListener('click', close);

    panel.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-accent],[data-bg],[data-radius]');
      if (!btn) return;

      var prefs = loadPrefs();
      if (btn.dataset.accent) prefs.accent = btn.dataset.accent;
      if (btn.dataset.bg)     prefs.bg     = btn.dataset.bg;
      if (btn.dataset.radius) prefs.radius  = btn.dataset.radius;
      savePrefs(prefs);
      applyPrefs(prefs);

      document.getElementById('bwCustomizerPanel').remove();
      document.getElementById('bwCustomizerOverlay').remove();
      buildPanel();
      open();
    });

    document.getElementById('bwCustReset').addEventListener('click', function() {
      savePrefs({});
      applyPrefs({});
      document.getElementById('bwCustomizerPanel').remove();
      document.getElementById('bwCustomizerOverlay').remove();
      buildPanel();
      open();
    });

    return { open: open, close: close, isOpen: function() { return isOpen; } };
  }

  function buildTrigger(panelCtrl) {
    var btn = document.createElement('button');
    btn.id = 'bwCustTrigger';
    btn.title = 'Customise theme';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>';
    btn.style.cssText = [
      'position:fixed;bottom:20px;right:20px;z-index:99997',
      'width:42px;height:42px;border-radius:50%',
      'background:var(--bw-bg2);border:1px solid var(--bw-border2)',
      'color:var(--bw-text2);cursor:pointer',
      'display:flex;align-items:center;justify-content:center',
      'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
      'transition:background 0.15s,color 0.15s,transform 0.2s',
      'font-family:inherit'
    ].join(';');

    btn.addEventListener('mouseenter', function() {
      btn.style.background = 'var(--bw-accent-dim)';
      btn.style.color = 'var(--bw-accent)';
      btn.style.borderColor = 'var(--bw-accent-border)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.background = 'var(--bw-bg2)';
      btn.style.color = 'var(--bw-text2)';
      btn.style.borderColor = 'var(--bw-border2)';
    });

    btn.addEventListener('click', function() {
      if (panelCtrl.isOpen()) {
        panelCtrl.close();
      } else {
        panelCtrl.open();
      }
    });

    document.body.appendChild(btn);
  }

  function init() {
    var prefs = loadPrefs();
    applyPrefs(prefs);
    var panelCtrl = buildPanel();
    buildTrigger(panelCtrl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
