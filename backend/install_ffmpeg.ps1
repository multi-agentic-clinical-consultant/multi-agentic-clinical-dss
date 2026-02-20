$ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$zipPath = "$env:TEMP\ffmpeg.zip"
$installPath = "$env:USERPROFILE\ffmpeg"

Write-Host "Downloading FFmpeg from $ffmpegUrl..."
Invoke-WebRequest -Uri $ffmpegUrl -OutFile $zipPath

if (-not (Test-Path $zipPath)) {
    Write-Error "Download failed!"
    exit 1
}

Write-Host "Extracting to $installPath..."
if (Test-Path $installPath) {
    Remove-Item -Path $installPath -Recurse -Force
}
Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\ffmpeg_extracted" -Force

$extractedFolder = Get-ChildItem "$env:TEMP\ffmpeg_extracted" | Select-Object -First 1
Move-Item -Path "$($extractedFolder.FullName)" -Destination $installPath -Force

$binPath = "$installPath\bin"
Write-Host "FFmpeg installed at $installPath"
Write-Host "Bin path: $binPath"

# Add to User PATH persistently
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$binPath*") {
    Write-Host "Adding to User PATH..."
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$binPath", "User")
    Write-Host "Added to PATH. You may need to restart your terminal/IDE."
} else {
    Write-Host "Already in PATH."
}

# Add to Process PATH so we can use it immediately in this session (if possible)
$env:Path += ";$binPath"

# Verify
& "$binPath\ffmpeg.exe" -version
