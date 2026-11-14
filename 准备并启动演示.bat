@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在准备标准演示数据，现有数据会先备份到 data\backups...
node scripts\demo_seed.js
if errorlevel 1 (
  echo.
  echo 演示数据准备失败。请确认已安装 Node.js 20 或更高版本。
  pause
  exit /b 1
)
node server.js --open-edge --phone-demo --fresh-demo
if errorlevel 1 pause
