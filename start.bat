@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "PHP_EXE=C:\xampp\php\php.exe"

if not exist "%PHP_EXE%" (
    echo PHP tidak ditemukan di "%PHP_EXE%".
    echo Ubah PHP_EXE di file start.bat sesuai lokasi XAMPP Anda.
    pause
    exit /b 1
)

echo Server API berjalan di http://localhost:8000
echo Pastikan MySQL XAMPP sudah aktif.
echo Tekan Ctrl+C untuk menghentikan server.
"%PHP_EXE%" -S 127.0.0.1:8000 -t "%PROJECT_DIR%" "%PROJECT_DIR%router.php"

endlocal
