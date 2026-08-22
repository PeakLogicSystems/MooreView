# MooreVIEW HAL board plugins (build on Linux / Raspberry Pi OS).
#
#   make              # example in-memory plugin
#   make sm_i001      # Sequent SM-I-001 on Raspberry Pi 4
#   sudo make install-sm_i001

CC      ?= gcc
CFLAGS  ?= -Wall -Wextra -O2 -fPIC
LDFLAGS ?= -shared
PLUGIN_DIR ?= /usr/lib

EXAMPLE_SRC = example_hal.c
SM_I001_SRC = rpi4_sm_i001_hal.c sm_i001_i2c.c

.PHONY: all example sm_i001 clean install-example install-sm_i001

all: example

example: libmooreview_hal_example.so

sm_i001: libmooreview_hal_sm_i001.so

libmooreview_hal_example.so: $(EXAMPLE_SRC)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(EXAMPLE_SRC) -lm

libmooreview_hal_sm_i001.so: $(SM_I001_SRC) sm_i001_regs.h sm_i001_i2c.h
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(SM_I001_SRC) -lm

install-example: libmooreview_hal_example.so
	install -m 0755 libmooreview_hal_example.so $(PLUGIN_DIR)/

install-sm_i001: libmooreview_hal_sm_i001.so
	install -m 0755 libmooreview_hal_sm_i001.so $(PLUGIN_DIR)/

clean:
	rm -f libmooreview_hal_example.so libmooreview_hal_sm_i001.so *.o
