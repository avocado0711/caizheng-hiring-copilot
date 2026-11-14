param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object {
    $_.Name -eq "AsTask" -and
    $_.IsGenericMethod -and
    $_.GetParameters().Count -eq 1
  } |
  Select-Object -First 1

function Await-WinRT($operation, [Type]$resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait()
  return $task.Result
}

function Set-ExifOrientation([System.Drawing.Image]$Image) {
  try {
    if (-not ($Image.PropertyIdList -contains 274)) { return }
    $orientation = [BitConverter]::ToUInt16($Image.GetPropertyItem(274).Value, 0)
    switch ($orientation) {
      2 { $Image.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
      3 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      4 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipX) }
      5 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
      6 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      7 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
      8 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
  } catch {
    # Some image decoders expose an EXIF property without a readable value.
  }
}

function New-OcrReadyImage([string]$SourcePath) {
  $image = [System.Drawing.Image]::FromFile($SourcePath)
  try {
    Set-ExifOrientation $image
    $originalWidth = $image.Width
    $originalHeight = $image.Height
    $minimumEdge = [Math]::Min($originalWidth, $originalHeight)
    $scale = if ($minimumEdge -lt 500) { 3 } elseif ($minimumEdge -lt 1200) { 2 } else { 1 }
    $pixelLimitScale = [Math]::Sqrt(12000000 / [double]($originalWidth * $originalHeight))
    $scale = [Math]::Max(0.5, [Math]::Min($scale, $pixelLimitScale))
    $targetWidth = [Math]::Max(1, [int][Math]::Round($originalWidth * $scale))
    $targetHeight = [Math]::Max(1, [int][Math]::Round($originalHeight * $scale))

    $bitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.DrawImage($image, 0, 0, $targetWidth, $targetHeight)
    } finally {
      $graphics.Dispose()
    }

    $preparedPath = Join-Path ([System.IO.Path]::GetTempPath()) ("hireproof-ocr-" + [guid]::NewGuid().ToString("N") + ".png")
    $bitmap.Save($preparedPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    return [PSCustomObject]@{
      Path = $preparedPath
      Scale = [Math]::Round($scale, 3)
      OriginalWidth = $originalWidth
      OriginalHeight = $originalHeight
      ProcessedWidth = $targetWidth
      ProcessedHeight = $targetHeight
    }
  } finally {
    $image.Dispose()
  }
}

$prepared = New-OcrReadyImage $Path
try {
$file = Await-WinRT ([Windows.Storage.StorageFile]::GetFileFromPathAsync($prepared.Path)) ([Windows.Storage.StorageFile])
$stream = Await-WinRT ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await-WinRT ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$language = [Windows.Globalization.Language]::new("zh-Hans")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if ($null -eq $engine) {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if ($null -eq $engine) {
  throw "Windows OCR 引擎不可用，请安装简体中文 OCR 语言功能"
}

$result = Await-WinRT ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$lines = @()
foreach ($line in $result.Lines) {
  $rectangles = @($line.Words | ForEach-Object { $_.BoundingRect } | Where-Object { $null -ne $_ })
  $x = $null
  $y = $null
  $width = $null
  $height = $null
  if ($rectangles.Count -gt 0) {
    $left = ($rectangles | ForEach-Object { $_.X } | Measure-Object -Minimum).Minimum
    $top = ($rectangles | ForEach-Object { $_.Y } | Measure-Object -Minimum).Minimum
    $right = ($rectangles | ForEach-Object { $_.X + $_.Width } | Measure-Object -Maximum).Maximum
    $bottom = ($rectangles | ForEach-Object { $_.Y + $_.Height } | Measure-Object -Maximum).Maximum
    $divisor = if ($prepared.Scale -gt 0) { $prepared.Scale } else { 1 }
    $x = [Math]::Round($left / $divisor, 1)
    $y = [Math]::Round($top / $divisor, 1)
    $width = [Math]::Round(($right - $left) / $divisor, 1)
    $height = [Math]::Round(($bottom - $top) / $divisor, 1)
  }
  $lines += [PSCustomObject]@{
    text = $line.Text
    x = $x
    y = $y
    width = $width
    height = $height
  }
}
$payload = [PSCustomObject]@{
  text = (($lines | ForEach-Object { $_.text }) -join "`n")
  language = $engine.RecognizerLanguage.LanguageTag
  lineCount = $lines.Count
  preprocess = [PSCustomObject]@{
    scale = $prepared.Scale
    originalWidth = $prepared.OriginalWidth
    originalHeight = $prepared.OriginalHeight
    processedWidth = $prepared.ProcessedWidth
    processedHeight = $prepared.ProcessedHeight
  }
  lines = $lines
}
$payload | ConvertTo-Json -Compress
} finally {
  Remove-Item -LiteralPath $prepared.Path -Force -ErrorAction SilentlyContinue
}
