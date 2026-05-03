@echo off
set EXPO_NO_TELEMETRY=1
cd /d C:\CodexApp
"C:\Program Files\nodejs\npx.cmd" expo start --host localhost
