<?php
// poll.php — called by the local Meander agent every ~500 ms.
// Returns JSON {"id": "...", "params": {...}} for the oldest pending request,
// or empty string if none.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/auth.php';

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$pendingDir = __DIR__ . '/pending';
if (!is_dir($pendingDir)) {
    echo '';
    exit;
}

// Clean up stale .req files older than 30 s
foreach (glob("$pendingDir/*.req") as $f) {
    if (filemtime($f) < time() - 30) {
        @unlink($f);
    }
}

$files = glob("$pendingDir/*.req");
if (!$files) {
    echo '';
    exit;
}

// Oldest first
usort($files, fn($a, $b) => filemtime($a) - filemtime($b));

$id      = basename($files[0], '.req');
$content = json_decode(file_get_contents($files[0]), true);
$params  = isset($content['params']) ? $content['params'] : [];

echo json_encode(['id' => $id, 'params' => $params]);
