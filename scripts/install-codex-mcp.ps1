$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$codexDir = Join-Path $env:USERPROFILE ".codex"
$configPath = Join-Path $codexDir "config.toml"
New-Item -ItemType Directory -Force -Path $codexDir | Out-Null
if (-not (Test-Path -LiteralPath $configPath)) {
  New-Item -ItemType File -Path $configPath -Force | Out-Null
}

$content = Get-Content -LiteralPath $configPath -Raw
$begin = "# BEGIN KIMIVSGPT MCP"
$end = "# END KIMIVSGPT MCP"
$block = @"
$begin
[mcp_servers.kimivsgpt]
url = "https://kimivsgpt.syouziroupc.workers.dev/mcp"
auth = "oauth"
required = false
enabled_tools = ["review_strategy"]
default_tools_approval_mode = "approve"
tool_timeout_sec = 45
$end
"@

if ($content.Contains($begin)) {
  $pattern = [regex]::Escape($begin) + "[\s\S]*?" + [regex]::Escape($end)
  $content = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $block }, 1)
} elseif ($content -match '(?m)^\[mcp_servers\.kimivsgpt\]\s*$') {
  throw "An unmanaged [mcp_servers.kimivsgpt] section already exists in $configPath. Let Codex merge it instead of creating a duplicate TOML table."
} else {
  if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) { $content += "`r`n" }
  $content += "`r`n$block`r`n"
}

Set-Content -LiteralPath $configPath -Value $content -Encoding UTF8 -NoNewline
Write-Host "Configured shared Codex/ChatGPT Desktop MCP server in: $configPath"
Write-Host "Next: codex mcp login kimivsgpt"

if (Get-Command codex -ErrorAction SilentlyContinue) {
  Write-Host "Current MCP list:"
  & codex mcp list
}
