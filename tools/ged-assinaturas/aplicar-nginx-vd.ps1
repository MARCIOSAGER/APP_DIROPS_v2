# Acrescenta a rota /vd/ (verificacao das revisoes assinadas) ao server da intranet do nginx.
# So o bloco INTERNO (http://10.1.65.45). O bloco do tunel docs.marciosager.com fica de fora (decisao da Direccao).
# Idempotente: se /vd/ ja existir, nao faz nada. Faz copia, testa com nginx -t e repoe a copia se falhar.
# Correr como Administrador. Depois: Restart-Service dirops-nginx-v2
$ErrorActionPreference = 'Stop'
$base = 'C:\dirops\sga-onpremise\nginx'
$conf = Join-Path $base 'conf\nginx.conf'
$txt = Get-Content $conf -Raw
if ($txt -match 'location /vd/') { Write-Output 'A rota /vd/ ja existe no nginx.conf. Nada a fazer.'; exit 0 }
$bak = "$conf.bak-antes-vd-$(Get-Date -f yyyyMMdd-HHmmss)"
Copy-Item $conf $bak
$bloco = @"

        location /vd/ {
            proxy_pass http://functions_be;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }
        location = /vd {
            return 302 /vd/;
        }
"@
# primeiro «location /cert/ { ... }» (pertence ao server da intranet) -> insere logo a seguir ao fecho
$i = $txt.IndexOf('location /cert/ {')
if ($i -lt 0) { throw 'Nao encontrei location /cert/ no nginx.conf.' }
$fim = $txt.IndexOf("`n        }", $i)
if ($fim -lt 0) { throw 'Nao encontrei o fecho do bloco /cert/.' }
$fim = $fim + "`n        }".Length
$novo = $txt.Substring(0, $fim) + $bloco + $txt.Substring($fim)
[IO.File]::WriteAllText($conf, $novo, (New-Object Text.UTF8Encoding $false))
& (Join-Path $base 'nginx.exe') -t -p "$base\" -c 'conf\nginx.conf'
if ($LASTEXITCODE -ne 0) { Copy-Item $bak $conf -Force; throw "nginx -t falhou; nginx.conf reposto a partir de $bak" }
Write-Output "OK: /vd/ acrescentado. Copia em $bak. Falta: Restart-Service dirops-nginx-v2"
