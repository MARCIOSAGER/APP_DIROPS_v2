# Produz o vídeo de apresentação da Universidade Corporativa (1280x720, H.264, ~70 s) a partir de slides.json,
# com ffmpeg (drawtext/xfade), poster JPG e legendas WebVTT. Sem narração (o servidor não tem vozes pt).
#   powershell -File tools\curso-uc\video\produzir-video.ps1 [-Out <pasta>]
param([string]$Out = "$PSScriptRoot\out")
$ErrorActionPreference = 'Stop'
$ff = "C:\dirops\sga-onpremise\installers\ffmpeg\bin\ffmpeg.exe"
if (-not (Test-Path $ff)) { throw "ffmpeg não encontrado em $ff" }
$cfg = Get-Content "$PSScriptRoot\slides.json" -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force $Out | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$fontB = 'C\:/Windows/Fonts/segoeuib.ttf'; $fontR = 'C\:/Windows/Fonts/segoeui.ttf'
$n = $cfg.slides.Count; $d = [double]$cfg.duracao_s; $tr = [double]$cfg.transicao_s
# 1) slides PNG
for ($i = 0; $i -lt $n; $i++) {
  $s = $cfg.slides[$i]
  $tf = Join-Path $Out ("t$i.txt"); [IO.File]::WriteAllText($tf, $s.titulo, $utf8)
  # nota: dentro de @( ) a vírgula tem prioridade sobre "+", por isso cada drawtext é acrescentado com +=
  $filtros = @("drawbox=x=0:y=0:w=1280:h=10:color=0xa1823a:t=fill", "drawbox=x=90:y=170:w=8:h=300:color=0xa1823a:t=fill")
  $filtros += "drawtext=fontfile='$fontB':textfile='" + ($tf -replace '\\', '/' -replace ':', '\:') + "':fontsize=58:fontcolor=white:x=130:y=175"
  $y = 275
  for ($k = 0; $k -lt $s.linhas.Count; $k++) {
    # sem literais não-ASCII no .ps1 (o PowerShell 5.1 lê ficheiros sem BOM como ANSI): bullet = U+2022
    $lf = Join-Path $Out ("l$i-$k.txt"); [IO.File]::WriteAllText($lf, [string][char]0x2022 + "  " + $s.linhas[$k], $utf8)
    $filtros += "drawtext=fontfile='$fontR':textfile='" + ($lf -replace '\\', '/' -replace ':', '\:') + "':fontsize=32:fontcolor=0xe2e8f0:x=130:y=$y"
    $y += 62
  }
  $rf = Join-Path $Out 'rodape.txt'; [IO.File]::WriteAllText($rf, 'Universidade Corporativa  ' + [char]0x00B7 + '  SGA ' + [char]0x2014 + ' Sociedade Gestora de Aeroportos', $utf8)
  $filtros += "drawtext=fontfile='$fontR':textfile='" + ($rf -replace '\\', '/' -replace ':', '\:') + "':fontsize=20:fontcolor=0x94a3b8:x=130:y=660"
  $nf = Join-Path $Out ("n$i.txt"); [IO.File]::WriteAllText($nf, ("{0} / {1}" -f ($i + 1), $n), $utf8)
  $filtros += "drawtext=fontfile='$fontR':textfile='" + ($nf -replace '\\', '/' -replace ':', '\:') + "':fontsize=20:fontcolor=0x94a3b8:x=1150:y=660"
  $png = Join-Path $Out ("slide$i.png")
  $vf = ($filtros -join ",")
  & $ff -hide_banner -loglevel warning -y -f lavfi -i "color=c=0x1e3a5f:s=1280x720:d=1" -vf $vf -frames:v 1 -update 1 $png 2>&1 | ForEach-Object { "ffmpeg: $_" }
  if (-not (Test-Path $png)) { throw "falhou o slide $i" }
}
# 2) vídeo com transições xfade + faixa de áudio silenciosa
$args = @('-hide_banner', '-loglevel', 'error', '-y')
for ($i = 0; $i -lt $n; $i++) { $args += @('-loop', '1', '-t', "$d", '-i', (Join-Path $Out "slide$i.png")) }
$args += @('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo')
$fc = ''; $prev = '[0:v]'
for ($i = 1; $i -lt $n; $i++) {
  $off = [math]::Round($i * $d - $i * $tr, 2)
  $lab = "[v$i]"; $fc += "$prev[$($i):v]xfade=transition=fade:duration=$tr`:offset=$off$lab;"; $prev = $lab
}
$fc = $fc.TrimEnd(';')
$mp4 = Join-Path $Out 'universidade-corporativa-apresentacao.mp4'
$total = [math]::Round($n * $d - ($n - 1) * $tr, 2)
$args += @('-filter_complex', $fc, '-map', $prev, '-map', "$($n):a", '-t', "$total", '-r', '25', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', $mp4)
& $ff @args
if (-not (Test-Path $mp4)) { throw 'falhou o vídeo' }
# 3) poster
& $ff -hide_banner -loglevel error -y -i (Join-Path $Out 'slide0.png') -frames:v 1 -q:v 3 (Join-Path $Out 'universidade-corporativa-apresentacao_poster.jpg')
# 4) legendas WebVTT (narração por slide)
$vtt = "WEBVTT`n`n"
$fmt = { param($t) $ts = [TimeSpan]::FromSeconds($t); '{0:00}:{1:00}:{2:00}.{3:000}' -f $ts.Hours, $ts.Minutes, $ts.Seconds, $ts.Milliseconds }
for ($i = 0; $i -lt $n; $i++) {
  $ini = [math]::Max(0, $i * ($d - $tr)); $fim = [math]::Min($total, $ini + $d - $tr - 0.2)
  $vtt += "$($i + 1)`n$(& $fmt $ini) --> $(& $fmt $fim)`n$($cfg.slides[$i].narracao)`n`n"
}
[IO.File]::WriteAllText((Join-Path $Out 'universidade-corporativa-apresentacao.vtt'), $vtt, $utf8)
Get-ChildItem $Out -Include *.mp4, *.jpg, *.vtt -Recurse | Select-Object Name, @{n='KB';e={[math]::Round($_.Length/1KB)}}
"duração: $total s"
