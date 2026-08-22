# OpenWrt ARM (Cortex-A7 / armhf) cross toolchain file.
# Set CMAKE_PREFIX_PATH to $STAGING_DIR/usr when invoking cmake.
# Example target: sunxi/cortexa7 (NanoPi NEO, FriendlyWrt 19.07)

set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)

if(NOT DEFINED ENV{STAGING_DIR})
  message(FATAL_ERROR "Set STAGING_DIR to OpenWrt staging_dir target path")
endif()

set(TOOLCHAIN_PREFIX arm-openwrt-linux-muslgnueabi)
if(DEFINED ENV{TOOLCHAIN_PREFIX})
  set(TOOLCHAIN_PREFIX $ENV{TOOLCHAIN_PREFIX})
endif()

set(CMAKE_C_COMPILER ${TOOLCHAIN_PREFIX}-gcc)
set(CMAKE_CXX_COMPILER ${TOOLCHAIN_PREFIX}-g++)

set(CMAKE_FIND_ROOT_PATH $ENV{STAGING_DIR}/usr)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Os -pipe -march=armv7-a -mtune=cortex-a7")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Os -pipe -march=armv7-a -mtune=cortex-a7")
