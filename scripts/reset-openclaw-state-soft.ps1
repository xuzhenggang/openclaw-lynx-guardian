<# 
Soft-reset local OpenClaw/Lynx runtime state by archiving, not deleting.

Default behavior:
- Stops the OpenClaw gateway container if it is running.
- Moves lynx.db, lynx.db-wal, and lynx.db-shm into a timestamped archive.
- Rewrites known session stores to keep agent:main:main and cron sessions.
- Moves all other session files, including orphaned jsonl files, into the timestamped archive.
- Starts the gateway again only if this script stopped it.

Examples:
  powershell -ExecutionPolicy Bypass -File .\notes\reset-openclaw-state-soft.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File .\notes\reset-openclaw-state-soft.ps1
  powershell -ExecutionPolicy Bypass -File .\notes\reset-openclaw-state-soft.ps1 -SkipDatabaseReset -DropCronSessions -KeepExtraSessions 0
  powershell -ExecutionPolicy Bypass -File .\notes\reset-openclaw-state-soft.ps1 -DropCronSessions -KeepExtraSessions 1
  powershell -ExecutionPolicy Bypass -File .\notes\reset-openclaw-state-soft.ps1 -DropCronSessions -KeepExtraSessions 0

Restore idea:
- Stop the gateway.
- Move files back from the printed ArchiveRoot to their original locations.
- Restore sessions.json from sessions.json.bak.
- Start the gateway.
#>

[CmdletBinding()]
param(
  [int]$KeepExtraSessions = 0,
  [switch]$DropCronSessions,
  [switch]$SkipDatabaseReset,
  [switch]$SkipGatewayRestart,
  [string]$GatewayContainer = "openclaw-openclaw-gateway-1",
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[soft-reset] $Message"
}

function Ensure-Directory {
  param([string]$Path)
  if ($DryRun) {
    Write-Step "DRY RUN mkdir $Path"
    return
  }
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Move-FileToArchive {
  param(
    [string]$SourcePath,
    [string]$ArchiveDir
  )

  if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
    return $false
  }

  $destination = Join-Path $ArchiveDir (Split-Path -Path $SourcePath -Leaf)
  if ($DryRun) {
    Write-Step "DRY RUN move $SourcePath -> $destination"
  } else {
    Move-Item -LiteralPath $SourcePath -Destination $destination
  }
  return $true
}

function Get-SessionFileLeaf {
  param(
    [object]$SessionFile,
    [object]$SessionId
  )

  $sessionFileText = [string]$SessionFile
  if ([string]::IsNullOrWhiteSpace($sessionFileText)) {
    return "$SessionId.jsonl"
  }

  $normalized = $sessionFileText -replace "\\", "/"
  $parts = $normalized -split "/"
  return $parts[$parts.Count - 1]
}

function Get-UpdatedAtValue {
  param([object]$Value)

  if ($null -eq $Value.updatedAt) {
    return [int64]0
  }
  return [int64]$Value.updatedAt
}

function Get-MainSessionEntry {
  param([string]$SessionDir)

  $sessionIndexPath = Join-Path $SessionDir "sessions.json"
  if (-not (Test-Path -LiteralPath $sessionIndexPath -PathType Leaf)) {
    return $null
  }

  try {
    $sessionIndex = Get-Content -LiteralPath $sessionIndexPath -Raw | ConvertFrom-Json
    $mainProperty = $sessionIndex.PSObject.Properties["agent:main:main"]
    if ($null -eq $mainProperty) {
      return $null
    }
    return $mainProperty.Value
  } catch {
    return $null
  }
}

function Reset-SessionStore {
  param(
    [string]$SessionDir,
    [string]$ArchiveDir,
    [int]$ExtraSessionCount,
    [bool]$ShouldDropCronSessions,
    [object]$FallbackMainEntry
  )

  $summary = [ordered]@{
    sessionDir = $SessionDir
    found = $false
    parseStatus = "missing"
    entriesBefore = 0
    entriesAfter = 0
    filesArchived = 0
    keptSessionFiles = @()
  }

  $sessionIndexPath = Join-Path $SessionDir "sessions.json"
  if (-not (Test-Path -LiteralPath $sessionIndexPath -PathType Leaf)) {
    Write-Step "No sessions.json found under $SessionDir"
    return $summary
  }

  $summary.found = $true
  Ensure-Directory -Path $ArchiveDir

  try {
    $sessionIndex = Get-Content -LiteralPath $sessionIndexPath -Raw | ConvertFrom-Json
    $summary.parseStatus = "ok"
    $entries = @($sessionIndex.PSObject.Properties | ForEach-Object {
      $value = $_.Value
      [pscustomobject]@{
        Key = $_.Name
        Value = $value
        File = Get-SessionFileLeaf -SessionFile $value.sessionFile -SessionId $value.sessionId
        UpdatedAt = Get-UpdatedAtValue -Value $value
        IsMain = $_.Name -eq "agent:main:main"
        IsCron = $_.Name -like "agent:main:cron:*"
      }
    })
  } catch {
    if ($null -eq $FallbackMainEntry) {
      throw "Refusing to continue: $sessionIndexPath is not valid JSON and no fallback agent:main:main entry is available."
    }

    $summary.parseStatus = "invalid_json_rebuilt_from_fallback_main"
    Write-Step "Invalid sessions.json found at $sessionIndexPath; it will be backed up and rebuilt with fallback agent:main:main."
    $entries = @([pscustomobject]@{
      Key = "agent:main:main"
      Value = $FallbackMainEntry
      File = Get-SessionFileLeaf -SessionFile $FallbackMainEntry.sessionFile -SessionId $FallbackMainEntry.sessionId
      UpdatedAt = Get-UpdatedAtValue -Value $FallbackMainEntry
      IsMain = $true
      IsCron = $false
    })
  }

  $summary.entriesBefore = $entries.Count
  $mainEntries = @($entries | Where-Object { $_.IsMain })
  if ($mainEntries.Count -eq 0) {
    throw "Refusing to continue: agent:main:main was not found in $sessionIndexPath."
  }

  $extraEntries = @($entries |
    Where-Object { -not $_.IsMain -and -not $_.IsCron } |
    Sort-Object UpdatedAt -Descending |
    Select-Object -First $ExtraSessionCount)

  $seedEntries = @($mainEntries + $extraEntries)
  if (-not $ShouldDropCronSessions) {
    $seedEntries = @($seedEntries + @($entries | Where-Object { $_.IsCron }))
  }

  $keptSessionFiles = @($seedEntries.File | Sort-Object -Unique)
  $keepKeys = @{}
  foreach ($entry in $entries) {
    if ($entry.IsMain -or ($keptSessionFiles -contains $entry.File)) {
      $keepKeys[$entry.Key] = $true
    }
  }

  $newIndex = [ordered]@{}
  foreach ($entry in $entries) {
    if ($keepKeys.ContainsKey($entry.Key)) {
      $newIndex[$entry.Key] = $entry.Value
    }
  }
  $summary.entriesAfter = $newIndex.Count
  $summary.keptSessionFiles = $keptSessionFiles

  $sessionIndexBackupPath = Join-Path $ArchiveDir "sessions.json.bak"
  if ($DryRun) {
    Write-Step "DRY RUN copy $sessionIndexPath -> $sessionIndexBackupPath"
    Write-Step "DRY RUN rewrite $sessionIndexPath entries $($summary.entriesBefore) -> $($summary.entriesAfter)"
  } else {
    Copy-Item -LiteralPath $sessionIndexPath -Destination $sessionIndexBackupPath
    $newIndex | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $sessionIndexPath -Encoding UTF8
  }

  $sessionFiles = @(Get-ChildItem -LiteralPath $SessionDir -File | Where-Object { $_.Name -ne "sessions.json" })
  foreach ($file in $sessionFiles) {
    if ($keptSessionFiles -contains $file.Name) {
      continue
    }
    if (Move-FileToArchive -SourcePath $file.FullName -ArchiveDir $ArchiveDir) {
      $summary.filesArchived++
    }
  }

  return $summary
}

function Get-GatewayRunning {
  param([string]$ContainerName)

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    return $false
  }

  $running = & docker inspect -f '{{.State.Running}}' $ContainerName 2>$null
  if ($LASTEXITCODE -ne 0) {
    return $false
  }
  return ([string]$running).Trim() -eq "true"
}

function Stop-GatewayIfNeeded {
  param([string]$ContainerName)

  if ($SkipGatewayRestart) {
    Write-Step "Skipping gateway stop/start because -SkipGatewayRestart was supplied."
    return $false
  }

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Step "Docker was not found. Continuing without gateway stop/start."
    return $false
  }

  if (-not (Get-GatewayRunning -ContainerName $ContainerName)) {
    Write-Step "Gateway container is not running or was not found: $ContainerName"
    return $false
  }

  if ($DryRun) {
    Write-Step "DRY RUN docker stop $ContainerName"
  } else {
    Write-Step "Stopping gateway container: $ContainerName"
    & docker stop $ContainerName | Out-Null
  }
  return $true
}

function Start-GatewayIfNeeded {
  param(
    [string]$ContainerName,
    [bool]$WasStoppedByScript
  )

  if (-not $WasStoppedByScript) {
    return
  }

  if ($DryRun) {
    Write-Step "DRY RUN docker start $ContainerName"
    return
  }

  Write-Step "Starting gateway container: $ContainerName"
  & docker start $ContainerName | Out-Null
}

if ($KeepExtraSessions -lt 0) {
  throw "-KeepExtraSessions must be 0 or greater."
}

if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
  throw "USERPROFILE is not set."
}

$openclawHome = Join-Path $env:USERPROFILE ".openclaw"
$dbDir = Join-Path $openclawHome "lynx\data"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveRoot = Join-Path $openclawHome "archives\soft-reset-$stamp"
$dbArchiveDir = Join-Path $archiveRoot "lynx-data"
$sessionStores = @(
  [pscustomobject]@{
    Name = "docker-state"
    Path = Join-Path $openclawHome "docker-state\agents\main\sessions"
    ArchiveDir = Join-Path $archiveRoot "sessions-docker-state"
  },
  [pscustomobject]@{
    Name = "legacy"
    Path = Join-Path $openclawHome "agents\main\sessions"
    ArchiveDir = Join-Path $archiveRoot "sessions-legacy"
  }
)

Write-Step "ArchiveRoot: $archiveRoot"
Write-Step "KeepExtraSessions: $KeepExtraSessions"
Write-Step "DropCronSessions: $([bool]$DropCronSessions)"
Write-Step "SkipDatabaseReset: $([bool]$SkipDatabaseReset)"
Write-Step "DryRun: $([bool]$DryRun)"

$gatewayWasStopped = Stop-GatewayIfNeeded -ContainerName $GatewayContainer

try {
  $archivedDatabaseFiles = 0
  if ($SkipDatabaseReset) {
    Write-Step "Skipping SQLite database reset because -SkipDatabaseReset was supplied."
  } else {
    Ensure-Directory -Path $dbArchiveDir

    foreach ($dbFileName in @("lynx.db", "lynx.db-wal", "lynx.db-shm")) {
      $sourcePath = Join-Path $dbDir $dbFileName
      if (Move-FileToArchive -SourcePath $sourcePath -ArchiveDir $dbArchiveDir) {
        $archivedDatabaseFiles++
      }
    }

    if ($archivedDatabaseFiles -eq 0) {
      Write-Step "No SQLite database files were found under $dbDir"
    }
  }

  $sessionStoreSummaries = @()
  $fallbackMainEntry = Get-MainSessionEntry -SessionDir $sessionStores[0].Path
  foreach ($store in $sessionStores) {
    Write-Step "Processing session store '$($store.Name)': $($store.Path)"
    $sessionStoreSummaries += Reset-SessionStore `
      -SessionDir $store.Path `
      -ArchiveDir $store.ArchiveDir `
      -ExtraSessionCount $KeepExtraSessions `
      -ShouldDropCronSessions ([bool]$DropCronSessions) `
      -FallbackMainEntry $fallbackMainEntry
  }

  $summary = [ordered]@{
    archiveRoot = $archiveRoot
    databaseFilesArchived = $archivedDatabaseFiles
    sessionStores = $sessionStoreSummaries
  }

  Write-Step "Summary:"
  $summary | ConvertTo-Json -Depth 5
} finally {
  Start-GatewayIfNeeded -ContainerName $GatewayContainer -WasStoppedByScript $gatewayWasStopped
}
