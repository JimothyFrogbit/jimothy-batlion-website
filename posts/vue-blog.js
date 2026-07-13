// ── Vue 3 Blog Listing (CDN, zero build) ──────────────────────
// Replaces posts/posts.js with a reactive Vue component.
// Requires Vue 3 loaded from CDN before this script.
// <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
// <script src="posts/vue-blog.js" defer></script>

(function() {
  'use strict';

  const mountEl = document.getElementById('post-grid');
  if (!mountEl || typeof Vue === 'undefined') return;

  // ── Fetch posts and mount Vue app ──────────────────────────────
  (async function() {
    let allPosts;
    try {
      const resp = await fetch('posts/posts.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      allPosts = await resp.json();
      allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      mountEl.innerHTML = `<p style="color:#8892b0;padding:2rem;text-align:center;">⚠️ Couldn't load posts. ${e.message}</p>`;
      console.error('Vue blog:', e);
      return;
    }

    // Extract unique tags from the posts
    const tags = [...new Set(allPosts.map(p => p.tag))].sort();

    const { createApp, ref, computed } = Vue;

    const app = createApp({
      setup() {
        const query = ref('');
        const activeTag = ref(null);
        const allPostsRef = ref(allPosts);

        const filteredPosts = computed(() => {
          const q = query.value.toLowerCase().trim();
          return allPosts.filter(p => {
            if (activeTag.value && p.tag !== activeTag.value) return false;
            if (q && !p.title.toLowerCase().includes(q) && !p.excerpt.toLowerCase().includes(q)) return false;
            return true;
          });
        });

        function setTag(tag) {
          activeTag.value = activeTag.value === tag ? null : tag;
        }

        function clearTag() {
          activeTag.value = null;
        }

        return { query, activeTag, tags, filteredPosts, allPostsRef, setTag, clearTag };
      },
      template: `
        <div>
          <!-- Search + tag filters -->
          <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center;">
            <input v-model="query" type="text" placeholder="Search posts…"
              style="flex:1;min-width:180px;padding:0.55rem 0.85rem;border:1px solid rgba(149,213,178,0.4);
                     border-radius:10px;font-size:0.9rem;background:var(--frog-bg);outline:none;transition:border-color 0.2s;
                     font-family:inherit;color:var(--text-dark);">
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">
              <span style="font-size:0.75rem;color:#8892b0;margin-right:0.15rem;">Filter:</span>
              <button v-for="tag in tags" :key="tag" @click="setTag(tag)"
                :style="{
                  padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid rgba(149,213,178,0.3)',
                  fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500',
                  background: activeTag === tag ? '#52b788' : 'var(--frog-bg)',
                  color: activeTag === tag ? 'white' : 'var(--frog-green)',
                  transition: 'all 0.15s'
                }"
                @mouseenter="e => { if(activeTag !== tag) e.target.style.background = 'var(--frog-warm)' }"
                @mouseleave="e => { if(activeTag !== tag) e.target.style.background = 'var(--frog-bg)' }">{{ tag }}</button>
              <button v-if="activeTag" @click="clearTag"
                style="padding:0.3rem 0.5rem;border-radius:8px;border:1px solid #e74c3c;
                       font-size:0.7rem;cursor:pointer;background:var(--frog-bg);color:#e74c3c;font-family:inherit;font-weight:500;">
                ✕ clear</button>
            </div>
          </div>

          <!-- Count -->
          <div style="font-size:0.75rem;color:#8892b0;margin-bottom:0.75rem;">
            Showing {{ filteredPosts.length }} of {{ allPostsRef.length }} posts
          </div>

          <!-- Empty state -->
          <p v-if="filteredPosts.length === 0"
            style="color:#8892b0;padding:2rem;text-align:center;">
            No posts match your search. Try a different keyword or clear the tag filter.
          </p>

          <!-- Post cards -->
          <a v-for="p in filteredPosts" :key="p.slug"
            :href="'posts/' + p.slug + '.html'" class="post-card">
            <div class="post-meta">
              <span class="post-tag" :style="{ background: p.tagBg, color: p.tagFg }">{{ p.tag }}</span>
              <span>{{ p.date }}</span>
              <span>{{ p.context }}</span>
            </div>
            <h2 class="post-title">{{ p.title }}</h2>
            <p class="post-excerpt">{{ p.excerpt }}</p>
            <span class="read-more">Read Post →</span>
          </a>
        </div>
      `
    });

    app.mount('#post-grid');
  })();
})();
