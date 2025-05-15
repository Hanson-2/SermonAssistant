# PowerShell Script: clean-and-run.ps1

Write-Host "Stopping any running Node processes..."
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }

Write-Host "Cleaning node_modules and package-lock.json..."
Remove-Item -Recurse -Force "node_modules"
Remove-Item -Force "package-lock.json"

Write-Host "Reinstalling packages..."
npm install

Write-Host "Starting development server..."
npm run dev
