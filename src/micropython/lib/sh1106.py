# CappyTronic – sterownik OLED SH1106 (API zgodne z popularnym sh1106.py)
import framebuf


class SH1106(framebuf.FrameBuffer):
    def __init__(self, width, height, external_vcc, rotate=0):
        self.width = width
        self.height = height
        self.external_vcc = external_vcc
        self.flip_en = rotate == 180
        self.pages = self.height // 8
        self.buffer = bytearray(self.pages * self.width)
        super().__init__(self.buffer, self.width, self.height, framebuf.MONO_VLSB)
        self.init_display()

    def init_display(self):
        for cmd in (0xAE, 0xD5, 0x80, 0xA8, self.height - 1, 0xD3, 0x00, 0x40, 0xAD, 0x8B,
                    0xA1 if not self.flip_en else 0xA0, 0xC8 if not self.flip_en else 0xC0,
                    0xDA, 0x12, 0x81, 0x80, 0xD9, 0x22, 0xDB, 0x35, 0xA4, 0xA6, 0xAF):
            self.write_cmd(cmd)
        self.fill(0)
        self.show()

    def poweroff(self):
        self.write_cmd(0xAE)

    def poweron(self):
        self.write_cmd(0xAF)

    def sleep(self, value):
        self.write_cmd(0xAE if value else 0xAF)

    def contrast(self, contrast):
        self.write_cmd(0x81)
        self.write_cmd(contrast)

    def invert(self, invert):
        self.write_cmd(0xA6 | (invert & 1))

    def flip(self, flag=None, update=True):
        self.flip_en = not self.flip_en if flag is None else flag
        self.write_cmd(0xA0 if self.flip_en else 0xA1)
        self.write_cmd(0xC0 if self.flip_en else 0xC8)
        if update:
            self.show()

    def show(self):
        for page in range(self.pages):
            self.write_cmd(0xB0 | page)
            self.write_cmd(0x02)
            self.write_cmd(0x10)
            self.write_data(self.buffer[page * self.width:(page + 1) * self.width])


class SH1106_I2C(SH1106):
    def __init__(self, width, height, i2c, res=None, addr=0x3C, rotate=0, external_vcc=False, delay=0):
        self.i2c = i2c
        self.addr = addr
        super().__init__(width, height, external_vcc, rotate)

    def write_cmd(self, cmd):
        self.i2c.writeto(self.addr, bytearray([0x80, cmd]))

    def write_data(self, buf):
        self.i2c.writeto(self.addr, b'\x40' + buf)
