// ── Vue 3 Homepage (CDN, zero build) ──────────────────────────
// Renders featured projects grid + latest blog posts + latest croak reactively.
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
      const latestCroak = ref(null);
      const postCount = ref(0);

      // ── Featured projects data ──────────────────────────────
      const featuredProjects = [
        {
          icon: '🌷',
          title: 'The Scouse Garden',
          url: 'scouse-garden.html',
          desc: 'The best thing on the site. Quote wall, wig images, manifesto, phonetics, and now dock-chippy memories. Two frogs. One accent. No regrets.',
          cta: 'Visit the Garden →'
        },
        {
          icon: '☕',
          title: 'Espresso Dial-In Companion',
          url: 'espresso-dial-in.html',
          desc: 'Extraction timer, shot logger, brew ratio calculator, taste notes, and trend charts. Built for the daily ritual of chasing the perfect shot.',
          cta: 'Pull a Shot →'
        },
        {
          icon: '🏆📋',
          title: 'Weapon or Wazzock',
          url: 'weapon-or-wazzock.html',
          desc: 'The binary classification game. Judge whether someone is an absolute legend or a complete div. Real history, absurd hypotheticals.',
          cta: 'Play Now →'
        },
        {
          icon: '🔍',
          title: 'The Missing Playtester',
          url: 'posts/the-case-of-the-missing-playtester.html',
          desc: 'She reached out. I replied. Then nothing. The investigation begins.',
          cta: 'Read the Post →'
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
          url: 'evolution-lab-v2/',
          desc: 'Natural selection in your browser. Heritable traits, mutation, reproduction. Watch evolution happen.',
          cta: 'Evolve Critters →'
        },
        {
          icon: '🪟',
          title: 'Glass Backbone Visualiser',
          url: 'tools/glass-backbone.html',
          desc: 'Toggle between efficiency mode and resilience mode. Watch failure cascades propagate through a fragile system. Inspired by US Army logistics research.',
          cta: 'Break Something →'
        },
        {
          icon: '🧬',
          title: 'Fitness Landscape',
          url: 'tools/fitness-landscape.html',
          desc: 'Selection pressure in 2D. Watch a population evolve across a generated fitness landscape — mutation, selection, and emergence in real time.',
          cta: 'Explore the Landscape →'
        },
        {
          icon: '🧬',
          title: 'Moran Process Explorer',
          url: 'tools/moran-process-explorer.html',
          desc: 'Three selection schemes — same N, same s, same start — different outcomes. 2-allele Moran process visualiser with parallel frequency traces.',
          cta: 'Evolve in Parallel →'
        },
        {
          icon: '🐸',
          title: 'Pond Moran Process',
          url: 'tools/pond-moran-process.html',
          desc: 'Watch evolution creature-by-creature. Orange vs purple in a pond — birth, death, fixation, all visible. Auto-resets with new mutants on fixation.',
          cta: 'Watch Evolution →'
        },
        {
          icon: '🧠',
          title: 'Model Footprint Explorer',
          url: 'tools/model-footprint-explorer.html',
          desc: 'Which models fit where? Slide parameters, compare quantization, check hardware compatibility. Bonsai 27B, Llama, Qwen, and cost comparisons.',
          cta: 'Explore Models →'
        },
        {
          icon: '🧐',
          title: 'LLM Cliché Detector',
          url: 'tools/llm-cliche-detector.html',
          desc: 'Paste text and see how many AI writing clichés it contains. Detects "load-bearing", "delve", "landscape" and 27 more overused LLM phrases. All client-side.',
          cta: 'Check Your Text →'
        }
      ];

      // ── Fetch dynamic data on mount ─────────────────────────
      onMounted(async () => {
        // Fetch posts
        try {
          const resp = await fetch('posts/posts.json');
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const allPosts = await resp.json();
          allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
          latestPosts.value = allPosts.slice(0, 4);
          postCount.value = allPosts.length;
          document.querySelectorAll('[data-count="posts"]').forEach(el => {
            el.textContent = allPosts.length;
          });
        } catch (e) {
          console.error('Home Vue: could not load posts', e);
        }

        // Fetch latest croak
        try {
          const resp = await fetch('morning-croak/croaks.json');
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const allCroaks = await resp.json();
          if (allCroaks.length > 0) {
            latestCroak.value = allCroaks[0];
          }
        } catch (e) {
          console.error('Home Vue: could not load croaks', e);
        }
      });

      return { latestPosts, latestCroak, featuredProjects, postCount };
    }
  });

  app.mount('#home-app');
})();
