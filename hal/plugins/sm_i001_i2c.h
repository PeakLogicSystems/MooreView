#ifndef SM_I001_I2C_H
#define SM_I001_I2C_H

#include <stdint.h>

/** Open /dev/i2c-N and select slave address. Returns fd or -1. */
int sm_i001_i2c_open(int bus, int slave_addr);

void sm_i001_i2c_close(int fd);

int sm_i001_i2c_read8(int fd, int reg, uint8_t* buf, int len);

int sm_i001_i2c_write8(int fd, int reg, const uint8_t* buf, int len);

#endif
