# Service watchdog - runs every 5 minutes via DIROPS-Watchdog task.
# Checks:
#   - Required services Running
#   - Required ports listening
#   - HTTP /healthz returns 200
#   - PostgREST /aeroporto returns 200
# If anything fails: writes a status file + sends email to admin(s) at @sga.co.ao.
# Email is rate-limited (one per 30 min per problem) so we do not spam during an outage.

$ErrorActionPreference = 'Continue'

$base    = 'C:\dirops\sga-onpremise'
$logDir  = "$base\logs"
$logFile = "$logDir\watchdog.log"
$stateFile = "$logDir\watchdog-state.json"

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -Path $logFile -Value $line -Encoding utf8
}

$state = if (Test-Path $stateFile) { Get-Content $stateFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }

$issues = @()

$reqServices = @('postgresql-x64-16')
foreach ($s in $reqServices) {
  $svc = Get-Service -Name $s -ErrorAction SilentlyContinue
  if (-not $svc) { $issues += "Service '$s' not installed"; continue }
  if ($svc.Status -ne 'Running') { $issues += "Service '$s' is $($svc.Status)" }
}

$reqPorts = @(@{port=80;name='nginx'},@{port=3000;name='postgrest'},@{port=4001;name='functions'},@{port=9999;name='gotrue'},@{port=9998;name='gotrue-universidade'},@{port=9997;name='gotrue-ged'},@{port=5432;name='postgres'})
foreach ($p in $reqPorts) {
  $listening = Get-NetTCPConnection -LocalPort $p.port -State Listen -ErrorAction SilentlyContinue
  if (-not $listening) { $issues += "Port $($p.port) ($($p.name)) not listening" }
}

try {
  $r = Invoke-WebRequest 'http://127.0.0.1/healthz' -UseBasicParsing -TimeoutSec 5
  if ($r.StatusCode -ne 200) { $issues += "nginx /healthz returned $($r.StatusCode)" }
} catch { $issues += "nginx /healthz unreachable: $($_.Exception.Message)" }

try {
  $svcKey = (Get-Content "$base\secrets\service_role_key.txt" -Raw).Trim()
  $r = Invoke-WebRequest 'http://127.0.0.1/rest/v1/aeroporto?select=id&limit=1' -UseBasicParsing -TimeoutSec 5 -Headers @{ Authorization = "Bearer $svcKey"; apikey = $svcKey }
  if ($r.StatusCode -ne 200) { $issues += "PostgREST returned $($r.StatusCode)" }
} catch { $issues += "PostgREST unreachable: $($_.Exception.Message)" }

$now = Get-Date

if ($issues.Count -eq 0) {
  Log "OK"
  if (Test-Path $stateFile) { Remove-Item $stateFile -Force }
  exit 0
}

$issueText = $issues -join "; "
Log "ISSUES: $issueText"

$key = ($issues -join '|').GetHashCode()
$lastSent = $state."$key"
$shouldAlert = -not $lastSent -or ((Get-Date $lastSent) -lt $now.AddMinutes(-30))

if (-not $shouldAlert) {
  Log "Alert suppressed (rate-limited; last sent $lastSent)"
  exit 1
}

Log "Sending alert email..."
try {
  Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue
  $smtp = New-Object System.Net.Mail.SmtpClient('mail.sga.co.ao', 25)
  $smtp.Credentials = New-Object System.Net.NetworkCredential((Get-Content 'C:\dirops\sga-onpremise\secrets\smtp_user.txt' -Raw).Trim(), (Get-Content 'C:\dirops\sga-onpremise\secrets\smtp_password.txt' -Raw).Trim())
  $msg = New-Object System.Net.Mail.MailMessage
  $msg.From = New-Object System.Net.Mail.MailAddress('dirops@sga.co.ao','Sistema DIROPS - Watchdog')
  $msg.SubjectEncoding = [System.Text.Encoding]::UTF8
  $msg.BodyEncoding    = [System.Text.Encoding]::UTF8
  $msg.To.Add('oaeroportos@sga.co.ao')
  $msg.Subject = '[ALERTA] Sistema DIROPS - Problema detectado'
  $msg.IsBodyHtml = $true
  $hostName = $env:COMPUTERNAME
  $issuesHtml = ($issues | ForEach-Object { '    <li>' + [System.Web.HttpUtility]::HtmlEncode($_) + '</li>' }) -join "`n"
  $bodyHtml = @"
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;padding:20px;color:#1e293b">
  <h2 style="color:#dc2626;margin:0 0 16px">Sistema DIROPS - Alerta de Watchdog</h2>
  <p>O monitor detectou os seguintes problemas em <strong>$hostName</strong>:</p>
  <ul>
$issuesHtml
  </ul>
  <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0">
  <p style="color:#64748b;font-size:12px">Verificacao automatica a cada 5min. Proximo alerta para o mesmo problema so em 30 min.<br>Servidor: $hostName | Hora: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
</div></body></html>
"@
  $msg.Body = $bodyHtml
  $smtp.Send($msg); $msg.Dispose(); $smtp.Dispose()
  Log "Alert email sent to oaeroportos@sga.co.ao"
  Add-Member -InputObject $state -NotePropertyName "$key" -NotePropertyValue $now.ToString('o') -Force
  $state | ConvertTo-Json | Set-Content $stateFile -Encoding utf8
} catch {
  Log "Failed to send alert: $($_.Exception.Message)"
}

exit 1

