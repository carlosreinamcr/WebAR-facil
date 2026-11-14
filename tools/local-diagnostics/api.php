<?php
declare(strict_types=1);
// Recolector de desarrollo local. No almacena cámara, vídeo, poses ni mapas.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function localAddress(string $ip): bool {
    $ip = strtolower(str_replace('::ffff:', '', $ip));
    return $ip === '::1' || preg_match('/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/', $ip) === 1
        || str_starts_with($ip, 'fc') || str_starts_with($ip, 'fd') || str_starts_with($ip, 'fe80:');
}
function origin(string $url): string {
    $parts = parse_url($url);
    if (!$parts || !isset($parts['scheme'], $parts['host'])) return '';
    $scheme = strtolower($parts['scheme']);
    $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);
    return $scheme . '://' . strtolower($parts['host']) . ':' . $port;
}
function text(mixed $value, int $max = 240): string {
    if (!is_string($value)) return '';
    $value = preg_replace('~(?:https?://|file:///|data:)[^\s)]+~i', '[url]', $value) ?? '';
    $value = preg_replace('~\b[A-Z]:[\\/][^\s]+~i', '[path]', $value) ?? '';
    return mb_substr($value, 0, $max, 'UTF-8');
}
function clean(mixed $value, string $key = '', int $depth = 0, string $path = ''): mixed {
    if ($depth > 12) throw new InvalidArgumentException('Diagnóstico demasiado anidado.');
    if (is_string($value)) return text($value, $key === 'userAgent' ? 512 : 600);
    if (is_bool($value) || $value === null || is_int($value)) return $value;
    if (is_float($value)) return is_finite($value) ? $value : null;
    if (!is_array($value)) return null;
    if (array_is_list($value)) {
        // Solo estas listas forman parte del diagnóstico estadístico.
        if (!in_array($key, ['timeline', 'observations', 'recoveriesMs'], true)) return $value === [] ? new stdClass() : [];
        $limit = $key === 'timeline' ? 256 : 128;
        return array_map(fn($item) => clean($item, '', $depth + 1), array_slice($value, -$limit));
    }
    $result = [];
    foreach (array_slice($value, 0, 96, true) as $name => $item) {
        if (!is_string($name) || strlen($name) > 80) continue;
        if ($path === 'poses.backends' && $name === 'image' && is_int($item) && $item >= 0) {
            $result[$name] = $item;
            continue;
        }
        if (preg_match('/^(image|images|video|rgba|buffer|descriptors|points|matrix|matrices|map|maps|anchor|url|uri|deviceId|groupId|pixels)$/i', $name)) continue;
        $result[$name] = clean($item, $name, $depth + 1, $path === '' ? $name : $path . '.' . $name);
    }
    return $result;
}
function atomicJson(string $path, array $value): void {
    $temporary = tempnam(dirname($path), 'write_');
    if ($temporary === false) throw new RuntimeException('No se pudo preparar archivo.');
    try {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (file_put_contents($temporary, $json, LOCK_EX) === false || !rename($temporary, $path)) throw new RuntimeException('No se pudo guardar.');
    } finally { if (is_file($temporary)) unlink($temporary); }
}

try {
    if (!localAddress($_SERVER['REMOTE_ADDR'] ?? '')) reply(403, ['error' => 'Recolector disponible solo en la red local.']);
    $scheme = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http';
    $expected = origin($scheme . '://' . ($_SERVER['HTTP_HOST'] ?? ''));
    if (isset($_SERVER['HTTP_ORIGIN']) && origin($_SERVER['HTTP_ORIGIN']) !== $expected) reply(403, ['error' => 'Origen no permitido.']);
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') reply(403, ['error' => 'Origen no permitido.']);
    $config = require __DIR__ . '/config.php';
    $action = $_GET['action'] ?? 'list';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $files = array_values(array_filter(scandir(dirname(__DIR__) . '/Examples') ?: [], fn($name) => preg_match('/^(0[1-9]|1[0-9]|2[0-8])-[a-z0-9-]+\.html$/', $name)));
    if (is_file(dirname(__DIR__) . '/Examples/slam-comparison.html')) $files[] = 'slam-comparison.html';
    if ($action === 'config' && $method === 'GET') reply(200, ['token' => $config['token'], 'examples' => $files, 'intervalMs' => 15000, 'serverTime' => gmdate('c')]);

    $directory = $config['storage'];
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Almacenamiento no disponible.');
    $lock = fopen($directory . '/.lock', 'c');
    if (!$lock) throw new RuntimeException('Almacenamiento no disponible.');
    $indexPath = $directory . '/index.json';
    if ($method === 'GET' && $action === 'list') {
        flock($lock, LOCK_SH);
        $index = is_file($indexPath) ? json_decode(file_get_contents($indexPath), true, 32, JSON_THROW_ON_ERROR) : [];
        flock($lock, LOCK_UN); fclose($lock);
        $rows = array_values($index);
        usort($rows, fn($a, $b) => strcmp($b['startedAt'] ?? $b['receivedAt'], $a['startedAt'] ?? $a['receivedAt']) ?: strcmp($b['receivedAt'], $a['receivedAt']));
        reply(200, ['reports' => $rows, 'examples' => $files, 'serverTime' => gmdate('c')]);
    }
    if ($method === 'GET' && $action === 'report') {
        $id = $_GET['id'] ?? '';
        if (!preg_match('/^[a-f0-9]{64}$/', $id)) reply(400, ['error' => 'ID inválido.']);
        flock($lock, LOCK_SH);
        $path = $directory . '/' . $id . '.json';
        $body = is_file($path) ? file_get_contents($path) : null;
        flock($lock, LOCK_UN); fclose($lock);
        if ($body === null) reply(404, ['error' => 'Informe no encontrado.']);
        if (isset($_GET['download'])) header('Content-Disposition: attachment; filename="webar-' . substr($id, 0, 16) . '.json"');
        echo $body; exit;
    }
    if ($method !== 'POST' || $action !== 'report') reply(405, ['error' => 'Método no permitido.']);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 262144) reply(413, ['error' => 'Informe demasiado grande.']);
    $raw = file_get_contents('php://input', false, null, 0, 262145);
    if ($raw === false || strlen($raw) > 262144) reply(413, ['error' => 'Informe demasiado grande.']);
    $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($input) || !is_string($input['token'] ?? null) || !hash_equals($config['token'], $input['token'])) reply(403, ['error' => 'Token de instalación inválido.']);
    $client = $input['client'] ?? []; $report = $input['report'] ?? [];
    $clientId = $client['id'] ?? ''; $run = $input['runId'] ?? ''; $example = $input['example'] ?? '';
    if (!is_string($clientId) || !preg_match('/^[a-z0-9-]{8,64}$/i', $clientId) || !is_string($run) || !preg_match('/^[a-z0-9-]{8,64}$/i', $run) || !in_array($example, $files, true)) reply(400, ['error' => 'Sesión o ejemplo inválido.']);
    $sequence = $input['sequence'] ?? null;
    if (!is_int($sequence) || $sequence < 1 || $sequence > 1000000000) reply(400, ['error' => 'Secuencia inválida.']);
    if (!is_array($report) || ($report['kind'] ?? '') !== 'webar-diagnostics' || ($report['schemaVersion'] ?? 0) !== 1) reply(400, ['error' => 'Se espera un diagnóstico WebAR.']);
    $allowed = ['schemaVersion','kind','sdk','createdAt','durationMs','recording','context','configuration','environment','camera','state','targets','poses','quality','metrics','tracking','odometry','renderer','timeline','observations','limits','metricScale'];
    $report = clean(array_intersect_key($report, array_flip($allowed)));
    $id = hash('sha256', $clientId . '|' . $run);
    flock($lock, LOCK_EX);
    $index = is_file($indexPath) ? json_decode(file_get_contents($indexPath), true, 32, JSON_THROW_ON_ERROR) : [];
    if (isset($index[$id]) && $index[$id]['sequence'] >= $sequence) {
        flock($lock, LOCK_UN); fclose($lock); reply(200, ['ok' => true, 'id' => $id, 'accepted' => false]);
    }
    if (!isset($index[$id]) && count($index) >= 2000) reply(507, ['error' => 'Se alcanzó el límite local de 2000 sesiones. Conserva o archiva los informes antes de continuar.']);
    $received = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    $client = ['id' => $clientId, 'label' => text($client['label'] ?? '', 80), 'platform' => text($client['platform'] ?? '', 32)];
    $envelope = ['kind' => 'webar-local-report', 'schemaVersion' => 1, 'id' => $id, 'receivedAt' => $received, 'runId' => $run, 'sequence' => $sequence, 'example' => $example, 'client' => $client, 'reason' => text($input['reason'] ?? '', 32), 'report' => $report];
    atomicJson($directory . '/' . $id . '.json', $envelope);
    $index[$id] = [
        'id' => $id, 'receivedAt' => $received, 'startedAt' => $report['createdAt'] ?? $received, 'sequence' => $sequence, 'client' => $client, 'example' => $example,
        'reason' => $envelope['reason'], 'sdk' => $report['sdk'] ?? [], 'state' => $report['state'] ?? '',
        'recording' => $report['recording'] ?? false, 'durationMs' => $report['durationMs'] ?? 0,
        'poses' => $report['poses']['count'] ?? 0, 'backends' => $report['poses']['backends'] ?? [],
        'processingP95' => $report['metrics']['processingMs']['p95'] ?? null,
        'readbackP95' => $report['metrics']['readbackMs']['p95'] ?? null,
        'firstPoseMs' => $report['poses']['firstPoseMs'] ?? null,
        'performance' => $report['configuration']['performance'] ?? '',
        'mode' => $report['configuration']['mode'] ?? '',
        'errors' => count(array_filter($report['timeline'] ?? [], fn($event) => is_array($event) && ($event['event'] ?? '') === 'error')),
        'execution' => $report['context']['execution'] ?? 'unspecified',
    ];
    atomicJson($indexPath, $index);
    flock($lock, LOCK_UN); fclose($lock);
    reply(200, ['ok' => true, 'id' => $id, 'accepted' => true, 'receivedAt' => $received]);
} catch (JsonException | InvalidArgumentException $error) {
    reply(400, ['error' => 'JSON o diagnóstico inválido.']);
} catch (Throwable $error) {
    error_log('WebAR local reports: ' . $error->getMessage());
    reply(500, ['error' => 'No se pudo acceder al almacenamiento local del servidor.']);
}
