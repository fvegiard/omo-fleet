#requires -Version 7.0
$ErrorActionPreference = 'Stop'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$major = & $nodePath --version
if ($major -notlike 'v24.*') { throw 'Node LTS 24 is required.' }
$hiddenRun = 'D:\Github\dr-knowledge-lab\consolewatch\hidden-run.js'
if (-not (Test-Path -LiteralPath $hiddenRun)) { throw 'Existing hidden-run.js launcher not found.' }
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'OmO Docker Fleet.lnk'
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcutPath)
$link.TargetPath = 'C:\Windows\System32\wscript.exe'
$link.Arguments = '//B "' + $hiddenRun + '" "' + $nodePath + '" "' + (Join-Path $PSScriptRoot 'launch.mjs') + '"'
$link.WorkingDirectory = $PSScriptRoot
$link.WindowStyle = 7
$link.Save()
Write-Output "Startup shortcut installed: $shortcutPath"
