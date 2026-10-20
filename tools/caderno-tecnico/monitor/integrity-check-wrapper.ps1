# integrity-check-wrapper.ps1
# Verifica se DiropsServiceHost.exe existe e tem o hash esperado. Se falhar,
# envia email URGENTE. Detecta quarentena pelo Check Point / Defender antes
# que os utilizadores notem.
#
# Corre horariamente via Task Agendada. Rate-limit: 1 email por hora
# para o mesmo tipo de problema (evita spam se ficar em loop).

$ErrorActionPreference = 'Stop'
$exe = 'C:\dirops\sga-onpremise\service-host\DiropsServiceHost.exe'
$expectedHash = '7ACF31A8CB11CCF9CCEB9050A4A5AAE33D9AC5CF29B9FDAA7716B9B99813EA34'
$expectedSize = 13824
$stateFile = 'C:\dirops\sga-onpremise\scripts\.integrity-wrapper-state.json'
$logFile   = 'C:\dirops\sga-onpremise\logs\integrity-wrapper.log'
$mailTo    = 'oaeroportos@sga.co.ao'

function Log($m) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  try { Add-Content -Path $logFile -Value $line -Encoding utf8 } catch {}
  Write-Output $line
}

# Verificacoes
$issue = $null
if (-not (Test-Path $exe)) {
  $issue = "QUARENTENADO: $exe NAO existe no disco."
} else {
  $item = Get-Item $exe
  if ($item.Length -ne $expectedSize) {
    $issue = "TAMANHO MUDOU: esperado $expectedSize bytes, real $($item.Length) bytes."
  } else {
    $hash = (Get-FileHash -Algorithm SHA256 $exe).Hash
    if ($hash -ne $expectedHash) {
      $issue = "HASH MUDOU: esperado $expectedHash, real $hash."
    }
  }
}

# Verificar servicos wrapper
$svcDown = @()
foreach ($n in 'dirops-auth-v2','dirops-auth-uc-v2','dirops-auth-docs-v2','dirops-functions-v2','dirops-nginx-v2','dirops-postgrest-v2') {
  $s = Get-Service -Name $n -ErrorAction SilentlyContinue
  if (-not $s -or $s.Status -ne 'Running') { $svcDown += $n }
}

if (-not $issue -and $svcDown.Count -eq 0) {
  Log 'OK: exe integro + 6 wrappers Running.'
  exit 0
}

$issueSummary = @()
if ($issue) { $issueSummary += $issue }
if ($svcDown.Count -gt 0) { $issueSummary += "SERVICOS DOWN: $($svcDown -join ', ')" }
$issueText = $issueSummary -join ' | '
Log "PROBLEMA: $issueText"

# Rate-limit
$state = if (Test-Path $stateFile) { Get-Content $stateFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
$key = ($issueSummary -join '|').GetHashCode().ToString()
$lastSent = $state."$key"
$shouldAlert = -not $lastSent -or ((Get-Date $lastSent) -lt (Get-Date).AddHours(-1))
if (-not $shouldAlert) {
  Log "Alerta suprimido (rate-limited, ultimo em $lastSent)."
  exit 1
}

# Enviar email urgente
try {
  Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue
  $smtp = New-Object System.Net.Mail.SmtpClient('mail.sga.co.ao', 25)
  $smtp.Credentials = New-Object System.Net.NetworkCredential((Get-Content 'C:\dirops\sga-onpremise\secrets\smtp_user.txt' -Raw).Trim(), (Get-Content 'C:\dirops\sga-onpremise\secrets\smtp_password.txt' -Raw).Trim())
  $msg = New-Object System.Net.Mail.MailMessage
  $msg.From = New-Object System.Net.Mail.MailAddress('dirops@sga.co.ao','Sistema DIROPS - Integridade Wrapper')
  $msg.SubjectEncoding = [System.Text.Encoding]::UTF8
  $msg.BodyEncoding    = [System.Text.Encoding]::UTF8
  $msg.To.Add($mailTo)
  $msg.Subject = '[URGENTE] Wrapper DIROPS pode ter sido quarentenado'
  $msg.IsBodyHtml = $true
  $bodyIssue = [System.Web.HttpUtility]::HtmlEncode($issueText)
  $msg.Body = @"
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;max-width:600px">
<h2 style="color:#dc2626;margin:0 0 16px">Verificacao horaria falhou</h2>
<p><strong>Problema:</strong></p>
<pre style="background:#fef2f2;padding:12px;border:1px solid #fecaca;border-radius:6px;white-space:pre-wrap">$bodyIssue</pre>
<p><strong>Hora:</strong> $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') no $($env:COMPUTERNAME)</p>
<p><strong>Acao recomendada:</strong></p>
<ol>
  <li>Verificar consola do Check Point Harmony para deteccoes recentes (padrao nssm 2026-08-28)</li>
  <li>Correr script de recovery: <code>C:\dirops\sga-onpremise\scripts\recovery-wrapper.ps1</code></li>
  <li>Ou clonar do backup GitHub: <code>git clone git\@github.com:MARCIOSAGER/sga-onpremise-stack.git</code></li>
</ol>
<hr style="border:0;border-top:1px solid #e2e8f0">
<p style="color:#64748b;font-size:11px">Verificacao horaria automatica. Rate-limit: 1 email por hora para o mesmo problema.</p>
</body></html>
"@
  $smtp.Send($msg); $msg.Dispose(); $smtp.Dispose()
  Log 'Email URGENTE enviado.'
  Add-Member -InputObject $state -NotePropertyName "$key" -NotePropertyValue (Get-Date).ToString('o') -Force
  $state | ConvertTo-Json | Set-Content $stateFile -Encoding utf8
} catch {
  Log "Falha ao enviar email: $($_.Exception.Message)"
}

exit 1
