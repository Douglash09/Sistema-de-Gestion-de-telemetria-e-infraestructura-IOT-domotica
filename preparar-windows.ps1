# Prepara DomotiX IoT en una copia local del repositorio.
$ErrorActionPreference = 'Stop'
$minimumVersion = [version]'22.13'

function Get-NodeVersion {
    $node = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($node) {
        $version = & $node.Source --version
        if ($LASTEXITCODE -eq 0 -and $version -match '^v(\d+\.\d+\.\d+)$') {
            return [version]$Matches[1]
        }
    }
}

if ((Get-NodeVersion) -lt $minimumVersion) {
    $winget = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) {
        throw 'No se encontro WinGet. Instala Node.js LTS desde https://nodejs.org/ y vuelve a ejecutar este script.'
    }

    Write-Host 'Instalando Node.js LTS con WinGet...'
    & $winget.Source install --id OpenJS.NodeJS.LTS --exact --source winget
    if ($LASTEXITCODE -ne 0) {
        throw "WinGet no completo la instalacion (codigo $LASTEXITCODE). Revisa el mensaje anterior."
    }

    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = [Environment]::ExpandEnvironmentVariables("$machinePath;$userPath") + ";$env:Path"
    if ((Get-NodeVersion) -lt $minimumVersion) {
        throw 'Abre una terminal nueva y vuelve a ejecutar este script para detectar Node.js.'
    }
}

$config = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $config)) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '.env.example') -Destination $config
    Write-Host 'Se creo .env. Define tu correo y contrasena de administrador antes del primer arranque.'
}

Write-Host "Node.js $(Get-NodeVersion) listo. El proyecto no necesita paquetes adicionales."
Write-Host 'Desde la carpeta del proyecto, ejecuta npm.cmd start y abre http://127.0.0.1:3000.'
