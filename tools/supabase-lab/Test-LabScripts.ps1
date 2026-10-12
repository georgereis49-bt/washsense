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
    foreach ($case in @('remote','userinfo','redirect','binding','identity','proposal','path','digest')) {
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
    $key = 'SUPABASE_STAGE318_SYNTHETIC_GUARD'
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
    $sample = Join-Path $fixture 'structure.sql.pending'
    '-- inert synthetic fixture; never executed' | Set-Content -LiteralPath $sample
    Assert-ReviewedFile $fixture 'structure.sql.pending' (Get-FileHash -LiteralPath $sample).Hash
    $count++
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force
}
Write-Output "PASS: $count static/parser/guard checks. Windows runtime, Docker and Supabase not tested."
