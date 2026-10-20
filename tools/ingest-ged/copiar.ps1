# Copia os ficheiros de um plano-<ICAO>.json para o storage privado. Idempotente.
#   powershell -File tools\ingest-ged\copiar.ps1 -Plano tools\ingest-ged\plano-FNUB.json
param([Parameter(Mandatory=$true)][string]$Plano)
$ErrorActionPreference = 'Stop'
$dest = 'C:\dirops\sga-onpremise\storage\private-uploads'
$itens = Get-Content $Plano -Raw -Encoding utf8 | ConvertFrom-Json
$n = 0; $falhas = 0
foreach ($d in $itens) {
  try {
    $alvo = Join-Path $dest $d.stored_principal
    if (-not (Test-Path $alvo)) { Copy-Item -LiteralPath $d.principal_abs -Destination $alvo; $n++ }
    if ($d.stored_fonte) {
      $alvoF = Join-Path $dest $d.stored_fonte
      if (-not (Test-Path $alvoF)) { Copy-Item -LiteralPath $d.fonte_abs -Destination $alvoF; $n++ }
    }
  } catch { $falhas++; Write-Output "FALHOU $($d.numero): $($_.Exception.Message)" }
}
Write-Output "Copiados: $n · falhas: $falhas"