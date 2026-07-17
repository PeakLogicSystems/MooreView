#pragma once
#include <stdint.h>
#include <stddef.h>

#ifndef MV_BC_MAX
#define MV_BC_MAX 16384
#endif

/** Magic 'MVBC' — keep in sync with est-pc/src/engine/stOpcodes.js */
#define MV_BC_MAGIC_0 'M'
#define MV_BC_MAGIC_1 'V'
#define MV_BC_MAGIC_2 'B'
#define MV_BC_MAGIC_3 'C'

bool mvBcLoad(const uint8_t* data, size_t len, char* err, size_t errLen);
void mvBcRunProgram();
void mvBcClear();
bool mvBcHasProgram();
size_t mvBcBytes();
uint16_t mvBcTagCount();
uint16_t mvBcCodeBytes();
uint16_t mvBcDataBytes();
uint16_t mvBcMaxBytes();
void mvBcOneShotReset();
