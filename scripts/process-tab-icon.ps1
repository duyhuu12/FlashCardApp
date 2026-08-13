param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
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
    $greenScore = $pixel.G - [Math]::Max($pixel.R, $pixel.B)
    if ($greenScore -ge 100) {
      $alpha = 0
    } elseif ($greenScore -le 25) {
      $alpha = 255
    } else {
      $alpha = [int](255 * (100 - $greenScore) / 75)
    }

    $despilledGreen = if ($alpha -lt 255) {
      [Math]::Min($pixel.G, [Math]::Max($pixel.R, $pixel.B))
    } else {
      $pixel.G
    }
    $transparent.SetPixel(
      $x,
      $y,
      [System.Drawing.Color]::FromArgb($alpha, $pixel.R, $despilledGreen, $pixel.B)
    )

    if ($alpha -gt 8) {
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

if ($maxX -lt $minX -or $maxY -lt $minY) {
  throw "No visible icon pixels found in $InputPath"
}

$cropWidth = $maxX - $minX + 1
$cropHeight = $maxY - $minY + 1
$targetSize = 128
$padding = 8
$available = $targetSize - (2 * $padding)
$scale = [Math]::Min($available / $cropWidth, $available / $cropHeight)
$drawWidth = [int]($cropWidth * $scale)
$drawHeight = [int]($cropHeight * $scale)
$drawX = [int](($targetSize - $drawWidth) / 2)
$drawY = [int](($targetSize - $drawHeight) / 2)

$output = [System.Drawing.Bitmap]::new(
  $targetSize,
  $targetSize,
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
