$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Kodla3D.ps1') -Action setup
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
