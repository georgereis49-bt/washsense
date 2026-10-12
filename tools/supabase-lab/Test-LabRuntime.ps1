# FUTURE read-only check: never invoke during Stage 3.18/3.19; requires separately approved stack.
[CmdletBinding()]
param([Parameter(Mandatory)][string] $LabRoot)
. (Join-Path $PSScriptRoot 'Lab.Common.ps1')
Assert-LabDirectory $LabRoot -MustExist
$m = Read-LabManifest (Join-Path $LabRoot 'lab.manifest.json')
Assert-NoRemoteCredentials $LabRoot
if (-not $IsWindows -or -not $m.approvals.startStack -or -not $m.approvals.runSyntheticTests -or -not $m.network.egressPolicyApproved -or
    -not $m.isolation.cleanOsProfileReviewed -or -not $m.isolation.credentialStoreReviewApproved) {
    throw 'Approved Windows/local runtime required.'
}
$docker = Get-LocalDockerServer
$ids = @(& docker --host $docker.Endpoint ps -q --filter "label=$($m.network.dockerProjectLabel)=$($m.projectId)")
if ($LASTEXITCODE -ne 0 -or -not $ids.Count) { throw 'Expected laboratory containers absent.' }
$apiBound = $false
foreach ($id in $ids) {
    $raw = & docker --host $docker.Endpoint inspect $id 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Container inspection failed.' }
    $c = @($raw | ConvertFrom-Json)[0]
    if (Assert-LabContainer $c $m) { $apiBound = $true }
}
if (-not $apiBound) { throw 'Expected local API binding absent.' }
# Redirects forbidden; only a loopback health GET. Does not validate login/recovery.
$result = Invoke-WebRequest -Uri "$($m.network.apiUrl)/auth/v1/health" -MaximumRedirection 0 -TimeoutSec 5 -NoProxy
if ($result.StatusCode -ne 200) { throw 'Local Auth health failed.' }
Write-Output 'PASS: container port bindings and local Auth health. Egress/Auth flows/PostgreSQL/schema still require independent tests.'
