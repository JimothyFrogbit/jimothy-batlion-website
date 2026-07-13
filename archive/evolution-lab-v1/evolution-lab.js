'use strict';

      'use strict';

      window.__simErrors = [];
      const origOnError = window.onerror;
      window.onerror = function(msg, url, line, col, err) {
        window.__simErrors.push({msg: msg, line: line, col: col});
        if (origOnError) return origOnError(msg, url, line, col, err);
      };

      const canvas = document.getElementById('evoCanvas');
      const ctx = canvas.getContext('2d');
      const W = 920, H = 560;

      // ---- Sim state ----
      let critters = [];
      let foods = [];
      let generation = 0;
      let running = true;
      let speed = 5;
      let frameCount = 0;
      let tickAccum = 0;
      const TICK_RATE = 16;
      let lastTime = 0;
      let startTime = Date.now();
      let totalBorn = 0;
      let totalDied = 0;
      let totalKills = 0;

      // ---- Galápagos mode state ----
      let galapagosMode = false;
      let selected = [];
      let galapagosBar = document.getElementById('galapagosBar');

      // ---- Cellular Automata state ----
      let simMode = 'evolution'; // 'evolution' | 'ca'
      let caGrid = [];
      let caCols = 58;
      let caRows = 35;
      let caGen = 0;
      let caRunning = false;
      let caFrameCount = 0;
      const CELL_SIZE = 16;
      const CA_COLS = 58;
      const CA_ROWS = 35;
      // Offset so grid is centered in the 920x560 canvas
      const CA_OFFSET_X = Math.floor((920 - CA_COLS * CELL_SIZE) / 2);
      const CA_OFFSET_Y = Math.floor((560 - CA_ROWS * CELL_SIZE) / 2);

      // ---- Species ----
      let species = [];
      const SPECIES_COLORS = [
        '#4ade80', '#facc15', '#fb923c', '#f472b6', '#818cf8',
        '#a78bfa', '#34d399', '#f87171', '#60a5fa', '#c084fc',
        '#fbbf24', '#e879f9'
      ];
      const SPECIES_THRESHOLD = 0.6;

      // ---- Trait config ----
      const TRAITS = {
        speed:      { min: 0.5, max: 4.0, mut: 0.25, label: 'Speed' },
        size:       { min: 3,   max: 10,  mut: 0.6, label: 'Size' },
        detection:  { min: 30,  max: 180, mut: 12,  label: 'Detection' },
        efficiency: { min: 0.6, max: 2.0, mut: 0.12, label: 'Efficiency' },
      };

      // ---- Helpers ----
      function jitter(amount) { return (Math.random() - 0.5) * 2 * amount; }
      function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
      function lerp(a, b, t) { return a + (b - a) * t; }
      function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

      // ---- Trait utilities ----
      function getTraitVector(c) {
        return {
          speed: (c.speed - TRAITS.speed.min) / (TRAITS.speed.max - TRAITS.speed.min),
          size: (c.size - TRAITS.size.min) / (TRAITS.size.max - TRAITS.size.min),
          detection: (c.detection - TRAITS.detection.min) / (TRAITS.detection.max - TRAITS.detection.min),
          efficiency: (c.efficiency - TRAITS.efficiency.min) / (TRAITS.efficiency.max - TRAITS.efficiency.min),
        };
      }

      function traitDist(a, b) {
        const dx = a.speed - b.speed;
        const dy = a.size - b.size;
        const dz = a.detection - b.detection;
        const dw = a.efficiency - b.efficiency;
        return Math.sqrt(dx*dx + dy*dy + dz*dz + dw*dw);
      }

      // ---- Species clustering ----
      function reassignSpecies() {
        species = [];
        for (const c of critters) {
          const tv = getTraitVector(c);
          let bestIdx = -1;
          let bestDist = SPECIES_THRESHOLD;
          for (let s = 0; s < species.length; s++) {
            const d = traitDist(tv, species[s].centroid);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = s;
            }
          }
          if (bestIdx >= 0) {
            c.speciesId = bestIdx;
            const sp = species[bestIdx];
            sp.count++;
            const alpha = 1 / sp.count;
            sp.centroid.speed = (1 - alpha) * sp.centroid.speed + alpha * tv.speed;
            sp.centroid.size = (1 - alpha) * sp.centroid.size + alpha * tv.size;
            sp.centroid.detection = (1 - alpha) * sp.centroid.detection + alpha * tv.detection;
            sp.centroid.efficiency = (1 - alpha) * sp.centroid.efficiency + alpha * tv.efficiency;
          } else {
            c.speciesId = species.length;
            species.push({
              id: species.length,
              centroid: { ...tv },
              count: 1,
              color: SPECIES_COLORS[species.length % SPECIES_COLORS.length]
            });
          }
        }
        // Re-count after all assigned
        for (const s of species) s.count = 0;
        for (const c of critters) {
          if (c.speciesId !== undefined && species[c.speciesId]) {
            species[c.speciesId].count++;
          }
        }
        // Remove empty species and reassign survivors
        species = species.filter(s => s.count > 0);
        // Remap ids
        const idMap = {};
        species.forEach((s, i) => { idMap[s.id] = i; s.id = i; });
        for (const c of critters) {
          if (c.speciesId !== undefined && idMap[c.speciesId] !== undefined) {
            c.speciesId = idMap[c.speciesId];
          }
        }
        updateSpeciesLegend();
      }

      // ---- Simpson's Diversity Index ----
      function calcDiversity() {
        if (critters.length === 0) return 0;
        let sum = 0;
        for (const s of species) {
          const p = s.count / critters.length;
          sum += p * p;
        }
        // 1 - Simpson index (higher = more diverse)
        return 1 - sum;
      }

      // ---- Critter ----
      function createCritter(x, y, traits, parent, isPredator) {
        const t = traits || randomTraits(parent);
        const pred = isPredator || false;
        return {
          x: x || Math.random() * W,
          y: y || Math.random() * H,
          speed: t.speed,
          size: t.size,
          detection: t.detection,
          efficiency: t.efficiency,
          isPredator: pred,
          energy: pred ? 120 : 100,
          birthGen: generation,
          age: 0,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          targetX: null,
          targetY: null,
          retargetTimer: 0,
          speciesId: 0,
        };
      }

      function randomTraits(parent, isPredator) {
        if (isPredator) {
          return {
            speed:      lerp(2.0, 5.0, Math.random()),
            size:       lerp(7, 14, Math.random()),
            detection:  lerp(80, 200, Math.random()),
            efficiency: lerp(0.4, 1.2, Math.random()),
          };
        }
        if (parent) {
          return {
            speed:      clamp(parent.speed + jitter(TRAITS.speed.mut), TRAITS.speed.min, TRAITS.speed.max),
            size:       clamp(parent.size + jitter(TRAITS.size.mut), TRAITS.size.min, TRAITS.size.max),
            detection:  clamp(parent.detection + jitter(TRAITS.detection.mut), TRAITS.detection.min, TRAITS.detection.max),
            efficiency: clamp(parent.efficiency + jitter(TRAITS.efficiency.mut), TRAITS.efficiency.min, TRAITS.efficiency.max),
          };
        }
        return {
          speed:      lerp(TRAITS.speed.min, TRAITS.speed.max, Math.random()),
          size:       lerp(TRAITS.size.min, TRAITS.size.max, Math.random()),
          detection:  lerp(TRAITS.detection.min, TRAITS.detection.max, Math.random()),
          efficiency: lerp(TRAITS.efficiency.min, TRAITS.efficiency.max, Math.random()),
        };
      }

      // ---- Sexual recombination ----
      function recombineTraits(parentA, parentB) {
        const blend = 0.5; // how much each parent contributes
        const avgSpeed = parentA.speed * (1 - blend) + parentB.speed * blend;
        const avgSize = parentA.size * (1 - blend) + parentB.size * blend;
        const avgDet = parentA.detection * (1 - blend) + parentB.detection * blend;
        const avgEff = parentA.efficiency * (1 - blend) + parentB.efficiency * blend;
        return {
          speed:      clamp(avgSpeed + jitter(TRAITS.speed.mut), TRAITS.speed.min, TRAITS.speed.max),
          size:       clamp(avgSize + jitter(TRAITS.size.mut), TRAITS.size.min, TRAITS.size.max),
          detection:  clamp(avgDet + jitter(TRAITS.detection.mut), TRAITS.detection.min, TRAITS.detection.max),
          efficiency: clamp(avgEff + jitter(TRAITS.efficiency.mut), TRAITS.efficiency.min, TRAITS.efficiency.max),
        };
      }

      // ---- CA grid helpers ----
      function initCAGrid(cols, rows) {
        caCols = cols || CA_COLS;
        caRows = rows || CA_ROWS;
        caGrid = [];
        for (let r = 0; r < caRows; r++) {
          caGrid[r] = [];
          for (let c = 0; c < caCols; c++) {
            caGrid[r][c] = 0;
          }
        }
        caGen = 0;
        caRunning = false;
        caFrameCount = 0;
      }

      function clearCAGrid() {
        for (let r = 0; r < caRows; r++) {
          for (let c = 0; c < caCols; c++) {
            caGrid[r][c] = 0;
          }
        }
        caGen = 0;
      }

      function randomCAGrid(density) {
        density = density || 0.3;
        for (let r = 0; r < caRows; r++) {
          for (let c = 0; c < caCols; c++) {
            caGrid[r][c] = Math.random() < density ? 1 : 0;
          }
        }
        caGen = 0;
      }

      function caCountNeighbors(grid, r, c) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = (r + dr + caRows) % caRows;
            const nc = (c + dc + caCols) % caCols;
            count += grid[nr][nc];
          }
        }
        return count;
      }

      function caTick() {
        if (!caRunning) return;
        const next = [];
        for (let r = 0; r < caRows; r++) {
          next[r] = [];
          for (let c = 0; c < caCols; c++) {
            const n = caCountNeighbors(caGrid, r, c);
            if (caGrid[r][c] === 1) {
              // Survival: 2 or 3 neighbors
              next[r][c] = (n === 2 || n === 3) ? 1 : 0;
            } else {
              // Birth: exactly 3 neighbors
              next[r][c] = (n === 3) ? 1 : 0;
            }
          }
        }
        caGrid = next;
        caGen++;
        caFrameCount++;
        updateCAStats();
      }

      // ---- CA Presets ----
      function placeCAPattern(pattern, offsetR, offsetC) {
        for (let r = 0; r < pattern.length; r++) {
          for (let c = 0; c < pattern[r].length; c++) {
            const row = (offsetR || 0) + r;
            const col = (offsetC || 0) + c;
            if (row >= 0 && row < caRows && col >= 0 && col < caCols) {
              caGrid[row][col] = pattern[r][c];
            }
          }
        }
      }

      const CA_PATTERNS = {
        glider: [
          [0, 1, 0],
          [0, 0, 1],
          [1, 1, 1],
        ],
        blinker: [
          [1, 1, 1],
        ],
        block: [
          [1, 1],
          [1, 1],
        ],
        gliderGun: [
          [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
          [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
          [1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
          [1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        ],
        pulsar: [
          [0,0,1,1,1,0,0,0,1,1,1,0,0],
          [0,0,0,0,0,0,0,0,0,0,0,0,0],
          [1,0,0,0,0,1,0,1,0,0,0,0,1],
          [1,0,0,0,0,1,0,1,0,0,0,0,1],
          [1,0,0,0,0,1,0,1,0,0,0,0,1],
          [0,0,1,1,1,0,0,0,1,1,1,0,0],
          [0,0,0,0,0,0,0,0,0,0,0,0,0],
          [0,0,1,1,1,0,0,0,1,1,1,0,0],
          [1,0,0,0,0,1,0,1,0,0,0,0,1],
          [1,0,0,0,0,1,0,1,0,0,0,0,1],
          [1,0,0,0,0,1,0,1,0,0,0,0,1],
          [0,0,0,0,0,0,0,0,0,0,0,0,0],
          [0,0,1,1,1,0,0,0,1,1,1,0,0],
        ],
      };

      function updateCAStats() {
        let alive = 0;
        for (let r = 0; r < caRows; r++) {
          for (let c = 0; c < caCols; c++) {
            alive += caGrid[r][c];
          }
        }
        document.getElementById('caGenDisplay').textContent = caGen;
        document.getElementById('caPopDisplay').textContent = alive;
      }

      // ---- Render CA ----
      function renderCA() {
        ctx.clearRect(0, 0, W, H);

        // Background
        const grad = ctx.createRadialGradient(460, 280, 50, 460, 280, 400);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= caRows; r++) {
          ctx.beginPath();
          ctx.moveTo(CA_OFFSET_X, CA_OFFSET_Y + r * CELL_SIZE);
          ctx.lineTo(CA_OFFSET_X + caCols * CELL_SIZE, CA_OFFSET_Y + r * CELL_SIZE);
          ctx.stroke();
        }
        for (let c = 0; c <= caCols; c++) {
          ctx.beginPath();
          ctx.moveTo(CA_OFFSET_X + c * CELL_SIZE, CA_OFFSET_Y);
          ctx.lineTo(CA_OFFSET_X + c * CELL_SIZE, CA_OFFSET_Y + caRows * CELL_SIZE);
          ctx.stroke();
        }

        // Cells
        for (let r = 0; r < caRows; r++) {
          for (let c = 0; c < caCols; c++) {
            if (caGrid[r][c] === 1) {
              const x = CA_OFFSET_X + c * CELL_SIZE + 1;
              const y = CA_OFFSET_Y + r * CELL_SIZE + 1;
              const s = CELL_SIZE - 2;

              // Glow
              ctx.beginPath();
              ctx.roundRect(x - 1, y - 1, s + 2, s + 2, 2);
              ctx.fillStyle = 'rgba(74, 222, 128, 0.3)';
              ctx.fill();

              // Cell body
              ctx.beginPath();
              ctx.roundRect(x, y, s, s, 2);
              ctx.fillStyle = '#4ade80';
              ctx.fill();

              // Inner highlight
              ctx.beginPath();
              ctx.roundRect(x + 2, y + 2, s - 4, s - 4, 1.5);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
              ctx.fill();
            }
          }
        }

        // Status overlay
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.fillRect(8, 8, 280, 44);
        ctx.fillStyle = '#b7e4c7';
        ctx.font = '11px monospace';
        let alive = 0;
        for (let r = 0; r < caRows; r++) {
          for (let c = 0; c < caCols; c++) {
            alive += caGrid[r][c];
          }
        }
        ctx.fillText(`🔲 Gen ${caGen}  ·  🟢 ${alive} alive  ·  ${caCols}×${caRows} grid`, 16, 24);
        ctx.fillText(caRunning ? '▶ Running' : '⏸ Paused — click cells to toggle', 16, 40);

        // Pattern hints at bottom
        ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.font = '10px monospace';
        ctx.fillText('Click to toggle cells · Presets above · Start/Stop to animate', 16, H - 10);
      }

      // ---- Initialise ----
      function init() {
        critters = [];
        foods = [];
        species = [];
        generation = 0;
        totalBorn = 0;
        totalDied = 0;
        totalKills = 0;
        startTime = Date.now();
        selected = [];

        for (let i = 0; i < 30; i++) {
          const t = {
            speed:      lerp(1.0, 3.5, Math.random()),
            size:       lerp(4, 9, Math.random()),
            detection:  lerp(40, 160, Math.random()),
            efficiency: lerp(0.7, 1.8, Math.random()),
          };
          critters.push(createCritter(null, null, t));
        }

        // Spawn initial predators
        for (let i = 0; i < 5; i++) {
          const t = randomTraits(null, true);
          critters.push(createCritter(null, null, t, null, true));
        }

        for (let i = 0; i < 120; i++) {
          foods.push({ x: Math.random() * W, y: Math.random() * H });
        }

        reassignSpecies();
        updateStats();
      }

      // ---- Food spawning ----
      function spawnFood(n) {
        for (let i = 0; i < n; i++) {
          foods.push({ x: Math.random() * W, y: Math.random() * H });
        }
      }

      // ---- Tick ----
      function tick() {
        if (!running) return;

        // 1. Spawn food periodically
        if (foods.length < 200 && Math.random() < 0.3) {
          foods.push({ x: Math.random() * W, y: Math.random() * H });
        }

        // 2. Update critters
        for (let i = critters.length - 1; i >= 0; i--) {
          const c = critters[i];
          c.age++;

          // Predator: hunt prey
          if (c.isPredator) {
            // Burn energy faster for predators
            c.energy -= (0.04 + c.speed * 0.04) / Math.max(c.efficiency, 0.1);

            // Find nearest prey
            let nearestPrey = null;
            let nearestPreyDist = c.detection;
            for (const prey of critters) {
              if (prey === c || prey.isPredator) continue;
              const d = dist(c, prey);
              if (d < nearestPreyDist) {
                nearestPreyDist = d;
                nearestPrey = prey;
              }
            }

            if (nearestPrey) {
              const dx = nearestPrey.x - c.x;
              const dy = nearestPrey.y - c.y;
              const d = Math.hypot(dx, dy);
              if (d > 0) {
                c.vx += (dx / d) * 0.15;
                c.vy += (dy / d) * 0.15;
              }
              // Eat prey on contact
              if (d < c.size + nearestPrey.size) {
                c.energy += 40 + nearestPrey.size * 5;
                totalKills++;
                totalDied++;
                const preyIdx = critters.indexOf(nearestPrey);
                if (preyIdx >= 0) critters.splice(preyIdx, 1);
                // Refresh index since array changed
                if (i > critters.length - 1) i = critters.length;
              }
            } else {
              // Wander
              c.retargetTimer--;
              if (c.retargetTimer <= 0) {
                c.targetX = Math.random() * W;
                c.targetY = Math.random() * H;
                c.retargetTimer = 60 + Math.floor(Math.random() * 120);
              }
              if (c.targetX !== null) {
                const dx = c.targetX - c.x;
                const dy = c.targetY - c.y;
                const d = Math.hypot(dx, dy);
                if (d > c.size) {
                  c.vx += (dx / d) * 0.05;
                  c.vy += (dy / d) * 0.05;
                }
              }
            }
          } else {
            // Prey: eat food AND flee from predators
            // Burn energy (existing)
            c.energy -= (0.02 + c.speed * 0.03) / c.efficiency;

            // Find nearest predator to flee from
            let nearestPredator = null;
            let nearestPredDist = c.detection * 1.5;
            for (const other of critters) {
              if (other === c || !other.isPredator) continue;
              const d = dist(c, other);
              if (d < nearestPredDist) {
                nearestPredDist = d;
                nearestPredator = other;
              }
            }

            // Find nearest food
            let nearest = null;
            let nearestDist = c.detection;
            for (const f of foods) {
              const d = dist(c, f);
              if (d < nearestDist) {
                nearestDist = d;
                nearest = f;
              }
            }

            // Flee from predator
            if (nearestPredator) {
              const dx = c.x - nearestPredator.x;
              const dy = c.y - nearestPredator.y;
              const d = Math.hypot(dx, dy);
              if (d > 0 && d < c.detection) {
                const fleeStrength = Math.max(0.15, 0.6 * (1 - d / c.detection));
                c.vx += (dx / d) * fleeStrength;
                c.vy += (dy / d) * fleeStrength;
              }
            }

            // Seek food (if no predator nearby or food is close)
            if (nearest && (!nearestPredator || nearestDist < nearestPredDist * 0.5)) {
              const dx = nearest.x - c.x;
              const dy = nearest.y - c.y;
              const d = Math.hypot(dx, dy);
              if (d > 0) {
                c.vx += (dx / d) * 0.1;
                c.vy += (dy / d) * 0.1;
              }
              if (d < c.size + 4) {
                c.energy += 30 * c.efficiency;
                foods.splice(foods.indexOf(nearest), 1);
              }
            } else if (!nearestPredator || nearestPredDist > c.detection) {
              // Wander when no food and no immediate threat
              c.retargetTimer--;
              if (c.retargetTimer <= 0) {
                c.targetX = Math.random() * W;
                c.targetY = Math.random() * H;
                c.retargetTimer = 60 + Math.floor(Math.random() * 120);
              }
              if (c.targetX !== null) {
                const dx = c.targetX - c.x;
                const dy = c.targetY - c.y;
                const d = Math.hypot(dx, dy);
                if (d > c.size) {
                  c.vx += (dx / d) * 0.05;
                  c.vy += (dy / d) * 0.05;
                }
              }
            }
          }

          // Clamp velocity
          const maxV = c.speed * 0.5;
          const v = Math.hypot(c.vx, c.vy);
          if (v > maxV) {
            c.vx = (c.vx / v) * maxV;
            c.vy = (c.vy / v) * maxV;
          }

          // Apply velocity with friction
          c.x += c.vx;
          c.y += c.vy;
          c.vx *= 0.95;
          c.vy *= 0.95;

          // Wrap around edges
          if (c.x < -c.size) c.x = W + c.size;
          if (c.x > W + c.size) c.x = -c.size;
          if (c.y < -c.size) c.y = H + c.size;
          if (c.y > H + c.size) c.y = -c.size;

          // Starvation
          if (c.energy <= 0) {
            totalDied++;
            critters.splice(i, 1);
          }
        }

        // 3. Reproduction — sexual with assortative mating (skipped in Galápagos mode)
        const babies = [];
        if (!galapagosMode) {
        for (const c of critters) {
          if (c.energy > 160 && critters.length + babies.length < 380) {
            // Find mate with similar traits within detection range
            const tv = getTraitVector(c);
            let bestMate = null;
            let bestMateTraitDist = 0.8;
            let bestMateDist = Infinity;
            for (const other of critters) {
              if (other === c || other.energy < 100 || other.isPredator !== c.isPredator) continue;
              const d = dist(c, other);
              if (d > c.detection) continue;
              const td = traitDist(tv, getTraitVector(other));
              if (td < bestMateTraitDist && d < bestMateDist) {
                bestMateTraitDist = td;
                bestMateDist = d;
                bestMate = other;
              }
            }
            if (bestMate) {
              // Sexual recombination
              const childTraits = recombineTraits(c, bestMate);
              const child = createCritter(
                c.x + (Math.random() - 0.5) * 20,
                c.y + (Math.random() - 0.5) * 20,
                childTraits, c
              );
              child.energy = 60;
              c.energy -= 50;
              bestMate.energy -= 40;
              totalBorn++;
              babies.push(child);
            }
          }
        }
        }
        critters.push(...babies);

        // 4. Reassign species every 10 ticks
        if (frameCount % 10 === 0) {
          reassignSpecies();
        }

        // 5. Check for extinction
        if (critters.length === 0) {
          running = false;
          document.getElementById('btnPlay').textContent = '▶ Resume';
          updateStats();
          return;
        }

        // 6. Generation counter
        frameCount++;
        if (frameCount % 300 === 0) {
          generation++;
        }

        updateStats();
      }

      // ---- Species legend ----
      function updateSpeciesLegend() {
        const el = document.getElementById('speciesLegend');
        if (species.length <= 1) {
          el.innerHTML = '<span style="color:#6b7280;font-size:0.7rem;">No distinct species yet...</span>';
          return;
        }
        el.innerHTML = species
          .sort((a, b) => b.count - a.count)
          .map(s =>
            `<span class="species-legend-item">
              <span class="species-dot" style="background:${s.color};"></span>
              Species ${s.id} (${s.count})
            </span>`
          )
          .join('');
      }

      // ---- Rendering ----
      function render() {
        if (simMode === 'ca') {
          renderCA();
          return;
        }
        ctx.clearRect(0, 0, W, H);

        const grad = ctx.createRadialGradient(460, 280, 50, 460, 280, 400);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = 'rgba(149, 213, 178, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 40) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Food
        for (const f of foods) {
          ctx.beginPath();
          ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(f.x, f.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
          ctx.fill();
        }

        // Critters
        for (const c of critters) {
          if (c.isPredator) {
            // Predator: red triangle
            const predColor = '#ef4444';
            const angle = Math.atan2(c.vy, c.vx);

            // Glow
            const glowAlpha = Math.min(0.2, (c.energy / 200) * 0.2);
            if (glowAlpha > 0.03) {
              ctx.beginPath();
              ctx.arc(c.x, c.y, c.size + 6, 0, Math.PI * 2);
              ctx.fillStyle = predColor;
              ctx.globalAlpha = glowAlpha;
              ctx.fill();
              ctx.globalAlpha = 1;
            }

            // Triangle body
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(c.size, 0);
            ctx.lineTo(-c.size * 0.6, -c.size * 0.7);
            ctx.lineTo(-c.size * 0.6, c.size * 0.7);
            ctx.closePath();
            ctx.fillStyle = predColor;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            // Energy bar
            const barW = c.size * 1.5;
            const barH = 2;
            const barY = c.y - c.size - 7;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(c.x - barW/2, barY, barW, barH);
            const pct = Math.max(0, Math.min(1, c.energy / 250));
            ctx.fillStyle = pct > 0.5 ? '#f87171' : pct > 0.25 ? '#fb923c' : '#dc2626';
            ctx.fillRect(c.x - barW/2, barY, barW * pct, barH);
          } else {
            // Prey: circle with species colour
            const color = (c.speciesId !== undefined && species[c.speciesId])
              ? species[c.speciesId].color
              : '#95d5b2';

            // Glow based on energy
            const glowSize = c.size + 4;
            const glowAlpha = Math.min(0.25, (c.energy / 200) * 0.25);
            if (glowAlpha > 0.03) {
              ctx.beginPath();
              ctx.arc(c.x, c.y, glowSize, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.globalAlpha = glowAlpha;
              ctx.fill();
              ctx.globalAlpha = 1;
            }

            // Detection range (subtle)
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.detection, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(149, 213, 178, 0.04)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Body — species colour
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Galápagos selection highlight
            if (galapagosMode && selected.includes(c)) {
              const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
              ctx.beginPath();
              ctx.arc(c.x, c.y, c.size + 4 + pulse * 3, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(167, 139, 250, ${pulse})`;
              ctx.lineWidth = 2 + pulse;
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(c.x, c.y, c.size + 2, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(167, 139, 250, ${pulse * 0.3})`;
              ctx.lineWidth = 4;
              ctx.stroke();
            }

            // Energy bar
            const barW = c.size * 1.5;
            const barH = 2;
            const barY = c.y - c.size - 5;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(c.x - barW/2, barY, barW, barH);
            const pct = Math.max(0, Math.min(1, c.energy / 200));
            ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
            ctx.fillRect(c.x - barW/2, barY, barW * pct, barH);
          }

        // Status overlay
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.fillRect(8, 8, 360, galapagosMode ? 100 : 84);
        ctx.fillStyle = '#b7e4c7';
        ctx.font = '11px monospace';
        const preyCount = critters.filter(c => !c.isPredator).length;
        const predCount = critters.filter(c => c.isPredator).length;
        ctx.fillText(`🧬 Gen ${generation}  ·  Prey ${preyCount}  ·  🐊 ${predCount}  ·  🌱 ${foods.length}`, 16, 24);
        ctx.fillText(`🐣 ${totalBorn} born  ·  💀 ${totalDied} died  ·  🗡️ ${totalKills} kills`, 16, 42);
        ctx.fillText(`🧬 Species ${species.length}  ·  🌈 ${calcDiversity().toFixed(2)}`, 16, 60);
        if (galapagosMode) {
          ctx.fillStyle = '#c4b5fd';
          ctx.fillText(`👆 Galápagos — ${selected.length}/${critters.length} selected`, 16, 78);
        }
        // Predator-prey summary
        const predPreyRatio = predCount > 0 && preyCount > 0 ? (preyCount / predCount).toFixed(1) : '—';
        ctx.fillText(`⚖️ Prey per predator: ${predPreyRatio}`, 16, galapagosMode ? 94 : 78);

        // Extinction overlay
        if (critters.length === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('☠ EXTINCTION', W/2, H/2 - 20);
          ctx.fillStyle = '#b7e4c7';
          ctx.font = '16px sans-serif';
          ctx.fillText(`Survived ${generation} generations. Press Reset.`, W/2, H/2 + 20);
          ctx.textAlign = 'left';
        }
      }
      }

      // ---- Stats helpers ----
      function avgTrait(name) {
        if (critters.length === 0) return '—';
        const sum = critters.reduce((a, c) => a + c[name], 0);
        return (sum / critters.length).toFixed(1);
      }

      function avgPredatorTrait(name) {
        const preds = critters.filter(c => c.isPredator);
        if (preds.length === 0) return '—';
        const sum = preds.reduce((a, c) => a + c[name], 0);
        return (sum / preds.length).toFixed(1);
      }

      function updateStats() {
        const predCount = critters.filter(c => c.isPredator).length;
        const preyCount = critters.length - predCount;
        document.getElementById('genDisplay').textContent = generation;
        document.getElementById('popDisplay').textContent = critters.length;
        document.getElementById('foodDisplay').textContent = foods.length;
        document.getElementById('speciesDisplay').textContent = species.length;
        document.getElementById('predatorDisplay').textContent = predCount;
        document.getElementById('statGen').textContent = generation;
        document.getElementById('statPop').textContent = critters.length;
        document.getElementById('statSpecies').textContent = species.length;
        document.getElementById('statDiversity').textContent = calcDiversity().toFixed(2);
        document.getElementById('statFood').textContent = foods.length;
        document.getElementById('statPredators').textContent = predCount;
        document.getElementById('statKills').textContent = totalKills;

        const avgSpd = avgTrait('speed');
        const avgSz = avgTrait('size');
        document.getElementById('statSpeed').textContent = avgSpd === '—' ? '—' : avgSpd;
        document.getElementById('statSize').textContent = avgSz === '—' ? '—' : avgSz;

        const predSpd = avgPredatorTrait('speed');
        const predSz = avgPredatorTrait('size');
        const predDet = avgPredatorTrait('detection');
        document.getElementById('statPredSpeed').textContent = predSpd === '—' ? '—' : predSpd;
        document.getElementById('statPredSize').textContent = predSz === '—' ? '—' : predSz;
        document.getElementById('statPredDetection').textContent = predDet === '—' ? '—' : predDet;

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('statAlive').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }

      // ---- Game loop ----
      function gameLoop(time) {
        const dt = time - lastTime;
        lastTime = time;

        if (simMode === 'ca') {
          tickAccum += dt;
          const tickInterval = TICK_RATE * (10 / (parseInt(document.getElementById('caSpeedSlider').value) || 5));
          while (tickAccum >= tickInterval) {
            caTick();
            tickAccum -= tickInterval;
          }
        } else {
          tickAccum += dt;
          const tickInterval = TICK_RATE * (10 / speed);
          while (tickAccum >= tickInterval) {
            tick();
            tickAccum -= tickInterval;
          }
        }

        render();
        requestAnimationFrame(gameLoop);
      }

      // ---- Controls ----
      document.getElementById('btnPlay').addEventListener('click', function() {
        if (critters.length === 0) return;
        running = !running;
        this.textContent = running ? '⏸ Pause' : '▶ Resume';
      });

      document.getElementById('btnReset').addEventListener('click', function() {
        running = true;
        document.getElementById('btnPlay').textContent = '⏸ Pause';
        init();
      });

      document.getElementById('btnAddFood').addEventListener('click', function() {
        spawnFood(50);
        updateStats();
      });

      document.getElementById('btnAddCritter').addEventListener('click', function() {
        if (critters.length >= 200) return;
        const t = {
          speed:      lerp(1.0, 3.5, Math.random()),
          size:       lerp(4, 9, Math.random()),
          detection:  lerp(40, 160, Math.random()),
          efficiency: lerp(0.7, 1.8, Math.random()),
        };
        critters.push(createCritter(Math.random() * W, Math.random() * H, t));
        reassignSpecies();
        updateStats();
      });

      document.getElementById('btnAddPredator').addEventListener('click', function() {
        if (critters.length >= 200) return;
        const t = randomTraits(null, true);
        critters.push(createCritter(Math.random() * W, Math.random() * H, t, null, true));
        reassignSpecies();
        updateStats();
      });

      document.getElementById('speedSlider').addEventListener('input', function() {
        speed = parseInt(this.value);
      });
      // ---- Canvas click: food placement / critter selection / CA toggle ----
      canvas.addEventListener('click', function(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = W / rect.width;
        const scaleY = H / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (simMode === 'ca') {
          // Toggle CA cell
          const col = Math.floor((x - CA_OFFSET_X) / CELL_SIZE);
          const row = Math.floor((y - CA_OFFSET_Y) / CELL_SIZE);
          if (row >= 0 && row < caRows && col >= 0 && col < caCols) {
            caGrid[row][col] = caGrid[row][col] ? 0 : 1;
            updateCAStats();
          }
          return;
        }

        if (galapagosMode) {
          // Check if click hit a critter
          let hit = null;
          let hitDist = 15;
          for (const c of critters) {
            const d = Math.hypot(c.x - x, c.y - y);
            if (d < c.size + 4 && d < hitDist) {
              hit = c;
              hitDist = d;
            }
          }
          if (hit) {
            // Toggle selection
            const idx = selected.indexOf(hit);
            if (idx >= 0) {
              selected.splice(idx, 1);
            } else {
              selected.push(hit);
            }
          } else {
            // Click on empty space → place food
            foods.push({ x, y });
          }
        } else {
          // Normal mode: place food
          foods.push({ x, y });
        }
        updateStats();
        updateGalapagosUI();
      });

      // ---- Galápagos mode toggle ----
      const btnGalapagos = document.getElementById('btnGalapagos');
      const btnNextGen = document.getElementById('btnNextGen');

      function updateGalapagosUI() {
        const display = galapagosMode ? 'flex' : 'none';
        galapagosBar.style.display = display;
        if (galapagosMode) {
          document.getElementById('selectedCount').textContent = selected.length;
          document.getElementById('totalCount').textContent = critters.length;
        }
        btnGalapagos.classList.toggle('active', galapagosMode);
        btnGalapagos.textContent = galapagosMode ? '🤖 Natural Selection' : '👆 Galápagos Mode';
      }

      btnGalapagos.addEventListener('click', function() {
        // Pause the sim when entering Galápagos mode
        if (!galapagosMode) {
          galapagosMode = true;
          selected = [];
          running = false;
          document.getElementById('btnPlay').textContent = '▶ Resume';
        } else {
          galapagosMode = false;
          selected = [];
        }
        updateGalapagosUI();
        updateStats();
      });

      // ---- Next Generation (Galápagos mode) ----
      function nextGeneration() {
        if (!galapagosMode || selected.length < 2) return;

        const babies = [];
        // Each selected critter produces 1-2 offspring with another selected critter
        const shuffled = [...selected].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length; i += 2) {
          const a = shuffled[i];
          const b = shuffled[i + 1];
          if (!b) continue;
          if (a.energy < 50 || b.energy < 50) continue;
          // Two offspring per pair
          for (let k = 0; k < 2; k++) {
            const childTraits = recombineTraits(a, b);
            const child = createCritter(
              a.x + (Math.random() - 0.5) * 20,
              a.y + (Math.random() - 0.5) * 20,
              childTraits, a
            );
            child.energy = 80;
            a.energy -= 30;
            b.energy -= 30;
            totalBorn++;
            babies.push(child);
          }
        }

        // Remove unselected critters and old selected ones
        critters = [...babies];
        selected = [];
        generation++;
        running = true;
        document.getElementById('btnPlay').textContent = '⏸ Pause';
        reassignSpecies();
        updateGalapagosUI();
        updateStats();
      }

      btnNextGen.addEventListener('click', nextGeneration);

      // ---- Keyboard shortcuts ----
      document.addEventListener('keydown', function(e) {
        // Don't trigger if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const key = e.key.toLowerCase();

        if (simMode === 'ca') {
          if (key === ' ' || key === 'space') {
            e.preventDefault();
            document.getElementById('btnCAStart').click();
          } else if (key === 'c') {
            e.preventDefault();
            document.getElementById('btnCAClear').click();
          } else if (key === 'r') {
            e.preventDefault();
            document.getElementById('btnCARandom').click();
          } else if (key === '=' || key === '+') {
            e.preventDefault();
            const s = document.getElementById('caSpeedSlider');
            s.value = Math.min(10, parseInt(s.value) + 1);
            s.dispatchEvent(new Event('input'));
          } else if (key === '-') {
            e.preventDefault();
            const s = document.getElementById('caSpeedSlider');
            s.value = Math.max(1, parseInt(s.value) - 1);
            s.dispatchEvent(new Event('input'));
          }
          return; // Don't handle evolution keys in CA mode
        }

        if (key === ' ' || key === 'space') {
          e.preventDefault();
          document.getElementById('btnPlay').click();
        } else if (key === 'r') {
          e.preventDefault();
          document.getElementById('btnReset').click();
        } else if (key === 'f') {
          e.preventDefault();
          document.getElementById('btnAddFood').click();
        } else if (key === 'p') {
          e.preventDefault();
          document.getElementById('btnAddPredator').click();
        } else if (key === '=' || key === '+') {
          e.preventDefault();
          const s = document.getElementById('speedSlider');
          s.value = Math.min(10, parseInt(s.value) + 1);
          s.dispatchEvent(new Event('input'));
        } else if (key === '-') {
          e.preventDefault();
          const s = document.getElementById('speedSlider');
          s.value = Math.max(1, parseInt(s.value) - 1);
          s.dispatchEvent(new Event('input'));
        } else if (key === 'g') {
          e.preventDefault();
          document.getElementById('btnGalapagos').click();
        } else if (key === 'n') {
          e.preventDefault();
          const next = document.getElementById('btnNextGen');
          if (next.style.display !== 'none') next.click();
        }
      });

      // ---- Mode switching ----
      function switchToEvoMode() {
        simMode = 'evolution';
        document.getElementById('evolutionControls').style.display = 'flex';
        document.getElementById('caControls').style.display = 'none';
        document.getElementById('galapagosBar').style.display = galapagosMode ? 'flex' : 'none';
        document.getElementById('statsPanel').style.display = 'grid';
        document.getElementById('tabEvolution').style.background = 'var(--frog-green, #2d6a4f)';
        document.getElementById('tabEvolution').style.color = 'white';
        document.getElementById('tabEvolution').style.fontWeight = '600';
        document.getElementById('tabCA').style.background = '#0f3460';
        document.getElementById('tabCA').style.color = '#e0e0e0';
        document.getElementById('tabCA').style.fontWeight = '500';
      }

      function switchToCAMode() {
        const wasRunning = caRunning;
        caRunning = false;
        simMode = 'ca';
        document.getElementById('evolutionControls').style.display = 'none';
        document.getElementById('galapagosBar').style.display = 'none';
        document.getElementById('caControls').style.display = 'flex';
        document.getElementById('statsPanel').style.display = 'none';
        document.getElementById('tabEvolution').style.background = '#0f3460';
        document.getElementById('tabEvolution').style.color = '#e0e0e0';
        document.getElementById('tabEvolution').style.fontWeight = '500';
        document.getElementById('tabCA').style.background = 'var(--frog-green, #2d6a4f)';
        document.getElementById('tabCA').style.color = 'white';
        document.getElementById('tabCA').style.fontWeight = '600';
        document.getElementById('btnCAStart').textContent = wasRunning ? '⏸ Pause' : '▶ Start';
        updateCAStats();
      }

      document.getElementById('tabEvolution').addEventListener('click', switchToEvoMode);
      document.getElementById('tabCA').addEventListener('click', function() {
        if (!caGrid.length || caGrid.length === 0) {
          const sel = document.getElementById('caGridSize');
          const cols = parseInt(sel.value);
          const rows = Math.floor(cols * (560 / 920));
          initCAGrid(cols, rows);
          randomCAGrid(0.3);
        }
        switchToCAMode();
      });

      // ---- CA Controls ----
      document.getElementById('btnCAStart').addEventListener('click', function() {
        caRunning = !caRunning;
        this.textContent = caRunning ? '⏸ Pause' : '▶ Start';
      });

      document.getElementById('btnCAClear').addEventListener('click', function() {
        caRunning = false;
        document.getElementById('btnCAStart').textContent = '▶ Start';
        clearCAGrid();
        updateCAStats();
      });

      document.getElementById('btnCARandom').addEventListener('click', function() {
        const sel = document.getElementById('caGridSize');
        const cols = parseInt(sel.value);
        const rows = Math.floor(cols * (560 / 920));
        initCAGrid(cols, rows);
        randomCAGrid(0.3);
        updateCAStats();
      });

      document.getElementById('btnCAGlider').addEventListener('click', function() {
        clearCAGrid();
        placeCAPattern(CA_PATTERNS.glider, Math.floor(caRows / 2) - 1, Math.floor(caCols / 2) - 1);
        updateCAStats();
      });

      document.getElementById('btnCABlinker').addEventListener('click', function() {
        clearCAGrid();
        placeCAPattern(CA_PATTERNS.blinker, Math.floor(caRows / 2), Math.floor(caCols / 2) - 1);
        updateCAStats();
      });

      document.getElementById('btnCABlock').addEventListener('click', function() {
        clearCAGrid();
        placeCAPattern(CA_PATTERNS.block, Math.floor(caRows / 2) - 1, Math.floor(caCols / 2) - 1);
        updateCAStats();
      });

      document.getElementById('btnCAGliderGun').addEventListener('click', function() {
        clearCAGrid();
        const gr = Math.floor(caRows / 2) - 4;
        const gc = Math.floor(caCols / 2) - 18;
        placeCAPattern(CA_PATTERNS.gliderGun, gr, gc);
        updateCAStats();
      });

      document.getElementById('btnCAPulsar').addEventListener('click', function() {
        clearCAGrid();
        const pr = Math.floor(caRows / 2) - 6;
        const pc = Math.floor(caCols / 2) - 6;
        placeCAPattern(CA_PATTERNS.pulsar, pr, pc);
        updateCAStats();
      });

      document.getElementById('caGridSize').addEventListener('change', function() {
        const cols = parseInt(this.value);
        const rows = Math.floor(cols * (560 / 920));
        caRunning = false;
        document.getElementById('btnCAStart').textContent = '▶ Start';
        initCAGrid(cols, rows);
        randomCAGrid(0.3);
        updateCAStats();
      });

      // ---- ----// ---- Start ----
      init();
      lastTime = performance.now();
      requestAnimationFrame(gameLoop);

      lastTime = performance.now();
      requestAnimationFrame(gameLoop);
