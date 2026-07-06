// ── Trinary Theme Toggle ─────────────────────────────────────
// Cycles: light → dark → system → light...
// 'system' follows prefers-color-scheme and listens for changes.
// Persists in localStorage. Injects a floating toggle button.

(function() {
  'use strict';

  const KEY = 'jimothy-theme';
  const ICONS = { light: '🌙', dark: '☀️', system: '⚙️' };
  const MODES = ['light', 'dark', 'system'];

  function getSaved() {
    const v = localStorage.getItem(KEY);
    if (MODES.includes(v)) return v;
    return 'system';
  }

  function resolveTheme(mode) {
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    // system — follow OS preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(mode) {
    const resolved = resolveTheme(mode);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    // Store the user's chosen mode (light/dark/system), NOT the resolved value
    localStorage.setItem(KEY, mode);
  }

  let btn;

  function createToggle(savedMode) {
    btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.setAttribute('aria-label', 'Theme: ' + savedMode);
    btn.setAttribute('title', 'Cycle theme: light / dark / system');
    btn.innerHTML = ICONS[savedMode] || '⚙️';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '1.25rem', right: '1.25rem',
      zIndex: '9999', width: '44px', height: '44px',
      borderRadius: '50%', border: '2px solid var(--frog-light, #95d5b2)',
      background: 'var(--frog-bg, #f0f7f4)', cursor: 'pointer',
      fontSize: '1.25rem', lineHeight: '1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      transition: 'all 0.25s ease', opacity: '0.8', outline: 'none',
      color: 'var(--text-dark, #1a1a2e)', padding: '0',
      fontFamily: 'system-ui, sans-serif'
    });
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; btn.style.transform = 'scale(1.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.8'; btn.style.transform = 'scale(1)'; });
    btn.addEventListener('click', () => {
      const current = localStorage.getItem(KEY) || 'system';
      const idx = MODES.indexOf(current);
      const next = MODES[(idx + 1) % MODES.length];
      applyTheme(next);
      btn.innerHTML = ICONS[next];
      btn.setAttribute('aria-label', 'Theme: ' + next);
    });
    // Listen for OS theme changes when in 'system' mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const mode = localStorage.getItem(KEY) || 'system';
      if (mode === 'system') {
        const resolved = resolveTheme('system');
        document.documentElement.classList.toggle('dark', resolved === 'dark');
        // btn icon stays ⚙️ — that's the system indicator
      }
    });
    document.body.appendChild(btn);
  }

  // Init — apply immediately (before DOMContentLoaded if possible)
  const savedMode = getSaved();
  applyTheme(savedMode);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => createToggle(savedMode));
  } else {
    createToggle(savedMode);
  }
})();
