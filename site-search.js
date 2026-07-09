// ── Site Search Overlay (Ctrl+K / Cmd+K) ───────────────────────
// Load after root.css and theme.js on any page.
// <script src="site-search.js" defer></script>
(function() {
  'use strict';

  let searchIndex = [];
  let overlay = null;
  let input = null;
  let results = null;

  function openSearch() {
    if (!overlay) createOverlay();
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 100);
    if (searchIndex.length === 0) loadIndex();
  }

  function closeSearch() {
    if (!overlay) return;
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'site-search-overlay';
    overlay.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;"
        class="search-backdrop"></div>
      <div style="position:fixed;top:15%;left:50%;transform:translateX(-50%);
        width:min(600px,90vw);max-height:70vh;background:white;border-radius:16px;
        box-shadow:0 16px 48px rgba(0,0,0,0.2);z-index:9999;display:flex;flex-direction:column;
        overflow:hidden;border:1px solid var(--frog-light, #95d5b2);"
        class="search-panel">
        <div style="display:flex;align-items:center;border-bottom:1px solid rgba(149,213,178,0.3);
          padding:0.75rem 1rem;gap:0.5rem;">
          <span style="font-size:1.1rem;color:var(--frog-green, #2d6a4f);">🔍</span>
          <input type="text" id="search-input" autocomplete="off" spellcheck="false"
            placeholder="Search posts…"
            style="flex:1;border:none;outline:none;font-size:1rem;font-family:inherit;
              background:transparent;color:var(--frog-accent, #1b4332);">
          <kbd style="font-size:0.65rem;background:#e8f5e9;color:var(--frog-green, #2d6a4f);
            padding:0.2rem 0.5rem;border-radius:4px;border:1px solid rgba(149,213,178,0.3);">
            ESC</kbd>
        </div>
        <div id="search-results" style="overflow-y:auto;padding:0.5rem;min-height:60px;flex:1;">
          <div style="text-align:center;color:#8892b0;padding:2rem;font-size:0.85rem;">
            Loading search index…
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    input = overlay.querySelector('#search-input');
    results = overlay.querySelector('#search-results');

    // Close on backdrop click
    overlay.querySelector('.search-backdrop').addEventListener('click', closeSearch);

    // Close on Escape
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeSearch();
      if (e.key === 'Enter') {
        const firstLink = results.querySelector('a');
        if (firstLink) { window.location.href = firstLink.href; closeSearch(); }
      }
    });

    // Real-time search
    let searchTimer;
    input.addEventListener('input', function() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 80);
    });

    // Keyboard navigation within results
    input.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const links = results.querySelectorAll('a');
        if (!links.length) return;
        const current = document.activeElement;
        let idx = -1;
        links.forEach((l, i) => { if (l === current) idx = i; });
        if (e.key === 'ArrowDown') idx = Math.min(idx + 1, links.length - 1);
        else idx = Math.max(idx - 1, 0);
        links[idx].focus();
      }
    });
  }

  function loadIndex() {
    fetch('data/search-index.json')
      .then(r => r.json())
      .then(data => {
        searchIndex = data;
        results.innerHTML = `<div style="text-align:center;color:#8892b0;padding:2rem;font-size:0.85rem;">
          Type to search ${data.length} posts…</div>`;
      })
      .catch(function() {
        results.innerHTML = `<div style="text-align:center;color:#e74c3c;padding:2rem;font-size:0.85rem;">
          ⚠️ Could not load search index.</div>`;
      });
  }

  function doSearch() {
    const q = input.value.toLowerCase().trim();
    if (!q || searchIndex.length === 0) {
      results.innerHTML = searchIndex.length
        ? `<div style="text-align:center;color:#8892b0;padding:2rem;font-size:0.85rem;">
            Type to search ${searchIndex.length} posts…</div>`
        : `<div style="text-align:center;color:#8892b0;padding:2rem;font-size:0.85rem;">
            Loading search index…</div>`;
      return;
    }

    const terms = q.split(/\s+/).filter(Boolean);
    const scored = [];

    for (const post of searchIndex) {
      const haystack = (post.title + ' ' + post.excerpt + ' ' + post.tag + ' ' + post.date).toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (haystack.includes(t)) {
          score += 10;
          // Bonus for title matches
          if (post.title.toLowerCase().includes(t)) score += 20;
          // Bonus for starts-with in title
          if (post.title.toLowerCase().startsWith(t)) score += 15;
        } else {
          score = -1;
          break;
        }
      }
      if (score > 0) scored.push({ post, score });
    }

    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      results.innerHTML = `<div style="text-align:center;color:#8892b0;padding:2rem;font-size:0.85rem;">
        No posts match "${q}". Try a different keyword.</div>`;
      return;
    }

    results.innerHTML = scored.map(({post}) => `
      <a href="${post.url}" class="search-result-item"
        style="display:block;padding:0.6rem 0.75rem;border-radius:10px;text-decoration:none;
          color:inherit;transition:background 0.1s;border-bottom:1px solid rgba(149,213,178,0.15);
          cursor:pointer;"
        onmouseenter="this.style.background='rgba(45,106,79,0.06)'"
        onmouseleave="this.style.background='transparent'">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
          <strong style="font-size:0.9rem;color:var(--frog-accent,#1b4332);">${highlight(post.title, terms)}</strong>
          <span style="font-size:0.65rem;color:#8892b0;white-space:nowrap;">${post.tag} · ${post.date}</span>
        </div>
        <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem;line-height:1.4;">
          ${highlight(post.excerpt.slice(0, 120) + (post.excerpt.length > 120 ? '…' : ''), terms)}
        </div>
      </a>
    `).join('');
  }

  // Simple highlight: wrap matching terms in <mark>
  function highlight(text, terms) {
    let result = text;
    for (const t of terms) {
      const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      result = result.replace(re, '<mark style="background:#d8f3dc;color:#1b4332;border-radius:3px;padding:0 2px;">$1</mark>');
    }
    return result;
  }

  // ── Keyboard shortcut ──────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    // Close with Escape even if input isn't focused
    if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') {
      closeSearch();
    }
  });

  // ── Dark mode support ──────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .dark .search-panel {
      background: #1a2332 !important;
      border-color: #2d3748 !important;
    }
    .dark .search-panel input {
      color: #e2e8f0 !important;
    }
    .dark .search-result-item strong {
      color: #b7e4c7 !important;
    }
    .dark .search-result-item div {
      color: #94a3b8 !important;
    }
    .dark .search-backdrop {
      background: rgba(0,0,0,0.7) !important;
    }
  `;
  document.head.appendChild(style);

  console.log('🔍 Site search loaded — Ctrl+K / Cmd+K to open');
})();
