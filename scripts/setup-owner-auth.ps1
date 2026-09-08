param(
  [string]$WorkerName = "kimivsgpt"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required. Install Node.js 22+ and retry."
}
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw "npx is required. Install npm/Node.js and retry."
}

Write-Host "Checking Cloudflare authentication..."
& npx wrangler@4.129.1 whoami | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host "Cloudflare login is required. Opening Wrangler login..."
  & npx wrangler@4.129.1 login
  if ($LASTEXITCODE -ne 0) { throw "Wrangler login failed." }
}

$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$secret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
[Array]::Clear($bytes, 0, $bytes.Length)

$secure = ConvertTo-SecureString $secret -AsPlainText -Force
$encrypted = ConvertFrom-SecureString $secure
$secretDir = Join-Path $env:LOCALAPPDATA "KimiVsGPT"
$secretPath = Join-Path $secretDir "owner-secret.dpapi"
New-Item -ItemType Directory -Force -Path $secretDir | Out-Null
Set-Content -LiteralPath $secretPath -Value $encrypted -Encoding UTF8 -NoNewline

try {
  Write-Host "Setting OWNER_AUTH_SECRET in Cloudflare Worker..."
  $secret | & npx wrangler@4.129.1 secret put OWNER_AUTH_SECRET --name $WorkerName
  if ($LASTEXITCODE -ne 0) { throw "wrangler secret put failed." }
} catch {
  Remove-Item -LiteralPath $secretPath -Force -ErrorAction SilentlyContinue
  throw
} finally {
  $secret = $null
  $secure = $null
  $encrypted = $null
  [GC]::Collect()
}

$healthUrl = "https://kimivsgpt.syouziroupc.workers.dev/health"
$ok = $false
for ($i = 0; $i -lt 10; $i++) {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 15
    if ($health.oauth.owner_secret_configured -eq $true -and $health.oauth.pkce -eq "S256") {
      $ok = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  throw "Cloudflare secret was submitted, but /health did not confirm owner OAuth yet. Do not delete the local DPAPI file; inspect the Worker deployment."
}

Write-Host "Owner OAuth is configured."
Write-Host "The owner secret is NOT printed. It is stored DPAPI-encrypted for the current Windows user at:"
Write-Host $secretPath
Write-Host "Use scripts/copy-owner-secret.ps1 only immediately before OAuth login."
