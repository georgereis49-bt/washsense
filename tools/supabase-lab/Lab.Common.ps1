Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-LabManifest([string] $Path) {
    $m = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($m.schemaVersion -ne 1 -or $m.projectId -ne 'washsense-security-lab-318') {
        throw 'Unsupported manifest or unexpected laboratory identity.'
    }
    if ($m.network.dockerProjectLabel -ne 'com.supabase.cli.project') { throw 'Unexpected Docker project label.' }
    if ($m.versions.postgresMajor -ne 17) { throw 'PostgreSQL 17 required.' }
    foreach ($address in @($m.network.apiUrl, $m.auth.siteUrl) + @($m.auth.redirectUrls)) {
        $uri = [uri]$address
        if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'http' -or
            $uri.Host -notin @('127.0.0.1', '[::1]', '::1') -or
            $uri.UserInfo -or $uri.Query -or $uri.Fragment) { throw 'Non-local URL rejected.' }
    }
    if (([uri]$m.network.apiUrl).Port -ne 54321) { throw 'Unexpected API port.' }
    if (@($m.network.bindAddresses | Where-Object { $_ -notin @('127.0.0.1','::1') }).Count) {
        throw 'Non-loopback binding rejected.'
    }
    if (($m.network.ports -join ',') -ne '54321,54322,54323,54324') { throw 'Unexpected port inventory.' }
    if ($m.auth.externalProviders -or $m.auth.externalHooks -or -not $m.auth.localMailOnly -or
        -not $m.auth.emailConfirmation -or -not $m.structuralPackage.metadataOnly) {
        throw 'Unsafe Auth or package contract.'
    }
    if ($m.approvals.executeSecurityProposal) { throw 'Security SQL execution is outside this stage.' }
    return $m
}

function Assert-NoRemoteCredentials([string] $Root) {
    # Presence only: never read or print values or token files.
    $names = @(Get-ChildItem Env: | Where-Object {
        $_.Name -match '^(SUPABASE|ASAAS|DATABASE_URL|DB_URL|PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE|PGSERVICE|PGOPTIONS|DOCKER_HOST|DOCKER_CONTEXT)'
    } | ForEach-Object { $_.Name })
    if ($names.Count) { throw 'Potential remote/service environment bindings detected; use a clean laboratory session.' }
    foreach ($f in @("$HOME/.supabase/access-token", "$HOME/.config/supabase/access-token")) {
        if (Test-Path -LiteralPath $f) { throw 'Stored Supabase credentials detected; use an isolated OS account/profile.' }
    }
    if (Test-Path -LiteralPath $Root) {
        $unsafe = @(Get-ChildItem -LiteralPath $Root -Recurse -Force | Where-Object {
            ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            $_.Name -like '.env*' -or $_.Name -in @('project-ref','access-token')
        })
        if ($unsafe.Count) { throw 'Environment/link files or reparse points found in laboratory.' }
    }
}

function Assert-ReviewedFile([string] $Root, [string] $Name, [string] $Hash) {
    if ($Name -notmatch '^[a-zA-Z0-9._-]+$' -or $Hash -notmatch '^[a-fA-F0-9]{64}$') {
        throw 'Reviewed filename/hash missing or unsafe.'
    }
    $path = Join-Path $Root $Name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or
        (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $Hash) {
        throw 'Reviewed artifact absent or hash mismatch.'
    }
}

function Get-LocalDockerServer {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker not installed.' }
    # Inspect context metadata before any daemon call; do not contact TCP/SSH endpoints.
    $raw = & docker context inspect --format '{{json .Endpoints.docker.Host}}' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Docker context inspection failed.' }
    $endpoint = $raw | ConvertFrom-Json
    if ($endpoint -notin @('npipe:////./pipe/docker_engine','npipe:////./pipe/dockerDesktopLinuxEngine')) {
        throw 'Only local Windows Docker named pipes are allowed.'
    }
    $raw = & docker info --format '{{json .}}' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Docker daemon unavailable.' }
    $info = $raw | ConvertFrom-Json
    if ($info.OSType -ne 'linux') { throw 'Docker Linux containers required.' }
    return $info
}
