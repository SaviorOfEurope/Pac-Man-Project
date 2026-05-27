<?php
/**
 * POST api/delete_level.php
 *
 * Delete a personal level owned by the logged-in user.
 *
 * Body (JSON): { csrf_token: string, id: int }
 * Response:    { ok: true } | { ok: false, error: string }
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

$levelId = (int)($body['id'] ?? 0);
if ($levelId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid level ID.']);
    exit;
}

$pdo    = getDB();
$userId = currentUserId();

try {
    // Only delete levels owned by this user (auteur_id = userId)
    $stmt = $pdo->prepare('DELETE FROM niveau WHERE id = ? AND auteur_id = ?');
    $stmt->execute([$levelId, $userId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Level not found or not yours.']);
        exit;
    }

    echo json_encode(['ok' => true]);

} catch (Throwable $e) {
    error_log('delete_level: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Internal error.']);
}
