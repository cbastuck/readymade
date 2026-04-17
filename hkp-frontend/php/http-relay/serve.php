<?php
// serve.php — public endpoint. Parks until the local agent responds (up to 15 s).

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

set_time_limit(20);

$pendingDir = __DIR__ . '/pending';
if (!is_dir($pendingDir)) {
    mkdir($pendingDir, 0755, true);
}

$id = 'req_' . uniqid('', true);

// Store query params so the agent knows what was requested
file_put_contents("$pendingDir/$id.req", json_encode(['params' => $_GET]));

$deadline = microtime(true) + 15;
$resFile  = "$pendingDir/$id.res";

while (microtime(true) < $deadline) {
    // Clear PHP's stat cache so file_exists() always hits the filesystem
    clearstatcache(true, $resFile);
    if (file_exists($resFile)) {
        $body = file_get_contents($resFile);
        unlink($resFile);
        // .req was already deleted by respond.php; suppress errors if gone
        @unlink("$pendingDir/$id.req");
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo $body;
        exit;
    }
    usleep(200000); // 200 ms
}

// Timed out — agent did not respond
@unlink("$pendingDir/$id.req");
http_response_code(503);
header('Content-Type: text/plain');
echo 'Service unavailable';
