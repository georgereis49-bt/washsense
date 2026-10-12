[CmdletBinding()]
param(
    [string] $ManifestPath = (Join-Path $PSScriptRoot 'lab.manifest.json'),
    [string] $LabRoot,
    [switch] $StaticOnly
)
. (Join-Path $PSScriptRoot 'Lab.Common.ps1')
$m = Read-LabManifest $ManifestPath
if ($StaticOnly) {
    Write-Output 'PASS: manifest structure/local destinations. Readiness NOT approved; no tools or services contacted.'
    return
}
if (-not $IsWindows -or $PSVersionTable.PSVersion -lt [version]$m.versions.powerShellMinimum) {
    throw 'Windows and PowerShell 7.4.6+ required (Windows PowerShell 5.1 unsupported).'
}
Assert-LabDirectory $LabRoot -MustExist
Assert-NoRemoteCredentials $LabRoot
if (-not $m.isolation.cleanOsProfileReviewed -or -not $m.isolation.credentialStoreReviewApproved) {
    throw 'Dedicated OS profile and credential-store review required.'
}
if (-not $m.versions.supabaseCliExact -or -not $m.versions.dockerServerExact -or
    -not @($m.versions.supabaseImages).Count) { throw 'Homologated CLI/Docker/image version pins missing.' }
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) { throw 'Supabase CLI unavailable.' }
# No arbitrary CLI argument forwarding, project linking or stack startup.
$version = (& supabase --version 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $version -ne $m.versions.supabaseCliExact) { throw 'CLI version mismatch.' }
$docker = Get-LocalDockerServer
if ($docker.ServerVersion -ne $m.versions.dockerServerExact) { throw 'Docker server version mismatch.' }
foreach ($image in $m.versions.supabaseImages) {
    if ($image -notmatch '^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$') { throw 'Image digest required.' }
    & docker --host $docker.Endpoint image inspect $image *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Approved image not cached; offline readiness blocked.' }
}
if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { throw 'Windows networking cmdlets unavailable.' }
$listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
foreach ($port in $m.network.ports) {
    if ($listeners | Where-Object LocalPort -eq $port) {
        throw "Laboratory port $port already occupied."
    }
}
if (-not $m.structuralPackage.reviewApproved -or -not $m.structuralPackage.reviewRecord) {
    throw 'Sanitized structural package review required.'
}
Assert-ReviewedFile $LabRoot $m.structuralPackage.file $m.structuralPackage.sha256
if (-not $m.configuration.reviewApproved) { throw 'CLI-specific configuration review required.' }
Assert-ReviewedFile $LabRoot $m.configuration.file $m.configuration.sha256
if (-not $m.network.egressPolicyApproved -or $m.network.egressEvidenceSha256 -notmatch '^[a-fA-F0-9]{64}$') {
    throw 'Reviewed network isolation evidence required.'
}
if (-not $m.approvals.startStack -or -not $m.approvals.runSyntheticTests) { throw 'Future laboratory execution approval absent.' }
Write-Output 'PASS: static prerequisites only; no stack started, no SQL executed. Runtime isolation must still be checked.'
