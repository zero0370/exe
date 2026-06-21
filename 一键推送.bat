@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

echo ============================
echo   理论exe - 安全推送
echo ============================
echo.

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo 当前目录不是 Git 仓库，已取消。
    pause
    exit /b 1
)

if "%~1"=="" (
    set /p "msg=请输入提交说明："
) else (
    set "msg=%~1"
)

if "%msg%"=="" (
    echo 提交说明不能为空，已取消。
    pause
    exit /b 1
)

echo.
echo [1/6] 清理暂存区，避免带入上次误暂存内容...
git reset -q
if errorlevel 1 goto fail

echo.
echo [2/6] 暂存已跟踪文件的修改（不自动暂存删除和新增文件）...
for /f "delims=" %%f in ('git diff --name-only --diff-filter=ACMRT') do (
    git add -- "%%f"
)
if errorlevel 1 goto fail

echo.
echo [3/6] 未跟踪的新文件如下（默认不会提交）：
set "has_untracked="
for /f "delims=" %%f in ('git ls-files --others --exclude-standard') do (
    echo   %%f
    set "has_untracked=1"
)

if defined has_untracked (
    echo.
    choice /C YN /N /M "是否需要手动添加有用的新文件？[Y/N] "
    if errorlevel 2 goto after_new_files

    :add_new_file
    set "newfile="
    set /p "newfile=输入要添加的新文件路径（直接回车结束）："
    if "%newfile%"=="" goto after_new_files
    git add -- "%newfile%"
    if errorlevel 1 goto fail
    goto add_new_file
) else (
    echo   无
)

:after_new_files
echo.
echo [4/6] 检查暂存区是否包含明显垃圾文件...
set "push_list=%TEMP%\git_push_files_%RANDOM%.txt"
git diff --cached --name-only > "%push_list%"

for %%A in ("%push_list%") do (
    if %%~zA EQU 0 (
        del "%push_list%" >nul 2>&1
        echo 没有可提交的文件，已取消。
        pause
        exit /b 0
    )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$bad=@(); Get-Content -LiteralPath $env:push_list | ForEach-Object { if ($_ -match '(^|/)(node_modules|build|dist|dist-new|out|\.idea|\.vscode|\.qoder)(/|$)' -or $_ -match '\.(log|apk|exe|dmg|blockmap|tmp)$' -or $_ -match '解压/') { $bad += $_ } }; if ($bad.Count -gt 0) { Write-Host '发现疑似垃圾文件，已阻止提交：'; $bad | ForEach-Object { Write-Host ('  ' + $_) }; exit 1 }"
if errorlevel 1 (
    del "%push_list%" >nul 2>&1
    pause
    exit /b 1
)
del "%push_list%" >nul 2>&1

echo.
echo [5/6] 本次将提交以下文件：
git diff --cached --name-status
echo.
choice /C YN /N /M "确认提交并推送？[Y/N] "
if errorlevel 2 (
    echo 已取消。
    pause
    exit /b 0
)

echo.
echo [6/6] 正在提交并推送...
git commit -m "%msg%"
if errorlevel 1 goto fail

git push origin main
if errorlevel 1 goto fail

echo.
echo 推送成功。
pause
exit /b 0

:fail
echo.
echo 操作失败，请检查上方错误信息。
pause
exit /b 1
