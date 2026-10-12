[CmdletBinding()]
param([Parameter(Mandatory)][string] $LabRoot)
. (Join-Path $PSScriptRoot 'Lab.Common.ps1')
$m = Read-LabManifest (Join-Path $PSScriptRoot 'lab.manifest.json')
$full = [IO.Path]::GetFullPath($LabRoot)
Assert-LabDirectory $full
if (Test-Path -LiteralPath $full) { throw 'Laboratory directory already exists.' }
Assert-NoRemoteCredentials $full
New-Item -ItemType Directory -Path $full | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'lab.manifest.json') -Destination (Join-Path $full 'lab.manifest.json')
Write-Output 'Prepared placeholder workspace only. No configuration generated, tools invoked, containers or SQL started.'
