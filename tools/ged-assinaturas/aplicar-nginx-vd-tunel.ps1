# Acrescenta a rota /vd/ ao server docs.marciosager.com (tunel Cloudflare), para o QR das copias assinadas
# se verificar no telemovel fora da rede da SGA (como /cert/ dos certificados da Universidade).
# Idempotente. Copia + nginx -t + reposicao automatica se falhar. Correr como Administrador.
# Depois: Restart-Service dirops-nginx-v2  e, no painel Cloudflare, acrescentar vd ao Path da rota do tunel.
$ErrorActionPreference = 'Stop'
$base = 'C:\dirops\sga-onpremise\nginx'
$conf = Join-Path $base 'conf\nginx.conf'
$txt = Get-Content $conf -Raw
$iDocs = $txt.IndexOf('server_name  docs.marciosager.com;')
if ($iDocs -lt 0) { throw 'Nao encontrei o server docs.marciosager.com.' }
if ($txt.IndexOf('location /vd/', $iDocs) -ge 0) { Write-Output 'A rota /vd/ ja existe no server do tunel. Nada a fazer.'; exit 0 }
$bak = "$conf.bak-antes-vd-tunel-$(Get-Date -f yyyyMMdd-HHmmss)"
Copy-Item $conf $bak
$bloco = @"

        location /vd/ {
            proxy_pass http://functions_be;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$visitor_ip;
            proxy_set_header X-Forwarded-For `$visitor_ip;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Forwarded-Host `$host;
        }
        location = /vd {
            return 302 /vd/;
        }
"@
$i = $txt.IndexOf('location /cert/ {', $iDocs)
if ($i -lt 0) { throw 'Nao encontrei location /cert/ no server do tunel.' }
$fim = $txt.IndexOf("`n        }", $i)
if ($fim -lt 0) { throw 'Nao encontrei o fecho do bloco /cert/ do tunel.' }
$fim = $fim + "`n        }".Length
$novo = $txt.Substring(0, $fim) + $bloco + $txt.Substring($fim)
[IO.File]::WriteAllText($conf, $novo, (New-Object Text.UTF8Encoding $false))
& (Join-Path $base 'nginx.exe') -t -p "$base\" -c 'conf\nginx.conf'
if ($LASTEXITCODE -ne 0) { Copy-Item $bak $conf -Force; throw "nginx -t falhou; nginx.conf reposto a partir de $bak" }
Write-Output "OK: /vd/ acrescentado ao server do tunel. Copia em $bak. Falta: Restart-Service dirops-nginx-v2 e o Path na Cloudflare."
