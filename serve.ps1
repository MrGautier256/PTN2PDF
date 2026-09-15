param(
  [int]$Port = 5500
)

$root = $PSScriptRoot
$prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Impossible de demarrer le serveur sur le port $Port ($_)."
  Write-Host "Le port est peut-etre deja utilise par une autre instance de PTN2PDF."
  Start-Sleep -Seconds 5
  exit 1
}

Write-Host "PTN2PDF sert les fichiers depuis $root"
Write-Host "Ouvre $prefix dans ton navigateur (Ctrl+C ici pour arreter le serveur)."

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript"
  ".mjs"  = "application/javascript"
  ".css"  = "text/css"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
  ".json" = "application/json"
  ".wasm" = "application/wasm"
  ".gz"   = "application/gzip"
  ".traineddata" = "application/octet-stream"
}

while ($listener.IsListening) {
  $context = $null
  try {
    $context = $listener.GetContext()
  } catch {
    break
  }

  $request = $context.Request
  $response = $context.Response
  try {
    $localPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }

    $filePath = Join-Path $root $localPath
    $fullRoot = (Resolve-Path $root).Path
    $isInsideRoot = $false
    if (Test-Path $filePath -PathType Leaf) {
      $fullFilePath = (Resolve-Path $filePath).Path
      $isInsideRoot = $fullFilePath.StartsWith($fullRoot, [StringComparison]::OrdinalIgnoreCase)
    }

    if ($isInsideRoot) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $contentType = $mimeTypes[$ext]
      if (-not $contentType) { $contentType = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
      $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
    }
  } catch {
    $response.StatusCode = 500
  } finally {
    $response.OutputStream.Close()
  }
}
