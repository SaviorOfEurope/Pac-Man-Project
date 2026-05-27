<?php
/**
 * POST api/save_level.php
 *
 * Save (INSERT) or update (UPDATE) a personal level owned by the logged-in user.
 * Personal levels are stored with is_public=0 so they don't appear in the campaign.
 *
 * Body (JSON):
 *   csrf_token    string   required
 *   name          string   display name (max 100 chars)
 *   map           string   level map text
 *   solution      string   optimal move string (U/D/L/R…)
 *   optimal_moves int
 *   ghost_safe    bool
 *   id            int      optional — if >0, update that existing level instead of insert
 *
 * Response (JSON): { ok: true, level_id: int, updated: bool }
 *                  { ok: false, error: string }
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Not authenticated.']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Bad JSON.']);
    exit;
}

if (!csrfCheck($body['csrf_token'] ?? null)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Bad CSRF token.']);
    exit;
}

$levelId  = isset($body['id']) && (int)$body['id'] > 0 ? (int)$body['id'] : 0;
$name     = trim($body['name'] ?? '');
$map      = trim($body['map'] ?? '');
$solution = trim($body['solution'] ?? '');
$safe     = !empty($body['ghost_safe']) ? 1 : 0;
$moves    = (int)($body['optimal_moves'] ?? 0);

if ($name === '') $name = 'Sans titre';
if (mb_strlen($name) > 100) $name = mb_substr($name, 0, 100);

if (strlen($map) < 20) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid level map.']);
    exit;
}

// Score / difficulty (same logic as submit_level.php)
$scoreMax = substr_count($map, '.') * 10
          + substr_count($map, 'o') * 50
          + substr_count($map, 'c') * 30;

$difficulte = 1;
if      ($moves >= 40) $difficulte = 5;
elseif  ($moves >= 25) $difficulte = 4;
elseif  ($moves >= 15) $difficulte = 3;
elseif  ($moves >= 8)  $difficulte = 2;

$pdo    = getDB();
$userId = currentUserId();

try {
    if ($levelId > 0) {
        // ── UPDATE — verify ownership ──────────────────────────────────────
        $chk = $pdo->prepare('SELECT id FROM niveau WHERE id = ? AND auteur_id = ?');
        $chk->execute([$levelId, $userId]);
        if (!$chk->fetch()) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Level not found or not yours.']);
            exit;
        }

        $stmt = $pdo->prepare('
            UPDATE niveau
               SET name=?, map=?, solution_cache=?, solution_safe=?,
                   score_max=?, difficulte=?
             WHERE id=? AND auteur_id=?
        ');
        $stmt->execute([
            $name, $map, $solution ?: null, $safe,
            $scoreMax, $difficulte,
            $levelId, $userId,
        ]);
        echo json_encode(['ok' => true, 'level_id' => $levelId, 'updated' => true]);

    } else {
        // ── INSERT — check per-user limit ──────────────────────────────────
        $cnt = $pdo->prepare('SELECT COUNT(*) FROM niveau WHERE auteur_id = ?');
        $cnt->execute([$userId]);
        if ((int)$cnt->fetchColumn() >= 20) {
            http_response_code(429);
            echo json_encode([
                'ok'    => false,
                'error' => 'Personal level limit reached (20 max). Delete some first.',
            ]);
            exit;
        }

        $stmt = $pdo->prepare('
            INSERT INTO niveau
                (name, difficulte, score_max, map, solution_cache, solution_safe, auteur_id, is_public)
            VALUES (?,?,?,?,?,?,?,0)
        ');
        $stmt->execute([
            $name, $difficulte, $scoreMax,
            $map, $solution ?: null, $safe, $userId,
        ]);
        echo json_encode(['ok' => true, 'level_id' => (int)$pdo->lastInsertId(), 'updated' => false]);
    }

} catch (Throwable $e) {
    error_log('save_level: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Internal error.']);
}
