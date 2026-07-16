@echo off
cd /d "%~dp0"
set PORT=18088
"C:\Program Files\nodejs\node.exe" server\src\index.js >> srpm-v19-local.out.log 2>> srpm-v19-local.err.log
