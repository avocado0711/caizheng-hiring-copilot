@echo off
chcp 65001 >nul
cd /d "%~dp0"
node server.js --open-edge --phone-demo
if errorlevel 1 pause
