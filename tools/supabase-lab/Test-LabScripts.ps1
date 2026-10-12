# Static/guard unit checks only; does not use Docker, Supabase, network or SQL.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Lab.Common.ps1')
$count = 0
foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1') {
    $tokens = $null; $errors = $null
    $null = [Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw "PowerShell syntax errors in $($file.Name)." }
    $count++
}
function docker { throw 'Unexpected Docker invocation during static checks.' }
function supabase { throw 'Unexpected Supabase invocation during static checks.' }
& (Join-Path $PSScriptRoot 'Test-LabPrerequisites.ps1') -StaticOnly
$count++
$manifest = Join-Path $PSScriptRoot 'lab.manifest.json'
$m = Read-LabManifest $manifest
if ($m.approvals.startStack -or $m.approvals.runSyntheticTests -or
    $m.versions.supabaseCliExact -or $m.versions.dockerServerExact -or
    $m.structuralPackage.reviewApproved) { throw 'Committed preparation must remain unapproved/unpinned.' }
$count++
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('washsense-static-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
try {
    foreach ($case in @('remote','userinfo','redirect','binding','identity','proposal','path','digest',
        'stringflag','nullflag','emptybinding','emptyredirect','minimum','purpose','file','porttype','apipath')) {
        $copy = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
        switch ($case) {
            'remote' { $copy.network.apiUrl = 'https://example.invalid:54321' }
            'userinfo' { $copy.network.apiUrl = 'http://dummy@127.0.0.1:54321' }
            'redirect' { $copy.auth.redirectUrls = @('http://example.invalid/recovery') }
            'binding' { $copy.network.bindAddresses = @('0.0.0.0') }
            'identity' { $copy.projectId = 'not-a-laboratory' }
            'proposal' { $copy.approvals.executeSecurityProposal = $true }
            'path' { $copy.structuralPackage.file = '../outside.sql.pending' }
            'digest' { $copy.structuralPackage.sha256 = 'unreviewed' }
            'stringflag' { $copy.approvals.startStack = 'false' }
            'nullflag' { $copy.auth.externalHooks = $null }
            'emptybinding' { $copy.network.bindAddresses = @() }
            'emptyredirect' { $copy.auth.redirectUrls = @() }
            'minimum' { $copy.versions.powerShellMinimum = '5.1' }
            'purpose' { $copy.purpose = 'production' }
            'file' { $copy.structuralPackage.file = 'unreviewed.sql' }
            'porttype' { $copy.network.ports = @('54321','54322','54323','54324') }
            'apipath' { $copy.network.apiUrl = 'http://127.0.0.1:54321/unexpected' }
        }
        $testPath = Join-Path $fixture 'manifest.json'
        $copy | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $testPath
        $rejected = $false
        try {
            if ($case -in @('path','digest')) {
                Assert-ReviewedFile $fixture $copy.structuralPackage.file $copy.structuralPackage.sha256
            } else { $null = Read-LabManifest $testPath }
        } catch { $rejected = $true }
        if (-not $rejected) { throw "Unsafe manifest accepted: $case" }
        $count++
    }
    $invalidPath = Join-Path $fixture 'invalid.json'
    'synthetic-invalid-body' | Set-Content -LiteralPath $invalidPath
    $rejected=$false
    try { $null = Read-LabManifest $invalidPath } catch {
        if ($_.Exception.Message -ne 'Manifest unreadable or invalid JSON.') { throw }
        $rejected=$true
    }
    if (-not $rejected) { throw 'Invalid JSON accepted.' }
    $count++
    foreach ($remotePath in @('\\example.invalid\manifest.json','https://example.invalid/manifest.json')) {
        $rejected = $false
        try { $null = Read-LabManifest $remotePath } catch {
            if ($_.Exception.Message -ne 'Remote manifest path rejected.') { throw }
            $rejected = $true
        }
        if (-not $rejected) { throw 'Remote manifest path accepted.' }
        $count++
    }
    foreach ($mode in @('host','container','container:synthetic-id')) {
        $container = [pscustomobject]@{
            State = [pscustomobject]@{Running=$true}
            HostConfig = [pscustomobject]@{NetworkMode=$mode}
        }
        $rejected = $false
        try { $null = Assert-LabContainer $container $m } catch {
            if ($_.Exception.Message -ne 'Unsafe runtime mode.') { throw }
            $rejected = $true
        }
        if (-not $rejected) { throw 'Unsafe container network mode accepted.' }
        $count++
    }
    foreach ($ip in @('0.0.0.0','::','127.0.0.1')) {
        $port = if ($ip -eq '127.0.0.1') { '9999' } else { '54321' }
        $container = [pscustomobject]@{
            State=[pscustomobject]@{Running=$true}
            HostConfig=[pscustomobject]@{NetworkMode='bridge'}
            NetworkSettings=[pscustomobject]@{Ports=[pscustomobject]@{
                '8000/tcp'=@([pscustomobject]@{HostIp=$ip;HostPort=$port})
            }}
        }
        $rejected = $false
        try { $null = Assert-LabContainer $container $m } catch {
            if ($_.Exception.Message -ne 'Non-loopback or unapproved published port.') { throw }
            $rejected = $true
        }
        if (-not $rejected) { throw 'Unsafe container binding accepted.' }
        $count++
    }
    $container.NetworkSettings.Ports.'8000/tcp'[0].HostIp='127.0.0.1'
    $container.NetworkSettings.Ports.'8000/tcp'[0].HostPort='54321'
    if (-not (Assert-LabContainer $container $m)) { throw 'Valid loopback fixture rejected.' }
    $count++
    $key = 'SUPABASE_STAGE319_SYNTHETIC_GUARD'
    if (Test-Path "Env:$key") { throw 'Synthetic test variable already present.' }
    try {
        [Environment]::SetEnvironmentVariable($key,'synthetic-not-a-token','Process')
        $rejected = $false
        try { Assert-NoRemoteCredentials $fixture } catch { $rejected = $true }
        if (-not $rejected) { throw 'Environment guard failed.' }
        $count++
    } finally { [Environment]::SetEnvironmentVariable($key,$null,'Process') }
    function docker {
        if ($args[0] -eq 'context') {
            $global:LASTEXITCODE = 0
            return '"tcp://example.invalid:2375"'
        }
        throw 'Daemon contacted before rejecting remote context.'
    }
    $rejected = $false
    try { $null = Get-LocalDockerServer } catch {
        if ($_.Exception.Message -ne 'Only local Windows Docker named pipes are allowed.') { throw }
        $rejected = $true
    }
    if (-not $rejected) { throw 'Remote Docker endpoint accepted.' }
    $count++
    function docker {
        $global:LASTEXITCODE=0
        if ($args[0] -eq 'context') { return '"npipe:////./pipe/docker_engine"' }
        if ($args[0] -eq '--host' -and $args[1] -eq 'npipe:////./pipe/docker_engine' -and $args[2] -eq 'info') {
            return '{"OSType":"linux","ServerVersion":"synthetic"}'
        }
        throw 'Unpinned Docker call in mock.'
    }
    $info=Get-LocalDockerServer
    if ($info.Endpoint -ne 'npipe:////./pipe/docker_engine' -or $info.ServerVersion -ne 'synthetic') {
        throw 'Docker endpoint pinning failed.'
    }
    $count++
    $sample = Join-Path $fixture 'structure.sql.pending'
    '-- inert synthetic fixture; never executed' | Set-Content -LiteralPath $sample
    Assert-ReviewedFile $fixture 'structure.sql.pending' (Get-FileHash -LiteralPath $sample).Hash
    $count++
    if (-not $IsWindows) {
        # Windows junction/symlink privileges require a separate approved Windows run.
        $rootLink = Join-Path $fixture 'root-link'
        $fileLink = Join-Path $fixture 'file-link.sql.pending'
        try {
            New-Item -ItemType SymbolicLink -Path $rootLink -Target $fixture | Out-Null
            $rejected=$false
            try { Assert-LabDirectory $rootLink -MustExist } catch {
                if ($_.Exception.Message -ne 'Laboratory root/ancestor reparse point rejected.') { throw }
                $rejected=$true
            }
            if (-not $rejected) { throw 'Linked root accepted.' }
            $count++
            $rejected=$false
            try { Assert-LabDirectory (Join-Path $rootLink 'nonexistent-descendant') } catch {
                if ($_.Exception.Message -ne 'Laboratory root/ancestor reparse point rejected.') { throw }
                $rejected=$true
            }
            if (-not $rejected) { throw 'Linked ancestor accepted.' }
            $count++
            New-Item -ItemType SymbolicLink -Path $fileLink -Target $sample | Out-Null
            $rejected=$false
            try { Assert-ReviewedFile $fixture 'file-link.sql.pending' (Get-FileHash $sample).Hash } catch {
                if ($_.Exception.Message -ne 'Reviewed artifact reparse point rejected.') { throw }
                $rejected=$true
            }
            if (-not $rejected) { throw 'Linked artifact accepted.' }
            $count++
            $rejected=$false
            try { $null=Read-LabManifest (Join-Path $rootLink 'manifest.json') } catch {
                if ($_.Exception.Message -ne 'Laboratory root/ancestor reparse point rejected.') { throw }
                $rejected=$true
            }
            if (-not $rejected) { throw 'Manifest through linked ancestor accepted.' }
            $count++
        } finally {
            foreach ($link in @($rootLink,$fileLink)) {
                if (Test-Path -LiteralPath $link) { Remove-Item -LiteralPath $link -Force }
            }
        }
    } else { Write-Output 'NOT RUN: real Windows junction/symlink cases; require dedicated Windows validation.' }
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force
}
Write-Output "PASS: $count static/parser/guard checks. Windows runtime, Docker and Supabase not tested."
