$ErrorActionPreference = 'Stop'

$repoZip = 'https://github.com/syouziroupc/kimivsgpt/archive/refs/heads/main.zip'
$pluginName = 'kimi-vs-gpt-auditor'
$homeDir = [Environment]::GetFolderPath('UserProfile')
$pluginDir = Join-Path $homeDir ".codex\plugins\$pluginName"
$marketplaceDir = Join-Path $homeDir '.agents\plugins'
$marketplaceFile = Join-Path $marketplaceDir 'marketplace.json'
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("kimivsgpt-install-" + [guid]::NewGuid().ToString('N'))
$zipPath = Join-Path $tempRoot 'repo.zip'
$extractPath = Join-Path $tempRoot 'repo'

Write-Host 'Installing Kimi vs GPT Answer Auditor local plugin...'

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $pluginDir -Parent) | Out-Null
New-Item -ItemType Directory -Force -Path $marketplaceDir | Out-Null

try {
    Invoke-WebRequest -Uri $repoZip -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

    $sourcePlugin = Join-Path $extractPath 'kimivsgpt-main\plugin'
    if (-not (Test-Path (Join-Path $sourcePlugin '.codex-plugin\plugin.json'))) {
        throw "Downloaded plugin manifest was not found at $sourcePlugin"
    }

    if (Test-Path $pluginDir) {
        Remove-Item -Recurse -Force $pluginDir
    }
    Copy-Item -Recurse -Force $sourcePlugin $pluginDir

    $entry = [pscustomobject]@{
        name = $pluginName
        source = [pscustomobject]@{
            source = 'local'
            path = "./.codex/plugins/$pluginName"
        }
        policy = [pscustomobject]@{
            installation = 'AVAILABLE'
            authentication = 'ON_INSTALL'
        }
        category = 'Productivity'
    }

    if (Test-Path $marketplaceFile) {
        $raw = Get-Content -Raw -Path $marketplaceFile
        $marketplace = $raw | ConvertFrom-Json
        if ($null -eq $marketplace.plugins) {
            $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue @()
        }
        $remaining = @($marketplace.plugins | Where-Object { $_.name -ne $pluginName })
        $marketplace.plugins = @($remaining + $entry)
    }
    else {
        $marketplace = [pscustomobject]@{
            name = 'personal-plugins'
            interface = [pscustomobject]@{ displayName = 'Personal Plugins' }
            plugins = @($entry)
        }
    }

    $marketplace | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 -Path $marketplaceFile

    Write-Host ''
    Write-Host 'Installed successfully.'
    Write-Host "Plugin:      $pluginDir"
    Write-Host "Marketplace: $marketplaceFile"
    Write-Host ''
    Write-Host 'Next: fully quit and restart the ChatGPT desktop app, then open Plugins and look for Personal Plugins / Kimi vs GPT Answer Auditor.'
    Write-Host 'If the external MCP server is not available on this ChatGPT surface, the bundled skill will fall back to an internal counter-check and will not falsely claim that an external review occurred.'
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
    }
}
