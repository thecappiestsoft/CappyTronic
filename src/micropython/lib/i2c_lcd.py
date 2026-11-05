# CappyTronic – LCD HD44780 z konwerterem I2C PCF8574 (zgodne z popularnym i2c_lcd.py)
from lcd_api import LcdApi
import time

MASK_RS = 0x01
MASK_RW = 0x02
MASK_E = 0x04
SHIFT_BACKLIGHT = 3
SHIFT_DATA = 4


class I2cLcd(LcdApi):
    def __init__(self, i2c, i2c_addr, num_lines, num_columns):
        self.i2c = i2c
        self.i2c_addr = i2c_addr
        self.i2c.writeto(self.i2c_addr, bytes([0]))
        time.sleep_ms(20)
        self.hal_write_init_nibble(0x30)
        time.sleep_ms(5)
        self.hal_write_init_nibble(0x30)
        time.sleep_ms(1)
        self.hal_write_init_nibble(0x30)
        time.sleep_ms(1)
        self.hal_write_init_nibble(0x20)
        time.sleep_ms(1)
        cmd = self.LCD_FUNCTION
        if num_lines > 1:
            cmd |= self.LCD_FUNCTION_2LINES
        self.hal_write_command(cmd)
        LcdApi.__init__(self, num_lines, num_columns)

    def hal_write_init_nibble(self, nibble):
        byte = ((nibble >> 4) & 0x0f) << SHIFT_DATA
        self.i2c.writeto(self.i2c_addr, bytes([byte | MASK_E, byte]))

    def hal_backlight_on(self):
        self.i2c.writeto(self.i2c_addr, bytes([1 << SHIFT_BACKLIGHT]))

    def hal_backlight_off(self):
        self.i2c.writeto(self.i2c_addr, bytes([0]))

    def _nib(self, rs, val):
        b = rs | (self.backlight << SHIFT_BACKLIGHT) | (((val >> 4) & 0x0f) << SHIFT_DATA)
        c = rs | (self.backlight << SHIFT_BACKLIGHT) | ((val & 0x0f) << SHIFT_DATA)
        self.i2c.writeto(self.i2c_addr, bytes([b | MASK_E, b, c | MASK_E, c]))

    def hal_write_command(self, cmd):
        self._nib(0, cmd)
        if cmd <= 3:
            time.sleep_ms(5)

    def hal_write_data(self, data):
        self._nib(MASK_RS, data)
