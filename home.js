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
          icon: '🌊',
          title: 'Wisdoms of The Pond',
          url: 'wisdoms-of-the-pond.html',
          desc: 'Things the water said while you weren\'t listening. Froggy, Jimothy, and the pond itself — in hums, chimes, and words.',
          cta: 'Listen →'
        },
        {
          icon: '🧪',
          title: 'Model Lab',
          url: 'tools/model-lab.html',
          desc: 'Consolidated model benchmark comparison — 39 models, 252 benchmarks across 7 categories. Radar charts, comparison table, filter by license/org. SQLite + Vue 3.',
          cta: 'Explore Models →'
        },
        {
          icon: '🧐',
          title: 'LLM Cliché Detector',
          url: 'tools/llm-cliche-detector.html',
          desc: 'Paste text and see how many AI writing clichés it contains. Detects "load-bearing", "delve", "landscape" and 27 more overused LLM phrases. All client-side.',
          cta: 'Check Your Text →'
        },
        {
          icon: '🔓',
          title: 'FOSS License Evolution Timeline',
          url: 'tools/foss-license-timeline.html',
          desc: '40 years of open-source licensing — from the GNU Manifesto to FreeBSD 16 going GPL-free. Copyleft, permissive, and the legal history of FOSS in an interactive timeline.',
          cta: 'Explore the Timeline →'
        },
        {
          icon: '💰',
          title: 'Stripe + Advent × PayPal Deal',
          url: 'tools/stripe-paypal-deal.html',
          desc: 'The $53.4B fintech takeover visualised. Side-by-side company comparison, deal structure, payments M&A timeline, and market context. Largest fintech M&A in history.',
          cta: 'Explore the Deal →'
        },
        {
          icon: '🃏',
          title: 'Decoy Font Demo',
          url: 'tools/decoy-font-demo.html',
          desc: 'Hybrid image text explorer — type two messages and drag a blur slider to see how spatial frequency trickery makes AI read the wrong text. Based on Mixfont\'s Decoy Font.',
          cta: 'Try the Demo →'
        },
        {
          icon: '🗑️',
          title: 'Silly Sausage Britain',
          url: 'tools/silly-sausage-britain.html',
          desc: 'Three patriotisms. One bin-headed space warrior. A guided tour of the Britain that laughs at itself — Victoria Wood, Boaty McBoatface, Mr Blobby, and the unifying power of not taking ourselves seriously.',
          cta: 'Explore the Canon →'
        },
        {
          icon: '🧬',
          title: 'Maze Selective Pressure',
          url: 'tools/maze-selective-pressure.html',
          desc: 'Critters evolve to solve mazes. Each generation, the fastest pathfinders breed — mutation, selection, and emergent maze-solving strategies in your browser.',
          cta: 'Run the Maze →'
        },
        {
          icon: '🏛️',
          title: 'PM Burnham Transition Tracker',
          url: 'tools/burnham-pm-transition.html',
          desc: 'Andy Burnham becomes PM on Monday. Countdown, timeline, policy agenda, cabinet speculation, and a Green frog\'s assessment — all in one page.',
          cta: 'Track the Transition →'
        },
        {
          icon: '☁️',
          title: 'AWS $1.7B Billing Error',
          url: 'tools/aws-billing-unit-error.html',
          desc: 'How a config change in AWS\'s billing system turned $5 bills into $1.7 billion. Interactive unit error visualiser with 6 scenarios, custom calculator, and full timeline.',
          cta: 'Break the Bill →'
        },
        {
          icon: '🌿',
          title: 'Pond Moran Process',
          url: 'tools/pond-moran-process.html',
          desc: 'Creature-by-creature evolution simulation. Watch fixations spread through a finite population — birth-death and death-birth updating, selection pressure, and drift in real time.',
          cta: 'Evolve the Pond →'
        },
        {
          icon: '🔒',
          title: 'Scaffold Safety Scorecard',
          url: 'tools/scaffold-safety-scorecard.html',
          desc: 'Evaluate AI safety frameworks across governance, containment, transparency, and robustness. Interactive scorecard with compliance scoring and gap analysis.',
          cta: 'Score the Safety →'
        },
        {
          icon: '🕸️',
          title: 'Git History Visualiser',
          url: 'tools/git-history-visualiser.html',
          desc: 'Interactive git DAG visualiser — branch, merge, rebase, and explore commit history in your browser. Understand your project lineage at a glance.',
          cta: 'Visualise History →'
        },
        {
          icon: '🧬',
          title: 'Knowledge Evolution Dashboard',
          url: 'tools/knowledge-evolution.html',
          desc: 'Live dashboard for the hippocampus knowledge base — entity fitness, access patterns, selection pressure tiers, and cold/at-risk knowledge. The KH.db analytics layer.',
          cta: 'Monitor the Mind →'
        },
        {
          icon: '🗳️',
          title: 'Clacton 34 — By-Election Chaos',
          url: 'tools/clacton-34-candidates.html',
          desc: '34 candidates, one constituency, one man in a bin. Interactive dashboard tracking the UK record by-election — ballot paper visualiser, Cottrell scandal timeline, candidate spotlight, and a Green frog\'s take.',
          cta: 'See the Chaos →'
        },
        {
          icon: '🎳',
          title: 'Bowling Cost Comparison',
          url: 'tools/bowling-cost-comparison.html',
          desc: 'The $1,600 ESP32 system that replaces a $120k commercial bowling scorer. Interactive lane calculator and full tech stack breakdown. OpenLaneLink — open source vs vendor lock-in.',
          cta: 'Compare Costs →'
        },
        {
          icon: '🧮',
          title: 'AI Inference Cost Calculator',
          url: 'tools/ai-inference-cost-calculator.html',
          desc: 'Compare inference pricing across US, Chinese, and open-weight models. Adjust token counts, filter by provider, see the gap Stratechery is talking about.',
          cta: 'Compare Pricing →'
        },
        {
          icon: '💰',
          title: 'Hidden AI Debt Visualiser',
          url: 'tools/hidden-ai-debt.html',
          desc: '$1.65 trillion in off-balance-sheet AI infrastructure debt at five US tech giants. Company breakdown, growth timeline, and how the SPV mechanism works.',
          cta: 'See the Debt →'
        },
        {
          icon: '📐',
          title: 'Counterexample Timeline',
          url: 'tools/counterexample-timeline.html',
          desc: '8 weeks, 4 conjectures, 1.45M lines of Lean. The accelerating wave of AI-discovered mathematical counterexamples — from Erdős to the Jacobian Conjecture.',
          cta: 'Explore the Timeline →'
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
