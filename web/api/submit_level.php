<?php
// API : soumet un niveau créé par un joueur à la campagne communautaire (is_public = 1).
header('Content-Type: application/json');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

// Accès refusé si non connecté
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

// Vérification du token CSRF
if (!csrfCheck($body['csrf_token'] ?? null)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Bad CSRF token.']);
    exit;
}

// Extraction des données du niveau à soumettre
$map      = trim($body['map'] ?? '');
$solution = trim($body['solution'] ?? '');
$moves    = (int)($body['optimal_moves'] ?? 0);
$safe     = !empty($body['ghost_safe']) ? 1 : 0;

if (strlen($map) < 20) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid level map.']);
    exit;
}

require_once __DIR__ . '/../includes/level.php';

$scoreMax = computeScoreMax($map);
if ($scoreMax === 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Level has no collectible items.']);
    exit;
}

$difficulte = computeDifficulte($moves);

$pdo    = getDB();
$userId = currentUserId();

// Anti-spam : limite de 5 soumissions par utilisateur par jour
$stmt = $pdo->prepare('
    SELECT COUNT(*) FROM niveau
    WHERE auteur_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
');
$stmt->execute([$userId]);
if ((int)$stmt->fetchColumn() >= 5) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'Daily submission limit reached (5 per day).']);
    exit;
}

try {
    // Insertion avec is_public = 1 : le niveau apparaîtra dans la campagne communautaire
    $stmt = $pdo->prepare('
        INSERT INTO niveau (difficulte, score_max, map, solution_cache, solution_safe, auteur_id, is_public)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    ');
    $stmt->execute([
        $difficulte,
        $scoreMax,
        $map,
        $solution ?: null,
        $safe,
        $userId,
    ]);
    $newId = (int)$pdo->lastInsertId();
    echo json_encode(['ok' => true, 'level_id' => $newId]);
} catch (Throwable $e) {
    error_log('submit_level: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Internal error.']);
}
