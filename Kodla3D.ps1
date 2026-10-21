param(
    [ValidateSet('setup','start','stop','status','diagnose')]
    [string]$Action = 'start',
    [ValidateRange(1024,65535)]
    [int]$Port = 8765,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$runtime = Join-Path $PSScriptRoot '.runtime'
$pidName = if ($Port -eq 8765) { 'server.pid' } else { "server-$Port.pid" }
$pidFile = Join-Path $runtime $pidName
$serverFile = Join-Path $PSScriptRoot 'server.mjs'
$baseUrl = "http://127.0.0.1:$Port"

function Get-ExpectedRootId {
    $normalized = [IO.Path]::GetFullPath($PSScriptRoot).ToLowerInvariant()
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($normalized)
        $hex = -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
        return $hex.Substring(0,16)
    } finally { $sha.Dispose() }
}

function Get-Health {
    try { return Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 2 }
    catch { return $null }
}

function Get-ManagedProcess([int]$ProcessId) {
    try { $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" }
    catch { return $null }
    if (-not $process -or -not $process.CommandLine) { return $null }
    if ($process.Name -notmatch '^node(\.exe)?$') { return $null }
    if ($process.CommandLine.IndexOf($serverFile,[StringComparison]::OrdinalIgnoreCase) -lt 0) { return $null }
    return $process
}

function Show-Diagnose {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    Write-Output "Proje: $PSScriptRoot"
    Write-Output "Port: $Port (yalnız 127.0.0.1)"
    if ($nodeCommand) { Write-Output "Node: $(& node --version)" } else { Write-Output 'Node: bulunamadı' }
    if ($npmCommand) { Write-Output "npm: $(& npm.cmd --version)" } else { Write-Output 'npm: bulunamadı' }
    $health = Get-Health
    if (-not $health) { Write-Output 'Sunucu: çalışmıyor veya health yanıtı alınamadı'; return }
    Write-Output "Sunucu: $($health.engine) $($health.version)"
    Write-Output "Server Node: $($health.nodeVersion)"
    Write-Output "Kurulum kimliği: $($health.rootId)"
    Write-Output "Bağımlılıklar: $($health.dependencies | ConvertTo-Json -Compress)"
    if ($health.rootId -eq (Get-ExpectedRootId)) { Write-Output 'Proje eşleşmesi: bu klasör' }
    else { Write-Output 'Proje eşleşmesi: başka bir Kodla 3D kopyası; bu script bu sunucuyu yönetmeyecek' }
}

if ($Action -eq 'setup') {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Node.js 22.12+ veya 24.x kur. Kurulum Git istemez.' }
    $nodeVersion = (& node -p "JSON.stringify(process.versions.node.split('.').map(Number))" | ConvertFrom-Json)
    $supported = ($nodeVersion[0] -eq 22 -and $nodeVersion[1] -ge 12) -or $nodeVersion[0] -eq 24
    if (-not $supported) { throw "Node $(& node --version) desteklenmiyor. Node 22.12+ veya 24.x kullan." }
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Kilitli npm bağımlılıkları kurulamadı.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Arayüz derlenemedi.' }
    Write-Output 'Kurulum hazır. vendor/ kaynak kopyaları ve kullanıcı çıktıları korunuyor; aktif uygulama CadQuery kullanmıyor.'
    exit 0
}

if ($Action -eq 'diagnose') { Show-Diagnose; exit 0 }

$health = Get-Health
$expectedRootId = Get-ExpectedRootId

if ($Action -eq 'status') {
    if (-not $health) { Write-Output "Sunucu çalışmıyor: $baseUrl"; exit 1 }
    if ($health.rootId -ne $expectedRootId) { Write-Output "Bu portta başka bir Kodla 3D kurulumu var: $($health.rootId)"; exit 2 }
    Write-Output "Çalışıyor: Kodla 3D $($health.version) · Node $($health.nodeVersion) · $baseUrl"
    if (Test-Path -LiteralPath $pidFile) {
        $savedPid = 0
        if ([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(),[ref]$savedPid) -and (Get-ManagedProcess $savedPid)) { Write-Output "Yönetilen PID: $savedPid" }
        else { Write-Output 'PID kaydı eski veya eşleşmiyor; süreç yönetilmiyor.' }
    } else { Write-Output 'PID bu kontrol aracı tarafından başlatılmamış.' }
    exit 0
}

if ($Action -eq 'stop') {
    if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'Bu port için yönetilen PID yok; hiçbir süreç kapatılmadı.'; exit 1 }
    $savedPid = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(),[ref]$savedPid)) { throw 'PID kaydı okunamadı; hiçbir süreç kapatılmadı.' }
    $process = Get-ManagedProcess $savedPid
    if (-not $process) { Remove-Item -LiteralPath $pidFile -Force; Write-Output 'PID artık bu projeye ait değil; süreç korunup eski kayıt temizlendi.'; exit 0 }
    Stop-Process -Id $savedPid -Force
    for ($i=0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 150; if (-not (Get-ManagedProcess $savedPid)) { break } }
    if (Get-ManagedProcess $savedPid) { throw "PID $savedPid kapanmadı." }
    Remove-Item -LiteralPath $pidFile -Force
    Write-Output "Kodla 3D sunucusu durduruldu (PID $savedPid)."
    exit 0
}

if ($health) {
    if ($health.rootId -ne $expectedRootId) { throw "Port $Port başka bir Kodla 3D kurulumuna ait. Bu sunucuya dokunulmadı. -Port ile boş bir port seç." }
    Write-Output "Kodla 3D zaten çalışıyor: $baseUrl"
    if (-not $NoBrowser) { Start-Process $baseUrl }
    exit 0
}

$node = Get-Command node -ErrorAction Stop
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist\index.html'))) { throw 'Önce Kodla3D.cmd setup çalıştır.' }
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$stdout = Join-Path $runtime "server-$Port.log"
$stderr = Join-Path $runtime "server-$Port-error.log"
$previousPort = $env:KODLA3D_PORT
$env:KODLA3D_PORT = [string]$Port
try { $process = Start-Process -FilePath $node.Source -ArgumentList @('"' + $serverFile + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr }
finally { $env:KODLA3D_PORT = $previousPort }
$process.Id | Set-Content -LiteralPath $pidFile -Encoding ascii
$ready = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 250
    $health = Get-Health
    if ($health -and $health.rootId -eq $expectedRootId) { $ready = $true; break }
}
if (-not $ready) {
    $managed = Get-ManagedProcess $process.Id
    if ($managed) { Stop-Process -Id $process.Id -Force }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    throw "Sunucu başlamadı veya başka bir proje kimliği döndürdü. Kayıt: $stderr"
}
Write-Output "Kodla 3D hazır: $baseUrl (PID $($process.Id))"
if (-not $NoBrowser) { Start-Process $baseUrl }
