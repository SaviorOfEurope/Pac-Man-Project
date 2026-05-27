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
let lastMap    = null;
let lastResult = null;

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

// ── Preview (canvas — same render logic as game.js) ──────────────────────────

const PREVIEW_CELL = 36; // px per tile  (game uses 40; we scale to 36 for fit)

const GHOST_SPRITE = {
    red:    'img/fantomeRougeImmobile.png',
    green:  'img/fantomeVertImmobile.png',
    yellow: 'img/fantomeJauneImmobile.png',
    blue:   'img/fantomeBleuImmobile.png',
};

/** Mirrors game._drawWall / game._drawTile onto a preview canvas. */
function _drawPreviewTile(ctx, g, r, c, rows, cols) {
    const S  = PREVIEW_CELL;
    const BD = Math.max(2, Math.round(S / 14)); // border depth ≈ 2-3 px
    const x  = c * S, y = r * S;
    const ch = g[r][c];

    if (ch === '#') {
        // Wall — matches game._drawWall
        ctx.fillStyle = '#27446B';
        ctx.fillRect(x, y, S, S);
        ctx.fillStyle = '#3a5f8c';          // highlight top
        ctx.fillRect(x, y, S, BD);
        ctx.fillRect(x, y, BD, S);          // highlight left
        ctx.fillStyle = '#162c4a';           // shadow bottom
        ctx.fillRect(x, y + S - BD, S, BD);
        ctx.fillRect(x + S - BD, y, BD, S); // shadow right
        // Gold seam where wall meets a walkable neighbour
        ctx.fillStyle = '#E0B95A';
        if (r > 0      && g[r - 1][c] !== '#') ctx.fillRect(x,         y,         S, 2);
        if (r < rows-1 && g[r + 1][c] !== '#') ctx.fillRect(x,         y + S - 2, S, 2);
        if (c > 0      && g[r][c - 1] !== '#') ctx.fillRect(x,         y,         2, S);
        if (c < cols-1 && g[r][c + 1] !== '#') ctx.fillRect(x + S - 2, y,         2, S);
        return;
    }

    // Floor base — matches game._drawTile
    ctx.fillStyle = '#0a1a3a';
    ctx.fillRect(x, y, S, S);
    ctx.fillStyle = 'rgba(39,68,107,0.35)';
    ctx.fillRect(x + 1, y + 1, S - 2, S - 2);

    const cx = x + S / 2, cy = y + S / 2;

    if (ch === '.') {
        // Coin / gem — matches game._drawCoin (static, no time-based wobble)
        const gw = Math.round(S * 0.20);
        const gh = Math.round(S * 0.38);
        ctx.shadowColor = 'rgba(224,185,90,0.65)';
        ctx.shadowBlur  = 6;
        ctx.fillStyle = '#8B603F';
        ctx.fillRect(cx - gw,     cy - gh / 2 - 1, gw * 2,     gh + 2);
        ctx.fillStyle = '#E0B95A';
        ctx.fillRect(cx - gw + 1, cy - gh / 2,     gw * 2 - 2, gh);
        ctx.shadowBlur  = 0;
        ctx.fillStyle = '#8B603F';
        ctx.fillRect(cx - 1,      cy - gh / 2 + 2, 2,           gh - 4);
        ctx.fillStyle = '#fff3c4';
        ctx.fillRect(cx - gw + 2, cy - gh / 2 + 1, 2,           2);

    } else if (ch === '*') {
        // Portal — matches game._drawPortal (static)
        const rad = S * 0.30;
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
        grad.addColorStop(0,   'rgba(91,61,145,0.85)');
        grad.addColorStop(0.6, 'rgba(91,61,145,0.25)');
        grad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'rgba(102,230,255,0.9)';
        ctx.shadowBlur  = 8;
        ctx.strokeStyle = '#66E6FF';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

function renderPreview(text) {
    const el = document.getElementById('genPreview');
    const { meta: m, grid: g } = parseLevelText(text);
    const rows = g.length;
    const cols = g[0].length;
    const S    = PREVIEW_CELL;

    const canvas = document.createElement('canvas');
    canvas.width  = cols * S;
    canvas.height = rows * S;
    canvas.className = 'gen-canvas';

    const ctx = canvas.getContext('2d');

    // Background (same as game: #001440)
    ctx.fillStyle = '#001440';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pass 1 — draw all tiles (synchronous)
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            _drawPreviewTile(ctx, g, r, c, rows, cols);

    // Pass 2 — overlay sprites (async, drawn when images load)
    const pad = Math.round(S * 0.05);
    function blitSprite(src, col, row) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, col * S + pad, row * S + pad, S - pad * 2, S - pad * 2);
        img.src = src;
    }
    if (m.start) blitSprite('img/chevalier1.png', m.start.col, m.start.row);
    for (const [color, pos] of Object.entries(m.ghosts || {})) {
        if (GHOST_SPRITE[color]) blitSprite(GHOST_SPRITE[color], pos.col, pos.row);
    }

    const wrap = document.createElement('div');
    wrap.className = 'gen-grid-wrap';
    wrap.appendChild(canvas);
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
    document.getElementById('saveGenBtn').disabled = true;
    lastMap    = null;
    lastResult = null;
    document.getElementById('genPreview').innerHTML = '';
    const saveResultEl = document.getElementById('genSaveResult');
    if (saveResultEl) { saveResultEl.textContent = ''; saveResultEl.className = 'validation-result'; }

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
            lastResult = result;
            playBtn.disabled = false;
            document.getElementById('saveGenBtn').disabled = false;
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

// ── Save generated level to My Levels ────────────────────────────────────────

async function saveGenLevel() {
    if (!lastMap || !lastResult) return;

    const name = prompt('Name for this level:', PROFILES[currentDiff].label + ' Random');
    if (name === null) return; // cancelled

    const btn = document.getElementById('saveGenBtn');
    const resultEl = document.getElementById('genSaveResult');
    btn.disabled = true;
    btn.textContent = 'SAVING…';
    if (resultEl) { resultEl.textContent = ''; resultEl.className = 'validation-result'; }

    try {
        const resp = await fetch('api/save_level.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                csrf_token:    window.CSRF_TOKEN,
                name:          name.trim() || 'Random Level',
                map:           lastMap,
                solution:      lastResult.moves ? lastResult.moves.join('') : '',
                optimal_moves: lastResult.moves ? lastResult.moves.length : 0,
                ghost_safe:    !lastResult.fallback,
            }),
        });
        const data = await resp.json();

        if (data.ok) {
            btn.textContent = 'SAVED ✓';
            if (resultEl) {
                resultEl.innerHTML = '✓ Saved as "' + (name || 'Random Level') + '" · <a href="my_levels.php">View My Levels</a>';
                resultEl.className = 'validation-result ok';
            }
        } else {
            btn.textContent = 'SAVE TO MY LEVELS';
            btn.disabled = false;
            if (resultEl) {
                resultEl.textContent = data.error || 'Save failed.';
                resultEl.className = 'validation-result err';
            }
        }
    } catch (err) {
        btn.textContent = 'SAVE TO MY LEVELS';
        btn.disabled = false;
        if (resultEl) {
            resultEl.textContent = 'Network error: ' + err.message;
            resultEl.className = 'validation-result err';
        }
    }
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('generateBtn').addEventListener('click', generate);
    document.getElementById('playBtn').addEventListener('click', play);
    document.getElementById('saveGenBtn').addEventListener('click', saveGenLevel);

    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDiff = btn.dataset.diff;
            document.getElementById('diffDesc').textContent = PROFILES[currentDiff].desc;
            lastMap    = null;
            lastResult = null;
            document.getElementById('playBtn').disabled = true;
            document.getElementById('saveGenBtn').disabled = true;
            document.getElementById('genPreview').innerHTML = '';
            setStatus('');
        });
    });

    document.getElementById('diffDesc').textContent = PROFILES[currentDiff].desc;
    setStatus('Choose a difficulty then click "Generate".');
});

})();
