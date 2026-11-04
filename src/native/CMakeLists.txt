cmake_minimum_required(VERSION 3.20)
project(lynxfita_native VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Include paths
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# LynxFita Native Core Library
add_library(lynxfita_native STATIC
    src/hermes_runtime_adapter.cc
    src/legacy_bridge_interceptor.cc
    src/wasi_host_module.cc
)

target_include_directories(lynxfita_native PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)

# LynxFita Native Test Runner Executable
enable_testing()

add_executable(lynxfita_native_tests
    tests/test_runner.cc
)

target_link_libraries(lynxfita_native_tests PRIVATE
    lynxfita_native
)

add_test(NAME LynxFitaNativeTests COMMAND lynxfita_native_tests)
