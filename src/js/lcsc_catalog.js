'use strict';
/* ================= KATALOG BIBLIOTEKI ZEWNĘTRZNEJ (LCSC) =================
   Statyczne dane dołączane do strony – aplikacja nie łączy się z LCSC. Każda pozycja to fakt katalogowy:
   numer części LCSC, numer producenta (MPN), producent, obudowa i parametry z karty katalogowej.
   Nie zawiera opisów ani zdjęć ze sklepu.

   Pola pozycji:
     lcsc  – numer części LCSC (np. 'C25804'),            mpn  – numer producenta,     mfr – producent
     pkg   – obudowa,                                       cat  – kategoria (identyfikator z CATS w parts_core.js)
     type  – typ elementu symulatora (klucz PARTS),         props – właściwości wstawianego elementu
     p     – parametry do wyszukiwania (liczby w jednostkach SI; klucze w LCSC_PARAMS)
     sim   – 'full': model z parametrami z karty; 'approx': model zastępczy (opis w note)
     note  – { pl, en } – czym model różni się od układu (dla 'approx' lub uwag o obudowie)
   Jak dodać pozycję: zob. README („Biblioteka zewnętrzna”) i docs/ARCHITEKTURA.md. */
const LCSC_PARAMS = {
  r: { u: 'Ω', n: { pl: 'Rezystancja', en: 'Resistance' } }, pw: { u: 'W', n: { pl: 'Moc', en: 'Power' } }, tol: { u: '%', n: { pl: 'Tolerancja', en: 'Tolerance' } },
  c: { u: 'F', n: { pl: 'Pojemność', en: 'Capacitance' } }, v: { u: 'V', n: { pl: 'Napięcie', en: 'Voltage' } }, vout: { u: 'V', n: { pl: 'Napięcie wyjściowe', en: 'Output voltage' } },
  vin: { u: 'V', n: { pl: 'Napięcie wejściowe maks.', en: 'Max input voltage' } }, i: { u: 'A', n: { pl: 'Prąd', en: 'Current' } }, vdrop: { u: 'V', n: { pl: 'Dropout', en: 'Dropout' } },
  vf: { u: 'V', n: { pl: 'Napięcie przewodzenia', en: 'Forward voltage' } }, vr: { u: 'V', n: { pl: 'Napięcie wsteczne', en: 'Reverse voltage' } }, vz: { u: 'V', n: { pl: 'Napięcie Zenera', en: 'Zener voltage' } },
  vce: { u: 'V', n: { pl: 'U_CEO', en: 'V_CEO' } }, ic: { u: 'A', n: { pl: 'I_C maks.', en: 'Max I_C' } }, hfe: { u: '', n: { pl: 'Wzmocnienie h_FE', en: 'Gain h_FE' } },
  vds: { u: 'V', n: { pl: 'U_DS', en: 'V_DS' } }, id: { u: 'A', n: { pl: 'I_D maks.', en: 'Max I_D' } }, vth: { u: 'V', n: { pl: 'Próg U_GS(th)', en: 'Threshold V_GS(th)' } }, rds: { u: 'Ω', n: { pl: 'R_DS(on)', en: 'R_DS(on)' } },
  gbw: { u: 'Hz', n: { pl: 'Pasmo GBW', en: 'GBW' } }, ch: { u: '', n: { pl: 'Liczba kanałów', en: 'Channels' } }, vcc: { u: 'V', n: { pl: 'Zasilanie maks.', en: 'Max supply' } },
  iq: { u: 'A', n: { pl: 'Prąd spoczynkowy', en: 'Quiescent current' } }, baud: { u: 'bd', n: { pl: 'Szybkość maks.', en: 'Max baud rate' } }, bits: { u: 'b', n: { pl: 'Pojemność', en: 'Size' } },
};
// skróty do budowania pozycji
const lcR = (lcsc, mpn, r, pkg, pw) => ({ lcsc, mpn, mfr: 'UNI-ROYAL', pkg, cat: 'res', type: 'resistor', props: { r, w: pw }, p: { r, pw, tol: 1 }, sim: 'full' });
const lcC = (lcsc, mpn, mfr, c, v, diel, pkg) => ({ lcsc, mpn, mfr, pkg, cat: 'cap', type: 'cap_cer', props: { c }, p: { c, v }, kw: 'mlcc ' + diel, sim: 'full' });
const lcLed = (lcsc, mpn, mfr, color, vf, pkg) => ({ lcsc, mpn, mfr, pkg, cat: 'opto', type: 'led', props: { color, vf }, p: { vf, i: 0.02 }, kw: 'led smd ' + color, sim: 'full' });
const PIN_NOTE = (pl, en) => ({ pl: 'Rysunek obudowy przewlekanej, te same parametry elektryczne. ' + pl, en: 'Drawn as a through-hole package, same electrical parameters. ' + en });

const LCSC_CATALOG = [
  // ---- rezystory grubowarstwowe ±1 % ----
  lcR('C22775', '0603WAF1000T5E', 100, '0603', 0.1), lcR('C23138', '0603WAF3300T5E', 330, '0603', 0.1), lcR('C21190', '0603WAF1001T5E', 1e3, '0603', 0.1),
  lcR('C4190', '0603WAF2201T5E', 2.2e3, '0603', 0.1), lcR('C23162', '0603WAF4701T5E', 4.7e3, '0603', 0.1), lcR('C23186', '0603WAF5101T5E', 5.1e3, '0603', 0.1),
  lcR('C25804', '0603WAF1002T5E', 10e3, '0603', 0.1), lcR('C25803', '0603WAF1003T5E', 100e3, '0603', 0.1),
  lcR('C17513', '0805W8F1001T5E', 1e3, '0805', 0.125), lcR('C17414', '0805W8F1002T5E', 10e3, '0805', 0.125),
  lcR('C11702', '0402WGF1001TCE', 1e3, '0402', 0.0625), lcR('C25744', '0402WGF1002TCE', 10e3, '0402', 0.0625),
  // ---- kondensatory ceramiczne MLCC ----
  lcC('C1653', 'CL10C220JB8NNNC', 'Samsung Electro-Mechanics', 22e-12, 50, 'C0G', '0603'),
  lcC('C14663', 'CC0603KRX7R9BB104', 'YAGEO', 100e-9, 50, 'X7R', '0603'),
  lcC('C1525', 'CL05B104KO5NNNC', 'Samsung Electro-Mechanics', 100e-9, 16, 'X7R', '0402'),
  lcC('C15849', 'CL10A105KB8NNNC', 'Samsung Electro-Mechanics', 1e-6, 50, 'X5R', '0603'),
  lcC('C19702', 'CL10A106KP8NNNC', 'Samsung Electro-Mechanics', 10e-6, 10, 'X5R', '0603'),
  lcC('C15850', 'CL21A106KAYNNNE', 'Samsung Electro-Mechanics', 10e-6, 25, 'X5R', '0805'),
  lcC('C45783', 'CL21A226MAQNNNE', 'Samsung Electro-Mechanics', 22e-6, 25, 'X5R', '0805'),
  // ---- diody LED SMD ----
  lcLed('C2286', 'KT-0603R', 'Hubei KENTO Elec', 'red', 2.0, '0603'), lcLed('C2290', 'KT-0603W', 'Hubei KENTO Elec', 'white', 2.9, '0603'),
  lcLed('C2297', 'KT-0805G', 'Hubei KENTO Elec', 'green', 2.9, '0805'), lcLed('C2296', 'KT-0805Y', 'Hubei KENTO Elec', 'yellow', 2.0, '0805'),
  lcLed('C2293', 'KT-0805B', 'Hubei KENTO Elec', 'blue', 3.1, '0805'),
  lcLed('C72043', '19-217/GHC-YR1S2/3T', 'EVERLIGHT', 'green', 3.0, '0603'), lcLed('C72041', '19-217/BHC-ZL1M2RY/3T', 'EVERLIGHT', 'blue', 2.8, '0603'),
  // ---- diody ----
  { lcsc: 'C81598', mpn: '1N4148W', mfr: 'ST(Semtech)', pkg: 'SOD-123', cat: 'diode', type: 'd_1n4148', props: {}, p: { vr: 75, i: 0.15, vf: 1 }, kw: 'szybka impulsowa switching', sim: 'full', note: PIN_NOTE('', '') },
  { lcsc: 'C95872', mpn: 'M7', mfr: 'MDD', pkg: 'SMA(DO-214AC)', cat: 'diode', type: 'd_1n400x', props: { model: '1N4007' }, p: { vr: 1000, i: 1, vf: 1.1 }, kw: '1n4007 prostownicza rectifier', sim: 'full', note: PIN_NOTE('Odpowiednik 1N4007.', 'Equivalent of 1N4007.') },
  { lcsc: 'C2480', mpn: 'SS14', mfr: 'MDD', pkg: 'SMA(DO-214AC)', cat: 'diode', type: 'd_schottky', props: { model: '1N5819' }, p: { vr: 40, i: 1, vf: 0.5 }, kw: 'schottky', sim: 'full', note: PIN_NOTE('Model 1N5819 (te same parametry).', '1N5819 model (same ratings).') },
  { lcsc: 'C8598', mpn: 'B5819W SL', mfr: 'JSCJ', pkg: 'SOD-123', cat: 'diode', type: 'd_schottky', props: { model: '1N5819' }, p: { vr: 40, i: 1, vf: 0.45 }, kw: 'schottky 1n5819', sim: 'full', note: PIN_NOTE('Model 1N5819.', '1N5819 model.') },
  { lcsc: 'C8678', mpn: 'SS34', mfr: 'MDD', pkg: 'SMA(DO-214AC)', cat: 'diode', type: 'x_diode', props: { model: 'SS34' }, p: { vr: 40, i: 3, vf: 0.5 }, kw: 'schottky', sim: 'full' },
  { lcsc: 'C14996', mpn: 'SS210', mfr: 'MDD', pkg: 'SMA(DO-214AC)', cat: 'diode', type: 'x_diode', props: { model: 'SS210' }, p: { vr: 100, i: 2, vf: 0.85 }, kw: 'schottky', sim: 'full' },
  { lcsc: 'C8062', mpn: 'ZMM5V6-M', mfr: 'ST(Semtech)', pkg: 'LL-34', cat: 'diode', type: 'x_diode', props: { model: 'ZMM5V6' }, p: { vz: 5.6, pw: 0.5 }, kw: 'zener stabilizacja', sim: 'full' },
  // ---- tranzystory bipolarne ----
  { lcsc: 'C20526', mpn: 'MMBT3904', mfr: 'JSCJ', pkg: 'SOT-23', cat: 'bjt', type: 'q_2n3904', props: {}, p: { vce: 40, ic: 0.2, hfe: 200 }, kw: 'npn 2n3904', sim: 'full', note: PIN_NOTE('SOT-23: 1 – B, 2 – E, 3 – C.', 'SOT-23: 1 – B, 2 – E, 3 – C.') },
  { lcsc: 'C2143', mpn: 'MMBT3906', mfr: 'JSCJ', pkg: 'SOT-23', cat: 'bjt', type: 'q_2n3906', props: {}, p: { vce: 40, ic: 0.2, hfe: 180 }, kw: 'pnp 2n3906', sim: 'full', note: PIN_NOTE('SOT-23: 1 – B, 2 – E, 3 – C.', 'SOT-23: 1 – B, 2 – E, 3 – C.') },
  { lcsc: 'C8512', mpn: 'MMBT2222A', mfr: 'JSCJ', pkg: 'SOT-23', cat: 'bjt', type: 'q_2n2222', props: {}, p: { vce: 40, ic: 0.6, hfe: 200 }, kw: 'npn 2n2222', sim: 'full', note: PIN_NOTE('SOT-23: 1 – B, 2 – E, 3 – C.', 'SOT-23: 1 – B, 2 – E, 3 – C.') },
  { lcsc: 'C9809', mpn: '2N3906', mfr: 'JSCJ', pkg: 'TO-92', cat: 'bjt', type: 'q_2n3906', props: {}, p: { vce: 40, ic: 0.2, hfe: 180 }, kw: 'pnp', sim: 'full' },
  { lcsc: 'C2146', mpn: 'S8050 J3Y', mfr: 'JSCJ', pkg: 'SOT-23', cat: 'bjt', type: 'x_q_s8050', props: {}, p: { vce: 25, ic: 0.5, hfe: 280 }, kw: 'npn', sim: 'full' },
  { lcsc: 'C2150', mpn: 'SS8050', mfr: 'JSCJ', pkg: 'SOT-23', cat: 'bjt', type: 'x_q_ss8050', props: {}, p: { vce: 25, ic: 1.5, hfe: 280 }, kw: 'npn', sim: 'full' },
  { lcsc: 'C8542', mpn: 'SS8550 Y2', mfr: 'JSCJ', pkg: 'SOT-23', cat: 'bjt', type: 'x_q_ss8550', props: {}, p: { vce: 25, ic: 1.5, hfe: 280 }, kw: 'pnp', sim: 'full' },
  // ---- MOSFET-y ----
  { lcsc: 'C8545', mpn: '2N7002', mfr: 'JSCJ', pkg: 'SOT-23', cat: 'fet', type: 'x_m_2n7002', props: {}, p: { vds: 60, id: 0.115, vth: 2.1, rds: 5 }, kw: 'mosfet n', sim: 'full' },
  { lcsc: 'C52895', mpn: 'BSS138', mfr: 'onsemi', pkg: 'SOT-23', cat: 'fet', type: 'x_m_bss138', props: {}, p: { vds: 50, id: 0.22, vth: 1.3, rds: 3.5 }, kw: 'mosfet n konwerter poziomow level shifter', sim: 'full' },
  { lcsc: 'C20917', mpn: 'AO3400A', mfr: 'AOS', pkg: 'SOT-23', cat: 'fet', type: 'x_m_ao3400a', props: {}, p: { vds: 30, id: 5.7, vth: 1.05, rds: 0.0265 }, kw: 'mosfet n logic level', sim: 'full' },
  { lcsc: 'C15127', mpn: 'AO3401A', mfr: 'AOS', pkg: 'SOT-23', cat: 'fet', type: 'x_m_ao3401a', props: {}, p: { vds: 30, id: 4, vth: 0.9, rds: 0.047 }, kw: 'mosfet p', sim: 'full' },
  { lcsc: 'C10487', mpn: 'SI2301CDS-T1-GE3', mfr: 'VISHAY', pkg: 'SOT-23', cat: 'fet', type: 'x_m_si2301', props: {}, p: { vds: 20, id: 3.1, vth: 0.75, rds: 0.112 }, kw: 'mosfet p', sim: 'full' },
  // ---- stabilizatory i źródła odniesienia ----
  { lcsc: 'C6186', mpn: 'AMS1117-3.3', mfr: 'Advanced Monolithic Systems', pkg: 'SOT-223', cat: 'reg', type: 'x_ldo_ams1117', props: { v: 3.3 }, p: { vout: 3.3, i: 1, vdrop: 1.1, vin: 15 }, kw: 'ldo', sim: 'full' },
  { lcsc: 'C6187', mpn: 'AMS1117-5.0', mfr: 'Advanced Monolithic Systems', pkg: 'SOT-223', cat: 'reg', type: 'x_ldo_ams1117', props: { v: 5 }, p: { vout: 5, i: 1, vdrop: 1.1, vin: 15 }, kw: 'ldo', sim: 'full' },
  { lcsc: 'C6185', mpn: 'AMS1117-1.8', mfr: 'Advanced Monolithic Systems', pkg: 'SOT-223', cat: 'reg', type: 'x_ldo_ams1117', props: { v: 1.8 }, p: { vout: 1.8, i: 1, vdrop: 1.1, vin: 15 }, kw: 'ldo', sim: 'full' },
  { lcsc: 'C5446', mpn: 'XC6206P332MR-G', mfr: 'TOREX', pkg: 'SOT-23', cat: 'reg', type: 'x_ldo_xc6206', props: { v: 3.3 }, p: { vout: 3.3, i: 0.2, vdrop: 0.25, vin: 6, iq: 1e-6 }, kw: 'ldo 662k', sim: 'full' },
  { lcsc: 'C82942', mpn: 'ME6211C33M5G-N', mfr: 'MICRONE', pkg: 'SOT-23-5', cat: 'reg', type: 'x_ldo_me6211', props: { v: 3.3 }, p: { vout: 3.3, i: 0.5, vdrop: 0.1, vin: 6, iq: 40e-6 }, kw: 'ldo', sim: 'full', note: { pl: 'Wejście EN na stałe włączone.', en: 'EN input permanently enabled.' } },
  { lcsc: 'C51118', mpn: 'AP2112K-3.3TRG1', mfr: 'DIODES', pkg: 'SOT-25', cat: 'reg', type: 'x_ldo_ap2112', props: { v: 3.3 }, p: { vout: 3.3, i: 0.6, vdrop: 0.25, vin: 6, iq: 55e-6 }, kw: 'ldo', sim: 'full', note: { pl: 'Wejście EN na stałe włączone.', en: 'EN input permanently enabled.' } },
  { lcsc: 'C779770', mpn: 'TL431', mfr: 'ZRE', pkg: 'SOT-23', cat: 'timer', type: 'ref_tl431', props: {}, p: { v: 2.495, vcc: 36, i: 0.1 }, kw: 'zrodlo odniesienia reference regulowana dioda zenera', sim: 'full', note: PIN_NOTE('', '') },
  // ---- wzmacniacze operacyjne i komparatory ----
  { lcsc: 'C7950', mpn: 'LM358DR2G', mfr: 'onsemi', pkg: 'SOIC-8', cat: 'opamp', type: 'op_lm358', props: {}, p: { ch: 2, gbw: 0.7e6, vcc: 32 }, kw: 'wzmacniacz operacyjny op-amp', sim: 'full' },
  { lcsc: 'C7943', mpn: 'LM324DR', mfr: 'TI', pkg: 'SOIC-14', cat: 'opamp', type: 'op_lm324', props: {}, p: { ch: 4, gbw: 0.7e6, vcc: 32 }, kw: 'wzmacniacz operacyjny op-amp', sim: 'full' },
  { lcsc: 'C71035', mpn: 'LM324DT', mfr: 'STMicroelectronics', pkg: 'SOIC-14', cat: 'opamp', type: 'op_lm324', props: {}, p: { ch: 4, gbw: 1.3e6, vcc: 32 }, kw: 'wzmacniacz operacyjny op-amp', sim: 'full' },
  { lcsc: 'C7974', mpn: 'LMV324IDR', mfr: 'TI', pkg: 'SOIC-14', cat: 'opamp', type: 'x_op_lmv324', props: {}, p: { ch: 4, gbw: 1e6, vcc: 5.5 }, kw: 'wzmacniacz operacyjny op-amp rail-to-rail', sim: 'full' },
  { lcsc: 'C7955', mpn: 'LM393DR2G', mfr: 'onsemi', pkg: 'SOIC-8', cat: 'opamp', type: 'cmp_lm393', props: {}, p: { ch: 2, vcc: 36 }, kw: 'komparator comparator', sim: 'full' },
  // ---- timery i logika ----
  { lcsc: 'C7593', mpn: 'NE555DR', mfr: 'TI', pkg: 'SOIC-8', cat: 'timer', type: 'ic_555', props: {}, p: { vcc: 16 }, kw: 'timer 555 generator', sim: 'full' },
  { lcsc: 'C5586', mpn: '74HC00D,653', mfr: 'Nexperia', pkg: 'SOIC-14', cat: 'gate', type: 'lg_74hc00', props: {}, p: { ch: 4, vcc: 6 }, kw: 'nand bramka gate', sim: 'full' },
  { lcsc: 'C546477', mpn: '74HC00PW,112', mfr: 'Nexperia', pkg: 'TSSOP-14', cat: 'gate', type: 'lg_74hc00', props: {}, p: { ch: 4, vcc: 6 }, kw: 'nand bramka gate', sim: 'full' },
  { lcsc: 'C5605', mpn: '74HC14D,653', mfr: 'Nexperia', pkg: 'SOIC-14', cat: 'gate', type: 'lg_74hc14', props: {}, p: { ch: 6, vcc: 6 }, kw: 'not inverter schmitt', sim: 'full' },
  { lcsc: 'C347584', mpn: 'SN74HC14D', mfr: 'TI', pkg: 'SOIC-14', cat: 'gate', type: 'lg_74hc14', props: {}, p: { ch: 6, vcc: 6 }, kw: 'not inverter schmitt', sim: 'full' },
  { lcsc: 'C5947', mpn: '74HC595D,118', mfr: 'Nexperia', pkg: 'SO-16', cat: 'seq', type: 'lg_74hc595', props: {}, p: { ch: 8, vcc: 6 }, kw: 'rejestr przesuwny shift register', sim: 'full' },
  // ---- elementy stykowe i optoelektronika ----
  { lcsc: 'C318884', mpn: 'TS-1187A-B-A-B', mfr: 'XKB Connection', pkg: 'SMD 5,1×5,1 mm', cat: 'basic', type: 'button', props: {}, p: {}, kw: 'przycisk tact switch', sim: 'full' },
  { lcsc: 'C35449', mpn: 'SRD-05VDC-SL-C', mfr: 'Songle Relay', pkg: 'THT', cat: 'act', type: 'relay', props: { v: 5 }, p: { v: 5, i: 10 }, kw: 'przekaznik relay', sim: 'full' },
  { lcsc: 'C3008368', mpn: 'PC817C', mfr: 'UMW', pkg: 'DIP-4', cat: 'opto', type: 'opto_pc817', props: {}, p: { v: 5000 }, kw: 'transoptor optocoupler', sim: 'full' },
  { lcsc: 'C22447129', mpn: 'PC817C', mfr: 'JSMSEMI', pkg: 'SOP-4', cat: 'opto', type: 'opto_pc817', props: {}, p: { v: 5000 }, kw: 'transoptor optocoupler', sim: 'full' },
  // ---- interfejsy, pamięci, zegary (modele modułów) ----
  { lcsc: 'C14267', mpn: 'CH340G', mfr: 'WCH', pkg: 'SOP-16', cat: 'com', type: 'usb_ch340', props: { baud: 9600 }, p: { baud: 2e6 }, kw: 'usb uart serial', sim: 'approx', note: { pl: 'Model modułu USB-UART: wyprowadzone tylko linie zasilania i UART.', en: 'USB-UART module model: only power and UART lines are exposed.' } },
  { lcsc: 'C84681', mpn: 'CH340C', mfr: 'WCH', pkg: 'SOP-16', cat: 'com', type: 'usb_ch340', props: { baud: 9600 }, p: { baud: 2e6 }, kw: 'usb uart serial', sim: 'approx', note: { pl: 'Model modułu USB-UART: wyprowadzone tylko linie zasilania i UART.', en: 'USB-UART module model: only power and UART lines are exposed.' } },
  { lcsc: 'C8690', mpn: 'FT232RL-REEL', mfr: 'FTDI', pkg: 'SSOP-28', cat: 'com', type: 'usb_ft232', props: { baud: 9600 }, p: { baud: 3e6 }, kw: 'usb uart serial ftdi', sim: 'approx', note: { pl: 'Model modułu USB-UART: wyprowadzone tylko linie zasilania i UART.', en: 'USB-UART module model: only power and UART lines are exposed.' } },
  { lcsc: 'C9866', mpn: 'DS3231SN#T&R', mfr: 'MAXIM', pkg: 'SOIC-16', cat: 'com', type: 'rtc_ds3231', props: { state: 'set', temp: 22 }, p: {}, kw: 'rtc zegar czasu rzeczywistego i2c', sim: 'approx', note: { pl: 'Model modułu DS3231 (I2C, zasilanie, SQW); układ scalony ma więcej nóżek.', en: 'DS3231 module model (I2C, power, SQW); the chip itself has more pins.' } },
  { lcsc: 'C6203', mpn: 'AT24C02C-SSHM-T', mfr: 'Microchip', pkg: 'SOIC-8', cat: 'mem', type: 'ee_24c02', props: {}, p: { bits: 2048, vcc: 5.5 }, kw: 'eeprom i2c pamiec', sim: 'full' },
];
