// Kompilatory dla testów – te same, których używa aplikacja (ścieżki z vendor/ i build/).
const path = require('path'); const fs = require('fs');
const R = path.join(__dirname, '..'), plat = `${process.platform}-${process.arch}`;
const tools = n => path.join(R, 'vendor', 'tools', plat, n);
const { makeCompiler } = require(path.join(R, 'electron', 'compiler.js'));
const { makeStmCompiler } = require(path.join(R, 'electron', 'stmcompiler.js'));
const avrDir = process.env.AVR_GCC_DIR || tools('avr');
module.exports = {
  avr: () => makeCompiler({ gccBin: path.join(avrDir, 'bin'), arduinoDir: path.join(R, 'build', 'arduino') }),
  stm: () => makeStmCompiler({ gccBin: path.join(tools('arm'), 'bin'), stmDir: path.join(R, 'build', 'stm'), libsrcDir: path.join(R, 'build', 'cpp', 'libsrc') }),
  hasAvr: () => fs.existsSync(path.join(R, 'build', 'arduino', 'manifest.json')),
};
