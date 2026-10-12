Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NormalizedLocalPath([string] $Path) {
    if (-not $Path -or $Path -match '^(\\|//|[a-zA-Z]+://)' -or
        -not [IO.Path]::IsPathFullyQualified($Path)) { throw 'Absolute local filesystem path required.' }
    if ($IsWindows) {
        if ($Path -notmatch '^[a-zA-Z]:[\\/]' -or $Path.Substring(2).Contains(':')) {
            throw 'Windows device/provider/relative-drive path rejected.'
        }
    } elseif ($Path.Contains('\') -or $Path.Contains(':')) {
        throw 'Foreign/provider path syntax rejected.'
    }
    return [IO.Path]::GetFullPath($Path)
}

function Assert-WindowsStorageMetadata($Drive) {
    # Metadata only: never enumerate a share or test whether a network path exists.
    if ($Drive.Root -notmatch '^[a-zA-Z]:\\$' -or
        $Drive.Provider -ne 'FileSystem' -or
        ($Drive.DisplayRoot -and $Drive.DisplayRoot -ne $Drive.Root) -or
        $Drive.DriveType -ne 'Fixed') { throw 'Windows fixed local storage could not be proven.' }
}

function Assert-LinuxMountStorage([string] $Path, [string[]] $MountInfo, [switch] $MetadataOnly) {
    $mountCandidates = @()
    foreach ($line in $MountInfo) {
        $parts = $line.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
        $separator = [Array]::IndexOf($parts, '-')
        if ($parts.Count -lt 10 -or $separator -lt 6 -or $separator+3 -ge $parts.Count) {
            throw 'Linux mount metadata invalid.'
        }
        $mount = [regex]::Replace($parts[4], '\\([0-7]{3})', {
            param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value,8)
        })
        if (-not $mount.StartsWith('/')) { throw 'Linux mount metadata invalid.' }
        $prefix = $mount.TrimEnd('/') + '/'
        if ($Path -eq $mount -or $Path.StartsWith($prefix, [StringComparison]::Ordinal)) {
            $mountCandidates += [pscustomobject]@{Length=$mount.Length; Type=$parts[$separator+1]}
        }
    }
    if (-not $mountCandidates.Count) { throw 'Linux local storage could not be proven.' }
    $longest = ($mountCandidates | Measure-Object Length -Maximum).Maximum
    # Unknown/FUSE/network/overlay filesystems are not evidence of local backing.
    $allowed = @('tmpfs','ramfs','ext2','ext3','ext4','xfs','btrfs')
    # Overlay may be inspected as an ancestor, never certified as lab storage.
    if ($MetadataOnly) { $allowed += 'overlay' }
    foreach ($entry in @($mountCandidates | Where-Object Length -eq $longest)) {
        if ($entry.Type -notin $allowed) {
            throw 'Linux local storage could not be proven.'
        }
    }
}

function Assert-ProvenLocalStorage([string] $Path) {
    if ($IsWindows) {
        $root = [IO.Path]::GetPathRoot($Path)
        try {
            $drive = Get-PSDrive -Name $root.Substring(0,1) -PSProvider FileSystem -ErrorAction Stop
            # Reject mappings before querying DriveInfo; require an ordinary OS drive.
            if ($drive.Root -ne $root -or ($drive.DisplayRoot -and $drive.DisplayRoot -ne $root)) {
                throw 'Mapped drive rejected.'
            }
            $metadata = [pscustomobject]@{Root=$drive.Root; DisplayRoot=$drive.DisplayRoot;
                Provider=$drive.Provider.Name; DriveType=([IO.DriveInfo]::new($root)).DriveType.ToString()}
            Assert-WindowsStorageMetadata $metadata
        } catch { throw 'Windows fixed local storage could not be proven.' }
    } elseif ($IsLinux) {
        try { $mountInfo = [IO.File]::ReadAllLines('/proc/self/mountinfo') }
        catch { throw 'Linux mount metadata unavailable.' }
        Assert-LinuxMountStorage $Path $mountInfo
    } else { throw 'Storage verification unsupported on this platform.' }
}

function Read-LabManifest([string] $Path) {
    if ($Path -match '^(\\\\|//|[a-zA-Z]+://)') { throw 'Remote manifest path rejected.' }
    $localPath = Get-NormalizedLocalPath $Path
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
    $Path = Get-NormalizedLocalPath $Path
    if ($IsWindows) { Assert-ProvenLocalStorage $Path }
    elseif ($IsLinux) {
        try { $mountInfo = [IO.File]::ReadAllLines('/proc/self/mountinfo') }
        catch { throw 'Linux mount metadata unavailable.' }
    } else { throw 'Storage verification unsupported on this platform.' }
    # Check root AND ancestors before recursion or artifact access.
    $ancestors = [Collections.Generic.List[IO.DirectoryInfo]]::new()
    $directory = [IO.DirectoryInfo]$Path
    while ($directory) {
        $ancestors.Add($directory)
        $directory = $directory.Parent
    }
    # Traverse top-down: do not probe a descendant through a junction first.
    for ($i=$ancestors.Count-1; $i -ge 0; $i--) {
        if ($IsLinux) { Assert-LinuxMountStorage $ancestors[$i].FullName $mountInfo -MetadataOnly }
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

function Get-LabTemporaryPath { return [IO.Path]::GetTempPath() }

function Assert-LabDirectory([string] $Root, [switch] $MustExist) {
    if (-not $Root) { throw 'Explicit laboratory directory required.' }
    $full = (Get-NormalizedLocalPath $Root).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $temporary = Get-NormalizedLocalPath (Get-LabTemporaryPath)
    # Prove both paths before Test-Path/Get-Item; inspect redirection of temp itself.
    Assert-ProvenLocalStorage $temporary
    Assert-ProvenLocalStorage $full
    Assert-NoReparsePath $temporary
    $temp = $temporary.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $comparison = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
    if (-not $full.StartsWith($temp, $comparison)) { throw 'Laboratory must be strictly under local OS temporary storage.' }
    Assert-NoReparsePath $full
    if ($MustExist -and -not (Test-Path -LiteralPath $full -PathType Container)) { throw 'Laboratory directory absent.' }
}

function Assert-NoRemoteCredentials([string] $Root) {
    $Root = Get-NormalizedLocalPath $Root
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
    $Root = Get-NormalizedLocalPath $Root
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
