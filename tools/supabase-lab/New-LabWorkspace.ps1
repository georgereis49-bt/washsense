[CmdletBinding()]
param([Parameter(Mandatory)][string] $LabRoot)
. (Join-Path $PSScriptRoot 'Lab.Common.ps1')
$m = Read-LabManifest (Join-Path $PSScriptRoot 'lab.manifest.json')
$full = [IO.Path]::GetFullPath($LabRoot)
$temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $full.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $full)) {
    throw 'A new directory strictly under OS temporary storage is required.'
}
# Reject reparse points in ancestors before creating a workspace.
$parent = [IO.DirectoryInfo][IO.Path]::GetDirectoryName($full)
while ($parent) {
    if ($parent.Exists -and ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Reparse-point ancestor rejected.' }
    $parent = $parent.Parent
}
Assert-NoRemoteCredentials $full
New-Item -ItemType Directory -Path $full | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'lab.manifest.json') -Destination (Join-Path $full 'lab.manifest.json')
Write-Output 'Prepared placeholder workspace only. No configuration generated, tools invoked, containers or SQL started.'
