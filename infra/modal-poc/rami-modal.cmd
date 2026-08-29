@echo off
REM Thin wrapper — uses isolated .venv-modal, never prints secrets
set ROOT=%~dp0..\..
"%ROOT%\.venv-modal\Scripts\python.exe" "%~dp0control.py" %*
