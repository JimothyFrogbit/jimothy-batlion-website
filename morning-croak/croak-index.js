// ── Morning Croak Index (Vue 3, CDN, zero build) ──────────────
// Shows only posts tagged "🐸 Morning Croak" from posts.json.
// Mounts on #croak-grid.
// <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
// <script src="croak-index.js" defer></script>

(function() {
  'use strict';

  const mountEl = document.getElementById('croak-grid');
  if (!mountEl || typeof Vue === 'undefined') return;

  const { createApp, ref, onMounted } = Vue;

  const app = createApp({
    setup() {
      const posts = ref([]);

      onMounted(async () => {
        try {
          const resp = await fetch('../posts/posts.json');
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const all = await resp.json();
          // Filter for Morning Croak tag
          posts.value = all
            .filter(p => p.tag === '🐸 Morning Croak')
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
          console.error('Croak index:', e);
        }
      });

      return { posts };
    }
  });

  app.mount('#croak-grid');
})();
