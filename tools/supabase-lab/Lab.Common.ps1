Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-LabManifest([string] $Path) {
    if ($Path -match '^(\\\\|//|[a-zA-Z]+://)') { throw 'Remote manifest path rejected.' }
    $localPath = [IO.Path]::GetFullPath($Path)
    if ($IsWindows) {
        $driveName = [IO.Path]::GetPathRoot($localPath).TrimEnd('\', ':')
        $drive = Get-PSDrive -Name $driveName -PSProvider FileSystem -ErrorAction Stop
        if ($drive.DisplayRoot -match '^(\\\\|//)' -or $drive.Root -match '^(\\\\|//)') {
            throw 'Network-mapped manifest drive rejected.'
        }
    }
    Assert-NoReparsePath $localPath
    try { $m = Get-Content -LiteralPath $localPath -Raw | ConvertFrom-Json }
    catch { throw 'Manifest unreadable or invalid JSON.' }
    if ($m.schemaVersion -ne 1 -or $m.projectId -ne 'washsense-security-lab-318') {
        throw 'Unsupported manifest or unexpected laboratory identity.'
    }
    foreach ($flag in @($m.auth.externalProviders, $m.auth.externalHooks,
        $m.auth.localMailOnly, $m.auth.emailConfirmation, $m.structuralPackage.metadataOnly,
        $m.structuralPackage.reviewApproved, $m.configuration.reviewApproved,
        $m.network.egressPolicyApproved, $m.approvals.startStack,
        $m.approvals.runSyntheticTests, $m.approvals.executeSecurityProposal,
        $m.isolation.cleanOsProfileReviewed, $m.isolation.credentialStoreReviewApproved)) {
        if ($flag -isnot [bool]) { throw 'Manifest approval/safety flags must be JSON booleans.' }
    }
    if ($m.purpose -ne 'synthetic-security-validation-only' -or
        $m.productionProjectRefForbidden -ne 'eydrrfuzfcxcqdivvued' -or
        $m.structuralPackage.file -ne 'structure.sql.pending' -or
        $m.configuration.file -ne 'config.toml') { throw 'Laboratory contract changed.' }
    if ([version]$m.versions.powerShellMinimum -lt [version]'7.4.6') { throw 'PowerShell minimum cannot be lowered.' }
    if (-not @($m.network.bindAddresses).Count -or -not @($m.auth.redirectUrls).Count) { throw 'Empty network/Auth allowlist.' }
    foreach ($port in $m.network.ports) {
        if ($port -isnot [long] -and $port -isnot [int]) { throw 'Ports must be JSON integers.' }
    }
    if ($m.network.dockerProjectLabel -ne 'com.supabase.cli.project') { throw 'Unexpected Docker project label.' }
    if ($m.versions.postgresMajor -ne 17) { throw 'PostgreSQL 17 required.' }
    foreach ($address in @($m.network.apiUrl, $m.auth.siteUrl) + @($m.auth.redirectUrls)) {
        $uri = [uri]$address
        if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'http' -or
            $uri.Host -notin @('127.0.0.1', '[::1]', '::1') -or
            $uri.UserInfo -or $uri.Query -or $uri.Fragment) { throw 'Non-local URL rejected.' }
    }
    if (([uri]$m.network.apiUrl).Port -ne 54321 -or ([uri]$m.network.apiUrl).AbsolutePath -ne '/') { throw 'Unexpected API port.' }
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

function Assert-NoReparsePath([string] $Path) {
    # Check root AND ancestors before recursion or artifact access.
    $ancestors = [Collections.Generic.List[IO.DirectoryInfo]]::new()
    $directory = [IO.DirectoryInfo]$Path
    while ($directory) {
        $ancestors.Add($directory)
        $directory = $directory.Parent
    }
    # Traverse top-down: do not probe a descendant through a junction first.
    for ($i=$ancestors.Count-1; $i -ge 0; $i--) {
        try { $item = Get-Item -LiteralPath $ancestors[$i].FullName -Force -ErrorAction Stop }
        catch {
            if ($_.CategoryInfo.Category -ne 'ObjectNotFound') { throw 'Cannot inspect laboratory ancestry safely.' }
            continue
        }
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'Laboratory root/ancestor reparse point rejected.'
        }
    }
}

function Assert-LabDirectory([string] $Root, [switch] $MustExist) {
    if (-not $Root) { throw 'Explicit laboratory directory required.' }
    $full = [IO.Path]::GetFullPath($Root)
    $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
    if (-not $full.StartsWith($temp, $comparison)) { throw 'Laboratory must be strictly under local OS temporary storage.' }
    Assert-NoReparsePath $full
    if ($MustExist -and -not (Test-Path -LiteralPath $full -PathType Container)) { throw 'Laboratory directory absent.' }
}

function Assert-NoRemoteCredentials([string] $Root) {
    Assert-LabDirectory $Root
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
    Assert-LabDirectory $Root -MustExist
    $path = Join-Path $Root $Name
    try { $artifact = Get-Item -LiteralPath $path -Force -ErrorAction Stop }
    catch { throw 'Reviewed artifact absent or inaccessible.' }
    if ($artifact.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Reviewed artifact reparse point rejected.'
    }
    if ($artifact.PSIsContainer -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $Hash) {
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
    $raw = & docker --host $endpoint info --format '{{json .}}' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Docker daemon unavailable.' }
    $info = $raw | ConvertFrom-Json
    if ($info.OSType -ne 'linux') { throw 'Docker Linux containers required.' }
    return [pscustomobject]@{Endpoint=$endpoint; ServerVersion=$info.ServerVersion; OSType=$info.OSType}
}

function Assert-LabContainer($Container, $Manifest) {
    if (-not $Container.State.Running -or $Container.HostConfig.NetworkMode -eq 'host' -or
        $Container.HostConfig.NetworkMode -match '^container(:|$)') { throw 'Unsafe runtime mode.' }
    $apiBound = $false
    foreach ($p in $Container.NetworkSettings.Ports.PSObject.Properties) {
        foreach ($b in @($p.Value)) {
            if ($null -eq $b) { continue }
            if ($b.HostIp -notin @($Manifest.network.bindAddresses) -or [int]$b.HostPort -notin @($Manifest.network.ports)) {
                throw 'Non-loopback or unapproved published port.'
            }
            if ([int]$b.HostPort -eq 54321) { $apiBound = $true }
        }
    }
    return $apiBound
}
