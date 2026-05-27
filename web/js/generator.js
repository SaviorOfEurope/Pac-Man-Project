/**
 * Template-based level generator — 3 difficulty levels, solver-verified.
 *
 * Approach: structural blueprints (fixed wall layout) + random gem placement.
 * This guarantees connected corridors and fast solver convergence.
 * allowFallback:true means a gems-only solution is accepted when no ghost-safe
 * path exists — this dramatically improves generation success rate.
 */
(() => {
'use strict';

const { serializeLevel, validateLevelStructure, parseLevelText } = window.LevelUtils;
const STORAGE_KEY = 'ombrequatre_play_map';

// ── Structural blueprints ────────────────────────────────────────────────────
// Pure wall/floor patterns. '_' = floor (gems placed here randomly).
// No gems or ghosts — those are added dynamically.

const BLUEPRINTS = {
    easy: [
        // E1: 11x7 — simple parallel rails
        ['###########',
         '#_________#',
         '#_###_###_#',
         '#_________#',
         '#_###_###_#',
         '#_________#',
         '###########'],
        // E2: 13x7 — wide open rails
        ['#############',
         '#___________#',
         '#_###___###_#',
         '#___________#',
         '#_###___###_#',
         '#___________#',
         '#############'],
        // E3: 11x9 — grid pillars
        ['###########',
         '#_________#',
         '#_#_#_#_#_#',
         '#_________#',
         '#_#___#___#',
         '#_________#',
         '#_#_#_#_#_#',
         '#_________#',
         '###########'],
        // E4: 13x9 — cross-room light
        ['#############',
         '#___________#',
         '#_###_###_#_#',
         '#___________#',
         '#_###___###_#',
         '#___________#',
         '#_###_###_#_#',
         '#___________#',
         '#############'],
    ],
    medium: [
        // M1: 13x9 — campaign style (like level 5)
        ['#############',
         '#___________#',
         '#_###_###_#_#',
         '#___________#',
         '#_###___###_#',
         '#___________#',
         '#_###_###_#_#',
         '#___________#',
         '#############'],
        // M2: 13x11 — extended cross
        ['#############',
         '#___________#',
         '#_###_###_#_#',
         '#___________#',
         '#_###___###_#',
         '#___________#',
         '#_###___###_#',
         '#___________#',
         '#_###_###_#_#',
         '#___________#',
         '#############'],
        // M3: 15x9 — wide channel
        ['###############',
         '#_____________#',
         '#_###_###_###_#',
         '#_____________#',
         '#_###_____###_#',
         '#_____________#',
         '#_###_###_###_#',
         '#_____________#',
         '###############'],
        // M4: 11x11 — tall narrow
        ['###########',
         '#_________#',
         '#_###_###_#',
         '#_________#',
         '#_###___#_#',
         '#_________#',
         '#_#___###_#',
         '#_________#',
         '#_###_###_#',
         '#_________#',
         '###########'],
    ],
    hard: [
        // H1: 15x11 — campaign style (like level 7)
        ['###############',
         '#_____________#',
         '#_###_###_#_#_#',
         '#_____________#',
         '#_#_###___###_#',
         '#_____________#',
         '#_#_###___###_#',
         '#_____________#',
         '#_###_###_#_#_#',
         '#_____________#',
         '###############'],
        // H2: 15x13 — large labyrinth
        ['###############',
         '#_____________#',
         '#_###_###_#_#_#',
         '#_____________#',
         '#_#_###___###_#',
         '#_____________#',
         '#_____________#',
         '#_#_###___###_#',
         '#_____________#',
         '#_###_###_#_#_#',
         '#_____________#',
         '#_____________#',
         '###############'],
        // H3: 13x13 — tall medium
        ['#############',
         '#___________#',
         '#_###_###_#_#',
         '#___________#',
         '#_#_###_#___#',
         '#___________#',
         '#___________#',
         '#_#_#___#___#',
         '#___________#',
         '#_###_###_#_#',
         '#___________#',
         '#___________#',
         '#############'],
        // H4: 15x11 — complex grid
        ['###############',
         '#_____________#',
         '#_#_###_###_#_#',
         '#_____________#',
         '#_#___#___#___#',
         '#_____________#',
         '#_###_#___###_#',
         '#_____________#',
         '#_#___###_#___#',
         '#_____________#',
         '###############'],
    ],
};

// ── Difficulty profiles ──────────────────────────────────────────────────────

const PROFILES = {
    easy: {
        label: 'EASY',
        minGems: 8,  maxGems: 14,
        minMoves: 1, maxMoves: 60,
        ghosts: [],
        maxAttempts: 40,
        desc: 'No ghosts · 8-14 gems · short path',
    },
    medium: {
        label: 'MEDIUM',
        minGems: 14, maxGems: 22,
        minMoves: 1, maxMoves: 80,
        ghosts: ['red'],
        maxAttempts: 40,
        desc: '1 red ghost · 14-22 gems · moderate path',
    },
    hard: {
        label: 'HARD',
        minGems: 18, maxGems: 28,
        minMoves: 1, maxMoves: 100,
        ghosts: ['red', 'green'],
        maxAttempts: 40,
        desc: '2 ghosts · 18-28 gems · long path',
    },
};

let currentDiff = 'medium';
let lastMap = null;

// ── Utilities ────────────────────────────────────────────────────────────────

function randInt(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function manhattan(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

// ── Level builder ────────────────────────────────────────────────────────────

function tryBuildLevel(diff) {
    const profile = PROFILES[diff];
    const bps = BLUEPRINTS[diff];
    const bp = bps[randInt(0, bps.length - 1)];

    // Parse blueprint into a mutable grid
    const grid = bp.map(row => row.split(''));
    const h = grid.length;
    const w = grid[0].length;

    // Collect all floor cells
    const floors = [];
    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            if (grid[r][c] === '_') floors.push([r, c]);
        }
    }

    const needed = profile.minGems + profile.ghosts.length + 1;
    if (floors.length < needed) return null;

    shuffle(floors);

    // Knight start = first floor cell
    const [sr, sc] = floors[0];
    const usedKeys = new Set([sr + ',' + sc]);

    // Place gems
    const gemCount = randInt(
        profile.minGems,
        Math.min(profile.maxGems, floors.length - profile.ghosts.length - 1)
    );
    let placed = 0;
    for (const [r, c] of floors) {
        if (placed >= gemCount) break;
        const key = r + ',' + c;
        if (usedKeys.has(key)) continue;
        grid[r][c] = '.';
        usedKeys.add(key);
        placed++;
    }
    if (placed < profile.minGems) return null;

    // Build meta
    const meta = {
        width: w, height: h,
        start: { row: sr, col: sc },
        ghosts: {},
    };

    // Place ghosts on floor cells far from start
    const freeFloors = floors
        .filter(([r, c]) => !usedKeys.has(r + ',' + c))
        .sort((a, b) => manhattan(b, [sr, sc]) - manhattan(a, [sr, sc]));

    for (let i = 0; i < profile.ghosts.length && i < freeFloors.length; i++) {
        const [r, c] = freeFloors[i];
        meta.ghosts[profile.ghosts[i]] = { row: r, col: c };
    }

    const text = serializeLevel(meta, grid);
    if (!validateLevelStructure(meta, grid).ok) return null;

    return { text, gemCount: placed, ghosts: Object.keys(meta.ghosts).length };
}

// ── Preview ──────────────────────────────────────────────────────────────────

const GHOST_LABELS = { red: 'R', green: 'G', yellow: 'Y', blue: 'B' };

function renderPreview(text) {
    const el = document.getElementById('genPreview');
    const { meta: m, grid: g } = parseLevelText(text);
    const h = g.length;
    const w = g[0].length;

    const wrap = document.createElement('div');
    wrap.className = 'gen-grid-wrap';

    const gridEl = document.createElement('div');
    gridEl.className = 'gen-grid';
    gridEl.style.gridTemplateColumns = `repeat(${w}, 20px)`;

    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            const ch = g[r][c];
            const cell = document.createElement('div');
            cell.className = 'gc';

            const isKnight = m.start && m.start.row === r && m.start.col === c;
            const ghostEntry = Object.entries(m.ghosts || {}).find(([, p]) => p.row === r && p.col === c);

            if (ch === '#') {
                cell.classList.add('gc-wall');
            } else if (isKnight) {
                cell.classList.add('gc-floor', 'gc-knight');
                cell.textContent = '♞'; // ♞
            } else if (ghostEntry) {
                const [color] = ghostEntry;
                cell.classList.add('gc-floor', 'gc-ghost', 'gc-ghost-' + color);
                cell.textContent = GHOST_LABELS[color] || '?';
            } else if (ch === '.') {
                cell.classList.add('gc-floor', 'gc-gem');
                cell.textContent = '★'; // ★
            } else if (ch === '*') {
                cell.classList.add('gc-floor', 'gc-portal');
                cell.textContent = '◎'; // ◎
            } else {
                cell.classList.add('gc-floor');
            }

            gridEl.appendChild(cell);
        }
    }

    wrap.appendChild(gridEl);
    el.innerHTML = '';
    el.appendChild(wrap);
}

// ── Status ───────────────────────────────────────────────────────────────────

function setStatus(msg, err) {
    const el = document.getElementById('genStatus');
    el.textContent = msg;
    el.className = 'editor-status' + (err ? ' err' : (msg ? ' ok' : ''));
}

// ── Generate ─────────────────────────────────────────────────────────────────

async function generate() {
    const diff = currentDiff;
    const profile = PROFILES[diff];
    const btn = document.getElementById('generateBtn');
    const playBtn = document.getElementById('playBtn');
    btn.disabled = true;
    playBtn.disabled = true;
    lastMap = null;
    document.getElementById('genPreview').innerHTML = '';

    const hideParade = window.SolverBridge.showParade(
        document.getElementById('solverOverlay'),
        profile.label + ' — generating maze…'
    );

    await new Promise(r => setTimeout(r, 40));

    for (let attempt = 1; attempt <= profile.maxAttempts; attempt++) {
        const candidate = tryBuildLevel(diff);
        if (!candidate) continue;

        const progressEl = document.querySelector('#paradeProgress');
        if (progressEl) progressEl.textContent = 'Attempt ' + attempt + ' / ' + profile.maxAttempts;

        try {
            const result = await window.OmbrequatreEngine.solveViaC(candidate.text, {
                requireSafe:   candidate.ghosts > 0,
                allowFallback: true,
            });

            if (!result.found) continue;
            const moves = result.moves.length;
            if (moves < profile.minMoves || moves > profile.maxMoves) continue;

            hideParade();
            lastMap = candidate.text;
            renderPreview(candidate.text);

            const ghostNote = candidate.ghosts > 0
                ? ', ' + candidate.ghosts + ' ghost(s)' + (result.fallback ? ' ⚠ gems-only' : '')
                : '';
            setStatus(profile.label + ' — ' + candidate.gemCount + ' gems' + ghostNote + ', ' + moves + ' optimal moves (attempt ' + attempt + ').');
            playBtn.disabled = false;
            btn.disabled = false;
            return;
        } catch (_) { /* retry */ }
    }

    hideParade();
    setStatus('Could not generate a valid level — click Generate again.', true);
    btn.disabled = false;
}

// ── Play ─────────────────────────────────────────────────────────────────────

function play() {
    if (!lastMap) return;
    sessionStorage.setItem(STORAGE_KEY, lastMap);
    window.location.href = 'game.php?mode=generated';
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('generateBtn').addEventListener('click', generate);
    document.getElementById('playBtn').addEventListener('click', play);

    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDiff = btn.dataset.diff;
            document.getElementById('diffDesc').textContent = PROFILES[currentDiff].desc;
            lastMap = null;
            document.getElementById('playBtn').disabled = true;
            document.getElementById('genPreview').innerHTML = '';
            setStatus('');
        });
    });

    document.getElementById('diffDesc').textContent = PROFILES[currentDiff].desc;
    setStatus('Choose a difficulty then click "Generate".');
});

})();
