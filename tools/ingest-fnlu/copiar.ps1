# Copia os ficheiros do plano para o storage privado (nomes com hash). Idempotente (salta os que já existem).
$ErrorActionPreference = 'Stop'
$dest = 'C:\dirops\sga-onpremise\storage\private-uploads'
$plano = Get-Content 'C:\dirops\APP_DIROPS_v2\tools\ingest-fnlu\plano.json' -Raw -Encoding utf8 | ConvertFrom-Json
$n = 0
foreach ($d in $plano) {
  $alvo = Join-Path $dest $d.stored_principal
  if (-not (Test-Path $alvo)) { Copy-Item -LiteralPath $d.principal_abs -Destination $alvo; $n++ }
  if ($d.stored_fonte) {
    $alvoF = Join-Path $dest $d.stored_fonte
    if (-not (Test-Path $alvoF)) { Copy-Item -LiteralPath $d.fonte_abs -Destination $alvoF; $n++ }
  }
}
Write-Output "Ficheiros copiados para private-uploads: $n"