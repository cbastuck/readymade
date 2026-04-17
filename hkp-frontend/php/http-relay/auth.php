<?php
// auth.php — shared auth helper. Include before sending any response body.
// If AUTH_TOKEN is defined in config.php and the request carries a non-matching
// Bearer token, this script sends a 401 and exits.
//
// To enable auth, create config.php next to this file with:
//   <?php define('AUTH_TOKEN', 'your-secret-token');

$configFile = __DIR__ . '/config.php';
if (file_exists($configFile)) {
    require_once $configFile;
}

if (defined('AUTH_TOKEN') && AUTH_TOKEN !== '') {
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
    // Some SAPI configurations use REDIRECT_HTTP_AUTHORIZATION
    if (!$authHeader && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    $expected = 'Bearer ' . AUTH_TOKEN;
    if ($authHeader !== $expected) {
        http_response_code(401);
        header('Content-Type: text/plain');
        echo 'Unauthorized';
        exit;
    }
}
