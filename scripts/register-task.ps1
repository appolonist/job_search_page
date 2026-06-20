#requires -Version 5
<#
.SYNOPSIS
  Registers (or updates) the Scheduled Task that runs daily-scrape.ps1 at logon.

.DESCRIPTION
  Trigger is "at logon" with a 1-minute delay (lets the network/desktop settle).
  daily-scrape.ps1's own date guard makes it run only once per calendar day, so
  rebooting / logging on again the same day does nothing.

  Runs in your interactive session (LogonType Interactive) so Chrome opens on
  your desktop. No stored password required.

  Run this ONCE, from a normal (non-elevated is fine) PowerShell:
      powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1

  Remove it later with:
      Unregister-ScheduledTask -TaskName 'JobScraper Daily' -Confirm:$false
#>
[CmdletBinding()]
param(
  [string] $TaskName = 'JobScraper Daily'
)

$ErrorActionPreference = 'Stop'

$script = Join-Path $PSScriptRoot 'daily-scrape.ps1'
if (-not (Test-Path $script)) { throw "Cannot find $script" }

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Delay = 'PT1M'   # ISO-8601: wait 1 minute after logon

$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName  $TaskName `
  -Action    $action `
  -Trigger   $trigger `
  -Principal $principal `
  -Settings  $settings `
  -Description 'Runs the job scraper once per day at logon, then opens the tracker on http://localhost:3000/job_search_page/' `
  -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName' (trigger: at logon, +1 min)."
Write-Host "Test it now without waiting for logon:"
Write-Host "    Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Or run the pipeline directly:"
Write-Host "    powershell -ExecutionPolicy Bypass -File `"$script`" -Force"
