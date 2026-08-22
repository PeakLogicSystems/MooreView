cmake_minimum_required(VERSION 3.14)
project(mooreview_sdk VERSION 1.0.0 LANGUAGES C CXX)

option(MOOREVIEW_SDK_BUILD_EXAMPLES "Build SDK examples" ON)
option(MOOREVIEW_SDK_BUILD_SHARED "Build shared library" OFF)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

find_package(CURL REQUIRED)

add_library(mooreview_cjson STATIC third_party/cjson/cJSON.c)
target_include_directories(mooreview_cjson PUBLIC third_party/cjson)

set(MOOREVIEW_SDK_SOURCES
  src/types.cpp
  src/json_helpers.cpp
  src/http_curl.cpp
  src/client.cpp
  src/reporter.cpp
)

if(MOOREVIEW_SDK_BUILD_SHARED)
  add_library(mooreview_sdk SHARED ${MOOREVIEW_SDK_SOURCES})
else()
  add_library(mooreview_sdk STATIC ${MOOREVIEW_SDK_SOURCES})
endif()

target_include_directories(mooreview_sdk
  PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/cjson
)

target_link_libraries(mooreview_sdk
  PUBLIC mooreview_cjson
  PRIVATE CURL::libcurl
)

add_library(mooreview::sdk ALIAS mooreview_sdk)

if(MOOREVIEW_SDK_BUILD_EXAMPLES)
  add_executable(mv_poll_tags examples/poll_tags.cpp)
  target_link_libraries(mv_poll_tags PRIVATE mooreview_sdk)

  add_executable(mv_runtime_control examples/runtime_control.cpp)
  target_link_libraries(mv_runtime_control PRIVATE mooreview_sdk)

  add_executable(mv_parc_reporter examples/parc_reporter.cpp)
  target_link_libraries(mv_parc_reporter PRIVATE mooreview_sdk)
  find_package(Threads REQUIRED)
  target_link_libraries(mv_parc_reporter PRIVATE Threads::Threads)
endif()

install(TARGETS mooreview_sdk mooreview_cjson
  ARCHIVE DESTINATION lib
  LIBRARY DESTINATION lib
)
install(DIRECTORY include/mooreview DESTINATION include)
