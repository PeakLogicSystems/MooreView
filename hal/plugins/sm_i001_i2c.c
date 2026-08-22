/**
 * Linux I2C helpers for Raspberry Pi (i2c-dev). Pattern from Sequent megaind comm.c.
 */
#include "sm_i001_i2c.h"

#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

#define I2C_BLOCK_MAX 512

int sm_i001_i2c_open(int bus, int slave_addr) {
  char path[32];
  int fd;

  snprintf(path, sizeof(path), "/dev/i2c-%d", bus);
  fd = open(path, O_RDWR);
  if (fd < 0) return -1;
  if (ioctl(fd, I2C_SLAVE, slave_addr) < 0) {
    close(fd);
    return -1;
  }
  return fd;
}

void sm_i001_i2c_close(int fd) {
  if (fd >= 0) close(fd);
}

int sm_i001_i2c_read8(int fd, int reg, uint8_t* buf, int len) {
  uint8_t addr;

  if (!buf || len <= 0 || len > I2C_BLOCK_MAX) return -1;
  addr = (uint8_t)(reg & 0xff);
  if (write(fd, &addr, 1) != 1) return -1;
  if (read(fd, buf, len) != len) return -1;
  return 0;
}

int sm_i001_i2c_write8(int fd, int reg, const uint8_t* buf, int len) {
  uint8_t block[I2C_BLOCK_MAX];

  if (!buf || len <= 0 || len > I2C_BLOCK_MAX - 1) return -1;
  block[0] = (uint8_t)(reg & 0xff);
  memcpy(&block[1], buf, (size_t)len);
  if (write(fd, block, (size_t)len + 1) != len + 1) return -1;
  return 0;
}
