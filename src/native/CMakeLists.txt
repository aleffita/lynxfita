cmake_minimum_required(VERSION 3.20)
project(lynxfita_native VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Threads REQUIRED)

# Include paths
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# LynxFita Native Core Library
add_library(lynxfita_native STATIC
    src/hermes_runtime_adapter.cc
    src/legacy_bridge_interceptor.cc
    src/wasi_host_module.cc
    src/dma_eib_engine.cc
    src/coroutine_scheduler.cc
    src/protobuf_bridge.cc
    src/hermes_compiler.cc
)

target_include_directories(lynxfita_native PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)

target_link_libraries(lynxfita_native PUBLIC
    Threads::Threads
)

# LynxFita Native Test Runner Executable
enable_testing()

add_executable(lynxfita_native_tests
    tests/test_runner.cc
)

target_link_libraries(lynxfita_native_tests PRIVATE
    lynxfita_native
    Threads::Threads
)

add_test(NAME LynxFitaNativeTests COMMAND lynxfita_native_tests)

# LynxFita Explorer Standalone Executable
add_executable(lynxfita_explorer
    src/explorer_main.cc
)

target_link_libraries(lynxfita_explorer PRIVATE
    lynxfita_native
    Threads::Threads
)

