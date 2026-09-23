Add-Type -AssemblyName System.Drawing
$assetRoot=Join-Path $PSScriptRoot '../assets'
New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null
foreach($kind in @('icon','splash')) {
 $bitmap=[Drawing.Bitmap]::new(1024,1024)
 $graphics=[Drawing.Graphics]::FromImage($bitmap)
 $graphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $graphics.Clear([Drawing.ColorTranslator]::FromHtml($(if($kind -eq 'icon'){'#CE3267'}else{'#FBEFF2'})))
 $graphics.TranslateTransform(256,256)
 $graphics.ScaleTransform(21.3333,21.3333)
 $path=[Drawing.Drawing2D.GraphicsPath]::new()
 $path.AddBezier(12,3,13,8,18,9,18,14)
 $path.AddBezier(18,14,18,22,6,22,6,14)
 $path.AddBezier(6,14,6,12,7,10,9,8)
 $path.AddBezier(9,8,9,11,11,12,12,12)
 $path.AddBezier(12,12,14,9,13,6,12,3)
 $path.CloseFigure()
 $pen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml($(if($kind -eq 'icon'){'#FFFFFF'}else{'#CE3267'})),1.8)
 $pen.StartCap=[Drawing.Drawing2D.LineCap]::Round
 $pen.EndCap=[Drawing.Drawing2D.LineCap]::Round
 $pen.LineJoin=[Drawing.Drawing2D.LineJoin]::Round
 $graphics.DrawPath($pen,$path)
 $bitmap.Save((Join-Path $assetRoot ($kind+'.png')),[Drawing.Imaging.ImageFormat]::Png)
 $pen.Dispose();$path.Dispose();$graphics.Dispose();$bitmap.Dispose()
}
