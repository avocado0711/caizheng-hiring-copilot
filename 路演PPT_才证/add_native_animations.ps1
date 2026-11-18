param(
  [Parameter(Mandatory = $true)]
  [string]$PptPath,
  [Parameter(Mandatory = $true)]
  [string]$MapPath
)

$ErrorActionPreference = "Stop"
$app = New-Object -ComObject PowerPoint.Application

function Get-ShapeText {
  param($Shape)
  try {
    if ($Shape.HasTextFrame -eq -1 -and $Shape.TextFrame.HasText -eq -1) {
      return (($Shape.TextFrame.TextRange.Text -replace "\r", "`n") -replace "\s+", " ").Trim()
    }
  } catch {
    return ""
  }
  return ""
}

function Find-ShapeByText {
  param($Slide, [string]$Needle)
  $normalizedNeedle = (($Needle -replace "\r", "`n") -replace "\s+", " ").Trim()
  for ($index = 1; $index -le $Slide.Shapes.Count; $index += 1) {
    $shape = $Slide.Shapes.Item($index)
    $text = Get-ShapeText $shape
    if ($text -and $text.Contains($normalizedNeedle)) {
      return $shape
    }
  }
  return $null
}

function Add-Fade {
  param($Slide, [string]$Needle, [double]$Duration = 0.30, [double]$Delay = 0.03)
  $shape = Find-ShapeByText -Slide $Slide -Needle $Needle
  if (-not $shape) {
    Write-Warning "Slide $($Slide.SlideIndex): missing text target: $Needle"
    return
  }
  $effect = $Slide.TimeLine.MainSequence.AddEffect($shape, 10, 0, 3)
  $effect.Timing.Duration = $Duration
  $effect.Timing.TriggerDelayTime = $Delay
  try {
    $effect.Timing.SmoothStart = -1
    $effect.Timing.SmoothEnd = -1
  } catch {
  }
}

function Add-ScreenshotFades {
  param($Slide)
  $pictures = @()
  for ($index = 1; $index -le $Slide.Shapes.Count; $index += 1) {
    $shape = $Slide.Shapes.Item($index)
    if ($shape.Type -eq 13 -and $shape.Top -gt 100) {
      $pictures += $shape
    }
  }
  $pictures = $pictures | Sort-Object Top, Left
  foreach ($picture in $pictures) {
    $effect = $Slide.TimeLine.MainSequence.AddEffect($picture, 10, 0, 3)
    $effect.Timing.Duration = 0.36
    $effect.Timing.TriggerDelayTime = 0.05
  }
}

function Clear-Animations {
  param($Slide)
  $sequence = $Slide.TimeLine.MainSequence
  while ($sequence.Count -gt 0) {
    $sequence.Item(1).Delete()
  }
}

try {
  $mapText = [IO.File]::ReadAllText($MapPath, [Text.Encoding]::UTF8)
  $targets = $mapText | ConvertFrom-Json
  $presentation = $app.Presentations.Open($PptPath, $false, $false, $true)
  $app.Visible = -1

  foreach ($slide in $presentation.Slides) {
    Clear-Animations -Slide $slide
    try {
      $slide.SlideShowTransition.EntryEffect = 1793
      $slide.SlideShowTransition.Duration = 0.22
    } catch {
      Write-Warning "Slide $($slide.SlideIndex): transition not applied"
    }
  }

  foreach ($entry in $targets.PSObject.Properties) {
    $slideNumber = [int]$entry.Name
    if ($slideNumber -lt 1 -or $slideNumber -gt $presentation.Slides.Count) {
      continue
    }
    $slide = $presentation.Slides.Item($slideNumber)
    foreach ($needle in @($entry.Value)) {
      Add-Fade -Slide $slide -Needle ([string]$needle) -Duration 0.28 -Delay 0.04
    }
    if ($slideNumber -eq 8) {
      Add-ScreenshotFades $slide
    }
  }

  $presentation.Save()
  for ($number = 1; $number -le $presentation.Slides.Count; $number += 1) {
    $slide = $presentation.Slides.Item($number)
    "slide=$number effects=$($slide.TimeLine.MainSequence.Count)"
  }
  $presentation.Close()
} finally {
  $app.Quit()
}
