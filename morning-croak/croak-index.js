// ── Morning Croak Index (Vue 3, CDN, zero build) ──────────────
// Reads from croaks.json — not posts.json. Separate namespace.
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
          const resp = await fetch('croaks.json');
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const all = await resp.json();
          posts.value = all.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
          console.error('Croak index:', e);
        }
      });

      return { posts };
    }
  });

  app.mount('#croak-grid');
})();
