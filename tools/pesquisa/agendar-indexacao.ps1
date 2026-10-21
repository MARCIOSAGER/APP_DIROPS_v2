# Cria a tarefa agendada que mantém a pesquisa por conteúdo do GED em dia (todas as noites às 03:30):
#   1) indexar-conteudo.mjs  — texto dos PDF/Word/Excel novos ou alterados (idempotente: salta o que não mudou)
#   2) ocr-indexar.mjs       — reconhecimento óptico dos PDF digitalizados que faltem
# Correr UMA vez num PowerShell como Administrador. Idempotente (substitui a tarefa se já existir).
$ErrorActionPreference = 'Stop'
$app = 'C:\dirops\APP_DIROPS_v2'
$log = 'C:\dirops\sga-onpremise\logs\indexar-pesquisa.log'
$cmd = "cd /d $app && node scripts\documentos\indexar-conteudo.mjs >> `"$log`" 2>&1 && node scripts\documentos\ocr-indexar.mjs >> `"$log`" 2>&1"
$accao = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $cmd"
$quando = New-ScheduledTaskTrigger -Daily -At 03:30
$conf = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 3) -StartWhenAvailable -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'DIROPS-Indexar-Pesquisa' -Action $accao -Trigger $quando -Settings $conf -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
Get-ScheduledTask -TaskName 'DIROPS-Indexar-Pesquisa' | Select-Object TaskName, State | Format-Table -AutoSize
Write-Output "Registo em $log"
