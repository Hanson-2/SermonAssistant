# Enhanced PowerShell script to restore ALL files from commit c463b7aa4111336c4ef2378215c5c81251bf8cfb
# This script will properly handle .md, .js, .cjs, .html and all other files

$commitHash = "c463b7aa4111336c4ef2378215c5c81251bf8cfb"
$excludedFiles = @(
    "src/components/SplashScreen.jsx",
    "src/styles/splashScreen.css"
)

Write-Host "Enhanced file restoration script" -ForegroundColor Cyan
Write-Host "Commit: $commitHash" -ForegroundColor Yellow

# Get all files from the commit, excluding the commit message lines
$rawOutput = git show --name-only $commitHash
$allFiles = $rawOutput | Where-Object { 
    $_.Trim() -ne "" -and 
    $_ -notmatch "^commit" -and 
    $_ -notmatch "^Author:" -and 
    $_ -notmatch "^Date:" -and 
    $_ -notmatch "^\s*Refactor SplashScreen" -and
    $_ -notmatch "^\s*$"
}

Write-Host "`nFiles to restore:" -ForegroundColor Green
$allFiles | ForEach-Object { Write-Host "  $_" }

Write-Host "`nBeginning restoration..." -ForegroundColor Yellow

$successCount = 0
$errorCount = 0
$skippedCount = 0

foreach ($file in $allFiles) {
    if ($excludedFiles -contains $file) {
        Write-Host "SKIPPED: $file (already handled)" -ForegroundColor Gray
        $skippedCount++
        continue
    }
    
    try {
        # Check if file exists in the commit
        $null = git show "${commitHash}:${file}" 2>$null
        if ($LASTEXITCODE -eq 0) {
            # Create directory if it doesn't exist
            $directory = Split-Path $file -Parent
            if ($directory -and !(Test-Path $directory)) {
                New-Item -ItemType Directory -Path $directory -Force | Out-Null
                Write-Host "Created directory: $directory" -ForegroundColor Blue
            }
            
            # Restore the file with proper encoding
            $fileContent = git show "${commitHash}:${file}"
            $fileContent | Out-File -FilePath $file -Encoding UTF8 -Force
            
            # Verify the file was actually written
            if (Test-Path $file) {
                Write-Host "RESTORED: $file" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "ERROR: Failed to write $file" -ForegroundColor Red
                $errorCount++
            }
        } else {
            Write-Host "ERROR: File not found in commit - $file" -ForegroundColor Red
            $errorCount++
        }
    }
    catch {
        Write-Host "ERROR: Exception restoring $file - $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "RESTORATION SUMMARY:" -ForegroundColor Cyan
Write-Host "Successfully restored: $successCount files" -ForegroundColor Green
Write-Host "Errors: $errorCount files" -ForegroundColor Red
Write-Host "Skipped: $skippedCount files" -ForegroundColor Gray
Write-Host "Total processed: $($successCount + $errorCount + $skippedCount) files" -ForegroundColor Yellow
Write-Host "="*60 -ForegroundColor Cyan

if ($errorCount -eq 0) {
    Write-Host "`nAll files restored successfully! ✓" -ForegroundColor Green
} else {
    Write-Host "`nSome files had errors. Check the output above." -ForegroundColor Yellow
}
