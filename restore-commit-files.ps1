# PowerShell script to restore files from commit c463b7aa4111336c4ef2378215c5c81251bf8cfb
# Excluding files already handled: SplashScreen.jsx and splashScreen.css

$commitHash = "c463b7aa4111336c4ef2378215c5c81251bf8cfb"
$excludedFiles = @(
    "src/components/SplashScreen.jsx",
    "src/styles/splashScreen.css"
)

# Get all files from the commit
$allFiles = git show --name-only $commitHash | Where-Object { $_.Trim() -ne "" -and $_ -notmatch "^commit|^Author|^Date|^\s*$" }

Write-Host "Files in commit $commitHash" -ForegroundColor Green
$allFiles | ForEach-Object { Write-Host "  $_" }

Write-Host "`nRestoring files (excluding already handled ones)..." -ForegroundColor Yellow

foreach ($file in $allFiles) {
    if ($excludedFiles -contains $file) {
        Write-Host "Skipping $file (already handled)" -ForegroundColor Gray
        continue
    }
    
    try {
        # Check if file exists in the commit
        $fileContent = git show "${commitHash}:${file}" 2>$null
        if ($LASTEXITCODE -eq 0) {
            # Create directory if it doesn't exist
            $directory = Split-Path $file -Parent
            if ($directory -and !(Test-Path $directory)) {
                New-Item -ItemType Directory -Path $directory -Force | Out-Null
            }
            
            # Restore the file
            git show "${commitHash}:${file}" | Out-File -FilePath $file -Encoding UTF8
            Write-Host "Restored: $file" -ForegroundColor Green
        } else {
            Write-Host "File not found in commit: $file" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "Error restoring $file : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nFile restoration complete!" -ForegroundColor Green
Write-Host "Files excluded (already handled): $($excludedFiles -join ', ')" -ForegroundColor Yellow
