param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [ValidateSet('Green', 'Magenta', 'None')][string]$KeyColor = 'Green',
  [int]$TargetSize = 128,
  [int]$Padding = 8,
  [switch]$NoTrim
)

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Bitmap]::new($InputPath)
$transparent = [System.Drawing.Bitmap]::new(
  $source.Width,
  $source.Height,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)

$minX = $source.Width
$minY = $source.Height
$maxX = -1
$maxY = -1

for ($y = 0; $y -lt $source.Height; $y++) {
  for ($x = 0; $x -lt $source.Width; $x++) {
    $pixel = $source.GetPixel($x, $y)
    $keyScore = switch ($KeyColor) {
      'Green' { $pixel.G - [Math]::Max($pixel.R, $pixel.B) }
      'Magenta' { [Math]::Min($pixel.R, $pixel.B) - $pixel.G }
      default { -1 }
    }

    if ($KeyColor -eq 'None' -or $keyScore -le 25) {
      $keyAlpha = 255
    } elseif ($keyScore -ge 100) {
      $keyAlpha = 0
    } else {
      $keyAlpha = [int](255 * (100 - $keyScore) / 75)
    }
    $alpha = [int]($pixel.A * $keyAlpha / 255)

    $red = $pixel.R
    $green = $pixel.G
    $blue = $pixel.B
    if ($keyAlpha -lt 255 -and $KeyColor -eq 'Green') {
      $green = [Math]::Min($pixel.G, [Math]::Max($pixel.R, $pixel.B))
    } elseif ($keyAlpha -lt 255 -and $KeyColor -eq 'Magenta') {
      $red = [Math]::Min($pixel.R, $pixel.G)
      $blue = [Math]::Min($pixel.B, $pixel.G)
    }
    $transparent.SetPixel(
      $x,
      $y,
      [System.Drawing.Color]::FromArgb($alpha, $red, $green, $blue)
    )

    if ($alpha -gt 8) {
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

if ($NoTrim) {
  $minX = 0
  $minY = 0
  $maxX = $source.Width - 1
  $maxY = $source.Height - 1
}

if ($maxX -lt $minX -or $maxY -lt $minY) {
  throw "No visible icon pixels found in $InputPath"
}

$cropWidth = $maxX - $minX + 1
$cropHeight = $maxY - $minY + 1
$available = $TargetSize - (2 * $Padding)
$scale = [Math]::Min($available / $cropWidth, $available / $cropHeight)
$drawWidth = [int]($cropWidth * $scale)
$drawHeight = [int]($cropHeight * $scale)
$drawX = [int](($TargetSize - $drawWidth) / 2)
$drawY = [int](($TargetSize - $drawHeight) / 2)

$output = [System.Drawing.Bitmap]::new(
  $TargetSize,
  $TargetSize,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($output)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$destination = [System.Drawing.Rectangle]::new($drawX, $drawY, $drawWidth, $drawHeight)
$sourceRectangle = [System.Drawing.Rectangle]::new($minX, $minY, $cropWidth, $cropHeight)
$graphics.DrawImage($transparent, $destination, $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}
$output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$output.Dispose()
$transparent.Dispose()
$source.Dispose()

Write-Output $OutputPath
