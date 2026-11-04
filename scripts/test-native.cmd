@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" || exit /b 1
cmake -B build/native -S src/native -G Ninja -DCMAKE_BUILD_TYPE=Release || exit /b 1
cmake --build build/native || exit /b 1
build\native\lynxfita_native_tests.exe || exit /b 1
