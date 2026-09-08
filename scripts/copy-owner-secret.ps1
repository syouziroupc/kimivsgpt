$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$secretPath = Join-Path (Join-Path $env:LOCALAPPDATA "KimiVsGPT") "owner-secret.dpapi"
if (-not (Test-Path -LiteralPath $secretPath)) {
  throw "Owner secret not enrolled on this Windows user. Run scripts/setup-owner-auth.ps1 first."
}

$encrypted = Get-Content -LiteralPath $secretPath -Raw
$secure = ConvertTo-SecureString $encrypted
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  Set-Clipboard -Value $plain
  Write-Host "Owner passphrase copied to clipboard. Paste it only into the Kimi vs GPT OAuth page, then clear the clipboard."
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $plain = $null
  $secure = $null
  $encrypted = $null
}
