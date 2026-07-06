// ── Blog Post Renderer with Search & Tag Filter ─────────────────
// Reads posts/posts.json, renders cards client-side with live
// search (title + excerpt) and clickable tag filter buttons.

(async function() {
  const grid = document.getElementById('post-grid');
  if (!grid) return;

  // ── injected search UI ──────────────────────────────────────
  const searchBar = document.createElement('div');
  searchBar.id = 'blog-search-bar';
  searchBar.innerHTML = `
    <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center;">
      <input type="text" id="blog-search-input" placeholder="Search posts…"
        style="flex:1;min-width:180px;padding:0.55rem 0.85rem;border:1px solid rgba(149,213,178,0.4);
               border-radius:10px;font-size:0.9rem;background:white;outline:none;transition:border-color 0.2s;
               font-family:inherit;color:#2d6a4f;"
        onfocus="this.style.borderColor='#52b788'"
        onblur="this.style.borderColor='rgba(149,213,178,0.4)'">
      <div id="blog-tag-filters" style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;"></div>
    </div>
    <div id="blog-count" style="font-size:0.75rem;color:#8892b0;margin-bottom:0.75rem;"></div>
  `;
  grid.parentNode.insertBefore(searchBar, grid);

  const searchInput = document.getElementById('blog-search-input');
  const tagContainer = document.getElementById('blog-tag-filters');
  const countDisplay = document.getElementById('blog-count');

  try {
    const resp = await fetch('../posts/posts.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const allPosts = await resp.json();

    // Sort by date descending
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // ── extract unique tags ──────────────────────────────────
    const tags = [...new Set(allPosts.map(p => p.tag))].sort();

    // ── render tag buttons ───────────────────────────────────
    let activeTag = null;
    let query = '';

    function renderTags() {
      tagContainer.innerHTML = `<span style="font-size:0.75rem;color:#8892b0;margin-right:0.15rem;">Filter:</span>`;
      tags.forEach(tag => {
        const btn = document.createElement('button');
        btn.textContent = tag;
        btn.dataset.tag = tag;
        btn.style.cssText = `padding:0.3rem 0.65rem;border-radius:8px;border:1px solid rgba(149,213,178,0.3);
          font-size:0.75rem;cursor:pointer;background:${activeTag === tag ? '#52b788' : 'white'};
          color:${activeTag === tag ? 'white' : '#2d6a4f'};font-family:inherit;font-weight:500;
          transition:all 0.15s;`;
        btn.onmouseenter = () => { if(activeTag !== tag) btn.style.background = '#e8f5e9'; };
        btn.onmouseleave = () => { if(activeTag !== tag) btn.style.background = 'white'; };
        btn.onclick = () => {
          activeTag = activeTag === tag ? null : tag;
          renderTags();
          renderPosts();
        };
        tagContainer.appendChild(btn);
      });
      // Clear filter button
      if (activeTag) {
        const clear = document.createElement('button');
        clear.textContent = '✕ clear';
        clear.style.cssText = `padding:0.3rem 0.5rem;border-radius:8px;border:1px solid #e74c3c;
          font-size:0.7rem;cursor:pointer;background:white;color:#e74c3c;font-family:inherit;font-weight:500;`;
        clear.onclick = () => { activeTag = null; renderTags(); renderPosts(); };
        tagContainer.appendChild(clear);
      }
    }

    // ── render filtered posts ────────────────────────────────
    function renderPosts() {
      query = searchInput.value.toLowerCase().trim();
      const filtered = allPosts.filter(p => {
        if (activeTag && p.tag !== activeTag) return false;
        if (query && !p.title.toLowerCase().includes(query) &&
            !p.excerpt.toLowerCase().includes(query)) return false;
        return true;
      });

      countDisplay.textContent = `Showing ${filtered.length} of ${allPosts.length} posts`;

      if (filtered.length === 0) {
        grid.innerHTML = `<p style="color:#8892b0;padding:2rem;text-align:center;">No posts match your search. Try a different keyword or clear the tag filter.</p>`;
        return;
      }

      grid.innerHTML = filtered.map(p => `
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
    }

    searchInput.addEventListener('input', renderPosts);
    renderTags();
    renderPosts();

  } catch (e) {
    grid.innerHTML = `<p style="color:#8892b0;padding:2rem;text-align:center;">⚠️ Couldn't load posts. ${e.message}</p>`;
    console.error('Blog renderer:', e);
  }
})();
