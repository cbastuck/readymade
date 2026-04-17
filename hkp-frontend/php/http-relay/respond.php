<?php
// respond.php — called by the local Meander agent with the JSON payload.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/auth.php';

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$pendingDir = __DIR__ . '/pending';

$id = isset($_GET['id']) ? $_GET['id'] : '';

// Validate: only allow characters produced by uniqid()
if (!preg_match('/^req_[0-9a-f.]+$/', $id)) {
    http_response_code(400);
    echo 'bad id';
    exit;
}

$reqFile = "$pendingDir/$id.req";
$resFile = "$pendingDir/$id.res";

if (!file_exists($reqFile)) {
    // Already handled or timed out
    http_response_code(404);
    echo 'not found';
    exit;
}

$body = file_get_contents('php://input');
file_put_contents($resFile, $body);

// Delete .req immediately so poll.php never returns this ID again,
// even if serve.php is still in its polling loop or has already timed out.
@unlink($reqFile);

echo 'ok';
