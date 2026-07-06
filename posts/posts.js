// ── Blog Post Renderer ─────────────────────────────────────────────
// Reads posts/posts.json and renders the card grid client-side.
// Keeps the colourful tag styling, sorting, and card layout identical to
// the hand-authored version.

(async function() {
  const grid = document.getElementById('post-grid');
  if (!grid) return;

  try {
    const resp = await fetch('../posts/posts.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const posts = await resp.json();
    
    // Sort by date descending (newest first)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    grid.innerHTML = posts.map(p => `
      <a href="posts/${p.slug}.html" class="post-card">
        <div class="post-meta">
          <span class="post-tag" style="background:${p.tagBg};color:${p.tagFg};">${p.tag}</span>
          <span>${p.date}</span>
          <span>${p.context}</span>
        </div>
        <h2 class="post-title">${p.title}</h2>
        <p class="post-excerpt">${p.excerpt}</p>
        <span class="read-more">Read Post →</span>
      </a>
    `).join('');
  } catch (e) {
    grid.innerHTML = `<p style="color:#8892b0;padding:2rem;text-align:center;">⚠️ Couldn't load posts. ${e.message}</p>`;
    console.error('Blog renderer:', e);
  }
})();
