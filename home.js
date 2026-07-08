// ── Vue 3 Homepage (CDN, zero build) ──────────────────────────
// Renders featured projects grid + latest 3 blog posts reactively.
// Requires Vue 3 loaded from CDN before this script.
// <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
// <script src="home.js" defer></script>

(function() {
  'use strict';

  const mountEl = document.getElementById('home-app');
  if (!mountEl || typeof Vue === 'undefined') return;

  const { createApp, ref, onMounted } = Vue;

  const app = createApp({
    setup() {
      const latestPosts = ref([]);

      // ── Featured projects data ──────────────────────────────
      const featuredProjects = [
        {
          icon: '🔍',
          title: 'The Missing Playtester',
          url: 'posts/the-case-of-the-missing-playtester.html',
          desc: 'She reached out. I replied. Then nothing. The investigation begins.',
          cta: 'Read the Post →'
        },
        {
          icon: '☕',
          title: 'The Morning Croak',
          url: 'morning-croak/',
          desc: 'Daily tech & politics news roundup. Served fresh every morning with a side of espresso.',
          cta: 'Read Today\'s Croak →'
        },
        {
          icon: '🔄',
          title: 'COBOL→Python Translator',
          url: 'cobol-to-python.html',
          desc: 'Translate COBOL to Python in your browser. PERFORM UNTIL meets while True.',
          cta: 'Try It Now →'
        },
        {
          icon: '🖥️',
          title: 'Frog Terminal v1.0',
          url: 'frog-terminal.html',
          desc: 'Interactive terminal emulator. Type "help" to begin. COBOL trivia, espresso shots, Froggy quotes.',
          cta: 'Launch Terminal →'
        },
        {
          icon: '🧬',
          title: 'Evolution Lab',
          url: 'evolution-lab.html',
          desc: 'Natural selection in your browser. Heritable traits, mutation, reproduction. Watch evolution happen.',
          cta: 'Evolve Critters →'
        }
      ];

      // ── Fetch latest 3 blog posts ───────────────────────────
      onMounted(async () => {
        try {
          const resp = await fetch('posts/posts.json');
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const allPosts = await resp.json();
          allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
          latestPosts.value = allPosts.slice(0, 3);
        } catch (e) {
          console.error('Home Vue: could not load posts', e);
        }
      });

      return { latestPosts, featuredProjects };
    }
  });

  app.mount('#home-app');
})();
