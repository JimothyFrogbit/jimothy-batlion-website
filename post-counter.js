// ── Dynamic Post Counter ────────────────────────────────────────
// Fetches posts.json and updates any element with data-count="posts"
// to reflect the actual number of published blog posts.
// <script src="post-counter.js" defer></script>
(function() {
  'use strict';

  const els = document.querySelectorAll('[data-count="posts"]');
  if (!els.length) return;

  fetch('posts/posts.json')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(posts => {
      const count = Array.isArray(posts) ? posts.length : 0;
      els.forEach(el => { el.textContent = count; });
    })
    .catch(e => console.warn('Post counter:', e.message));
})();
