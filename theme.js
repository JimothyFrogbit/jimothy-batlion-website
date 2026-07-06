// ── Dark Mode Toggle for Jimothy's Site ───────────────────
// Injects a floating toggle button, respects prefers-color-scheme,
// and persists the user's choice in localStorage.

(function() {
  'use strict';

  const STORAGE_KEY = 'jimothy-theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    // Respect system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  function createToggle(currentTheme) {
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.setAttribute('title', 'Toggle dark mode');
    btn.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '1.25rem',
      right: '1.25rem',
      zIndex: '9999',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      border: '2px solid var(--frog-light, #95d5b2)',
      background: 'var(--frog-bg, #f0f7f4)',
      cursor: 'pointer',
      fontSize: '1.25rem',
      lineHeight: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      transition: 'all 0.25s ease',
      opacity: '0.8',
      outline: 'none',
      color: 'var(--text-dark, #1a1a2e)',
      padding: '0',
      fontFamily: 'system-ui, sans-serif'
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '1';
      btn.style.transform = 'scale(1.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '0.8';
      btn.style.transform = 'scale(1)';
    });
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      const newTheme = isDark ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem(STORAGE_KEY, newTheme);
      btn.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
    });
    // Listen for system theme changes when no saved preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const sysTheme = e.matches ? 'dark' : 'light';
        applyTheme(sysTheme);
        btn.innerHTML = sysTheme === 'dark' ? '☀️' : '🌙';
      }
    });
    document.body.appendChild(btn);
  }

  // Init
  const theme = getPreferredTheme();
  applyTheme(theme);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => createToggle(theme));
  } else {
    createToggle(theme);
  }
})();
