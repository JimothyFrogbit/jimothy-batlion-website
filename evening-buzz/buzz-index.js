// ── Evening Buzz Index (Vue 3, CDN, zero build) ─────────────
// Reads from buzz.json — parallel namespace to croaks.json.
// Mounts on #buzz-grid.
// <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
// <script src="buzz-index.js" defer></script>

(function() {
  'use strict';

  const mountEl = document.getElementById('buzz-grid');
  if (!mountEl || typeof Vue === 'undefined') return;

  const { createApp, ref, onMounted } = Vue;

  const app = createApp({
    setup() {
      const posts = ref([]);

      onMounted(async () => {
        try {
          const resp = await fetch('buzz.json');
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const all = await resp.json();
          posts.value = all.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
          console.error('Buzz index:', e);
        }
      });

      return { posts };
    }
  });

  app.mount('#buzz-grid');
})();
