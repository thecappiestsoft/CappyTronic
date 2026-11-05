'use strict';
/* ================= ENC28J60 + wirtualna sieć Ethernet =================
   Emulacja układu wg karty katalogowej (DS39662E): rejestry w 4 bankach, bufor 8 KB, odbiór z wektorem statusu,
   nadawanie z TSV, DMA (kopiowanie i suma kontrolna), rejestry PHY przez MII, filtry odbioru, przerwania.
   Moduły ENC28J60 w obwodzie są połączone wirtualnym przełącznikiem (switch) z „routerem” CappyTronic 192.168.50.1:
   DHCP, DNS, ping bramy, NTP oraz pośrednik TCP do sieci komputera (te same zasady co MQTT/HTTP – domyślnie tylko sieć lokalna).
   Adres 192.168.50.1 oznacza „ten komputer” (np. serwer MQTT na porcie 1883). Strona WWW modułu jest dostępna
   w przeglądarce komputera pod http://127.0.0.1:8090/ (przekierowanie portu na port 80 modułu). */
const ENCNET = { gwMac: [0x02, 0xca, 0x99, 0x50, 0x00, 0x01], gw: [192, 168, 50, 1], leases: {}, nextLease: 100, conns: [], isn: 0x1000, ports: 40000 };
const ip2s = a => a.join('.'), ipEq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
const macEq = (a, i, m) => m.every((v, k) => a[i + k] === v);
function csum16(b, s, e, init) { let x = init || 0; for (let i = s; i < e; i += 2) x += (b[i] << 8) | (i + 1 < e ? b[i + 1] : 0); while (x >> 16) x = (x & 0xffff) + (x >> 16); return x; }
const CRCT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = -1; for (const v of b) c = CRCT[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0; }

/* ---------- układ ---------- */
const EN = { ERDPT: 0x00, EWRPT: 0x02, ETXST: 0x04, ETXND: 0x06, ERXST: 0x08, ERXND: 0x0a, ERXRDPT: 0x0c, ERXWRPT: 0x0e, EDMAST: 0x10, EDMAND: 0x12, EDMADST: 0x14, EDMACS: 0x16,
  EIE: 0x1b, EIR: 0x1c, ESTAT: 0x1d, ECON2: 0x1e, ECON1: 0x1f };
function encReset(s) {
  s.bk = [new Uint8Array(32), new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)]; s.r = new Uint8Array(32);
  const b0 = s.bk[0]; b0[0x00] = 0xfa; b0[0x01] = 0x05; b0[0x08] = 0xfa; b0[0x09] = 0x05; b0[0x0a] = 0xff; b0[0x0b] = 0x1f; b0[0x0c] = 0xfa; b0[0x0d] = 0x05;
  s.bk[1][0x18] = 0xa1; s.bk[2][0x00] = 0x0d; s.bk[2][0x0a] = 0xee; s.bk[2][0x0b] = 0x05; s.bk[3][0x12] = 0x06;
  s.r[EN.ECON2] = 0x80; s.r[EN.ESTAT] = 0x01; s.pkt = 0; s.phy = new Uint16Array(32); s.phy[0x02] = 0x0083; s.phy[0x03] = 0x1400; s.phy[0x14] = 0x3422;
  s.txAt = null; s.miBusy = 0; s.llstat = 0;
}
const w16 = (b, a) => b[a] | (b[a + 1] << 8);
const s16 = (b, a, v) => { b[a] = v & 255; b[a + 1] = (v >> 8) & 0x1f; };
function encRxWrap(s, a) { const st = w16(s.bk[0], EN.ERXST), nd = w16(s.bk[0], EN.ERXND); if (a > nd && a - 1 <= nd + 8) return st + (a - nd - 1); return a & 0x1fff; }
function encIsMac(bank, a) { return a < 0x1b && (bank === 2 || (bank === 3 && (a <= 0x05 || a === 0x0a))); }
function encRead(x, bank, a) {
  const s = x.s;
  if (a >= 0x1b) {
    if (a === EN.EIR) return (s.r[a] & ~0x40) | (s.pkt > 0 ? 0x40 : 0);
    if (a === EN.ESTAT) return (s.r[a] & 0x7f) | (encIrq(s) ? 0x80 : 0) | 0x01;
    return s.r[a];
  }
  const b = s.bk[bank];
  if (bank === 1 && a === 0x19) return s.pkt;
  if (bank === 3 && a === 0x0a) return eNow() < s.miBusy ? 1 : 0;
  if (bank === 3 && a === 0x12) return 0x06;
  if (bank === 3 && a === 0x09) return b[a];
  return b[a];
}
function encPhyRead(s, r) {
  const link = s.link;
  if (r === 0x01) { const v = 0x1800 | (link && s.llstat ? 0x0004 : 0); s.llstat = link ? 1 : 0; return v; }
  if (r === 0x11) return (link ? 0x0400 : 0) | 0x0200;
  if (r === 0x13) { const v = s.phy[0x13]; s.phy[0x13] = 0; return v; }
  return s.phy[r];
}
function encWrite(x, bank, a, v) {
  const s = x.s;
  if (a >= 0x1b) {
    if (a === EN.EIR) { s.r[a] = v & 0x3b; return; }
    if (a === EN.ESTAT) { s.r[a] = (s.r[a] & ~0x52) | (v & 0x52); return; }
    if (a === EN.ECON2) { if (v & 0x40 && s.pkt > 0) s.pkt--; s.r[a] = v & 0xa8; return; }
    if (a === EN.ECON1) {
      const old = s.r[a]; s.r[a] = v;
      if (v & 0x80) { s.r[a] &= ~0x08; s.txAt = null; }
      if (v & 0x40) { s.pkt = 0; s16(s.bk[0], EN.ERXWRPT, w16(s.bk[0], EN.ERXST)); }
      if ((v & 0x08) && !(old & 0x08) && !(v & 0x80)) { const len = Math.max(0, w16(s.bk[0], EN.ETXND) - w16(s.bk[0], EN.ETXST)); s.txAt = eNow() + (Math.max(len, 60) + 20) * 8 / 10e6; }
      if ((v & 0x20) && !(old & 0x20)) encDma(s);
      return;
    }
    s.r[a] = v; return;
  }
  const b = s.bk[bank]; b[a] = v;
  if (bank === 0 && (a === EN.ERXST || a === EN.ERXST + 1)) s16(b, EN.ERXWRPT, w16(b, EN.ERXST));
  if (bank === 2 && a === 0x12 && (v & 1)) { b[0x18] = encPhyRead(s, b[0x14] & 31) & 255; b[0x19] = encPhyRead(s, b[0x14] & 31) >> 8; s.miBusy = eNow() + 10.24e-6; }
  if (bank === 2 && a === 0x17) { const r = b[0x14] & 31; let val = (v << 8) | b[0x16]; if (r === 0x00 && (val & 0x8000)) { s.phy[0] = 0; val = 0; } s.phy[r] = val; s.miBusy = eNow() + 10.24e-6; }
  if (bank === 3 && a === 0x07 && (v & 0x01)) {
    // samotest pamięci (BIST): wypełnienie adresami albo losowo, suma kontrolna w EBSTCS
    const mode = (v >> 2) & 3; if (v & 0x02) { /* PSEL */ }
    for (let i = 0; i < 8192; i++) s.mem[i] = mode === 1 ? i & 255 : mode === 2 ? (i >> 8) & 255 : (b[0x06] = (b[0x06] * 0x1d + 0x2b) & 255);
    const c = encCsum(s, 0, 0x1fff); b[0x08] = c & 255; b[0x09] = c >> 8; b[0x07] = v & ~0x01;
  }
}
function encCsum(s, st, nd) { let x = 0, i = st, k = 0, hi = true; for (let n = 0; n < 8192; n++) { const v = s.mem[i]; if (hi) k = v << 8; else { x += k | v; } hi = !hi; if (i === nd) break; i = encRxWrap(s, i + 1); } if (!hi) x += k; while (x >> 16) x = (x & 0xffff) + (x >> 16); return (~x) & 0xffff; }
function encDma(s) {
  const b = s.bk[0], st = w16(b, EN.EDMAST), nd = w16(b, EN.EDMAND);
  if (s.r[EN.ECON1] & 0x10) { const c = encCsum(s, st, nd); b[EN.EDMACS] = c & 255; b[EN.EDMACS + 1] = c >> 8; }
  else { let i = st, d = w16(b, EN.EDMADST); for (let n = 0; n < 8192; n++) { s.mem[d] = s.mem[i]; d = encRxWrap(s, d + 1); if (i === nd) break; i = encRxWrap(s, i + 1); } }
  s.r[EN.ECON1] &= ~0x20; s.r[EN.EIR] |= 0x20;
}
const encIrq = s => (s.r[EN.EIE] & 0x80) && ((s.r[EN.EIE] & ((s.r[EN.EIR] & 0x3b) | (s.pkt > 0 ? 0x40 : 0))) & 0x7b);
function encMac(s) { const b = s.bk[3]; return [b[0x04], b[0x05], b[0x02], b[0x03], b[0x00], b[0x01]]; }
// ramka przychodząca: filtry, zapis do bufora kołowego z wektorem statusu
function encRx(x, f) {
  const s = x.s; if (!s.link || !(s.r[EN.ECON1] & 0x04) || !x.pw) return false;
  const fc = s.bk[1][0x18], mac = encMac(s), bc = f[0] === 255 && f[1] === 255 && f[2] === 255 && f[3] === 255 && f[4] === 255 && f[5] === 255, mc = !bc && (f[0] & 1);
  if (fc) {
    const uc = macEq(f, 0, mac); let ok = (fc & 0x80) && uc; ok = ok || ((fc & 0x01) && bc) || ((fc & 0x02) && mc);
    if (!ok && (fc & 0x10) && bc && f[12] === 0x08 && f[13] === 0x06) ok = true; // dopasowanie wzorca (EtherCard: ARP)
    if (!ok) return false;
  }
  const b0 = s.bk[0], st = w16(b0, EN.ERXST), nd = w16(b0, EN.ERXND), size = nd - st + 1;
  const wr = w16(b0, EN.ERXWRPT), rd = w16(b0, EN.ERXRDPT);
  const len = f.length + 4, need = 6 + len + (len & 1);
  const free = wr >= rd ? size - (wr - rd) : rd - wr;
  if (s.pkt >= 255 || need >= free) { s.r[EN.EIR] |= 0x01; s.r[EN.ESTAT] |= 0x40; return false; }
  let next = wr + need; if (next > nd) next = st + (next - nd - 1);
  const crc = crc32(f);
  const bytes = [next & 255, next >> 8, len & 255, len >> 8, 0x80, (bc ? 0x02 : 0) | (mc ? 0x01 : 0), ...f, crc & 255, (crc >> 8) & 255, (crc >> 16) & 255, crc >>> 24];
  let a = wr; for (const v of bytes) { s.mem[a] = v; a = a === nd ? st : a + 1; }
  s16(b0, EN.ERXWRPT, next); s.pkt++; s.rxN = (s.rxN || 0) + 1; E.dirty = true; return true;
}
function encTxDone(x) {
  const s = x.s, b0 = s.bk[0], st = w16(b0, EN.ETXST), nd = w16(b0, EN.ETXND);
  let f = Array.from(s.mem.subarray(st + 1, nd + 1));
  if ((s.bk[2][0x02] & 0xe0) && f.length < 60) while (f.length < 60) f.push(0);
  const n = f.length, tsv = [n & 255, n >> 8, 0, 0x80 | ((f[0] & 1) ? (f[0] === 255 ? 0x02 : 0x01) : 0), (n + 4) & 255, (n + 4) >> 8, 0];
  for (let i = 0; i < 7; i++) s.mem[(nd + 1 + i) & 0x1fff] = tsv[i];
  s.r[EN.ECON1] &= ~0x08; s.r[EN.EIR] |= 0x08; s.txAt = null; s.txN = (s.txN || 0) + 1;
  if (s.link) encSwitch(x, f);
}
/* ---------- przełącznik i router ---------- */
function encDevs() { return CIR ? CIR.devs.filter(y => y.c.type === 'eth_enc28j60') : []; }
function encSwitch(src, f) {
  if (f.length < 14) return;
  for (const y of encDevs()) if (y !== src) encRx(y, f);
  if (macEq(f, 0, ENCNET.gwMac) || (f[0] & 1)) gwFrame(src, f);
}
function ethFrame(dst, type, payload) { return [...dst, ...ENCNET.gwMac, type >> 8, type & 255, ...payload]; }
function ipPacket(src, dst, proto, payload) {
  const h = [0x45, 0, 0, 0, (ENCNET.isn >> 3) & 255, 0, 0x40, 0, 64, proto, 0, 0, ...src, ...dst]; const len = 20 + payload.length; h[2] = len >> 8; h[3] = len & 255;
  const c = ~csum16(h, 0, 20) & 0xffff; h[10] = c >> 8; h[11] = c & 255; return h.concat(payload);
}
function l4sum(src, dst, proto, seg) { const ph = [...src, ...dst, 0, proto, seg.length >> 8, seg.length & 255]; return ~csum16(seg, 0, seg.length, csum16(ph, 0, 12)) & 0xffff; }
function udpPacket(src, sport, dst, dport, data) { const u = [sport >> 8, sport & 255, dport >> 8, dport & 255, (8 + data.length) >> 8, (8 + data.length) & 255, 0, 0, ...data]; const c = l4sum(src, dst, 17, u) || 0xffff; u[6] = c >> 8; u[7] = c & 255; return ipPacket(src, dst, 17, u); }
function gwSendTo(x, dstMac, ipPkt) { const f = ethFrame(dstMac, 0x0800, ipPkt); while (f.length < 60) f.push(0); x.s.gwQ = x.s.gwQ || []; x.s.gwQ.push(f); }
const isLocalIp = (x, ip) => ipEq(ip, ENCNET.gw) || (x.s.ip && ip[0] === x.s.ip[0] && ip[1] === x.s.ip[1] && ip[2] === x.s.ip[2] && ip[3] === 1);
const ownedByBoard = ip => encDevs().some(y => y.s.ip && ipEq(y.s.ip, ip));
function gwFrame(x, f) {
  const type = (f[12] << 8) | f[13], src = f.slice(6, 12), p = f.slice(14);
  if (type === 0x0806 && p.length >= 28) {
    const op = (p[6] << 8) | p[7], spa = p.slice(14, 18), tpa = p.slice(24, 28);
    if (!ipEq(spa, [0, 0, 0, 0])) { x.s.ip = spa; x.s.mac = src; }
    if (op === 1 && !ipEq(tpa, spa) && !ownedByBoard(tpa)) {
      const r = [0, 1, 8, 0, 6, 4, 0, 2, ...ENCNET.gwMac, ...tpa, ...src, ...spa]; const fr = ethFrame(src, 0x0806, r); while (fr.length < 60) fr.push(0); (x.s.gwQ = x.s.gwQ || []).push(fr);
    }
    return;
  }
  if (type !== 0x0800 || p.length < 20 || (p[0] >> 4) !== 4) return;
  const ihl = (p[0] & 15) * 4, tot = (p[2] << 8) | p[3], proto = p[9], sip = p.slice(12, 16), dip = p.slice(16, 20), d = p.slice(ihl, tot);
  if (!ipEq(sip, [0, 0, 0, 0])) { x.s.ip = sip; x.s.mac = src; }
  if (!macEq(f, 0, ENCNET.gwMac) && !(proto === 17 && d.length > 3 && ((d[2] << 8) | d[3]) === 67)) return;
  if (proto === 1 && d[0] === 8) { // ping
    if (!isLocalIp(x, dip)) return;
    const r = d.slice(); r[0] = 0; r[2] = 0; r[3] = 0; const c = ~csum16(r, 0, r.length) & 0xffff; r[2] = c >> 8; r[3] = c & 255;
    gwSendTo(x, src, ipPacket(dip, sip, 1, r)); return;
  }
  if (proto === 17 && d.length >= 8) {
    const sp = (d[0] << 8) | d[1], dp = (d[2] << 8) | d[3], data = d.slice(8, (d[4] << 8) | d[5]);
    if (dp === 67) return gwDhcp(x, src, data);
    if (dp === 53) return gwDns(x, src, sip, sp, dip, data);
    if (dp === 123 && data.length >= 48) { // NTP – czas komputera
      const r = new Array(48).fill(0); r[0] = 0x24; r[1] = 2; r[2] = data[2]; r[3] = 0xec; r[12] = 0x7f; r[13] = 0; r[14] = 0; r[15] = 1;
      const now = Date.now() / 1000 + 2208988800, sec = Math.floor(now), fr2 = Math.floor((now - sec) * 4294967296);
      for (const o of [16, 32, 40]) { r[o] = (sec >>> 24) & 255; r[o + 1] = (sec >>> 16) & 255; r[o + 2] = (sec >>> 8) & 255; r[o + 3] = sec & 255; r[o + 4] = (fr2 >>> 24) & 255; r[o + 5] = (fr2 >>> 16) & 255; r[o + 6] = (fr2 >>> 8) & 255; r[o + 7] = fr2 & 255; }
      for (let i = 0; i < 8; i++) r[24 + i] = data[40 + i];
      gwSendTo(x, src, udpPacket(dip, 123, sip, sp, r)); return;
    }
    return;
  }
  if (proto === 6 && d.length >= 20) gwTcp(x, src, sip, dip, d);
}
function gwDhcp(x, mac, b) {
  if (b.length < 240 || b[0] !== 1) return;
  let type = 0; for (let i = 240; i < b.length && b[i] !== 255;) { if (b[i] === 0) { i++; continue; } if (b[i] === 53) type = b[i + 2]; i += 2 + b[i + 1]; }
  if (type !== 1 && type !== 3) return;
  const key = b.slice(28, 34).join(':'); const ip = ENCNET.leases[key] || (ENCNET.leases[key] = [192, 168, 50, ENCNET.nextLease++]);
  const r = new Array(240).fill(0); r[0] = 2; r[1] = 1; r[2] = 6; for (let i = 4; i < 8; i++) r[i] = b[i]; r[10] = b[10]; r[11] = b[11];
  for (let i = 0; i < 4; i++) { r[16 + i] = ip[i]; r[20 + i] = ENCNET.gw[i]; } for (let i = 0; i < 16; i++) r[28 + i] = b[28 + i];
  r[236] = 99; r[237] = 130; r[238] = 83; r[239] = 99;
  r.push(53, 1, type === 1 ? 2 : 5, 54, 4, ...ENCNET.gw, 51, 4, 0, 1, 81, 128, 1, 4, 255, 255, 255, 0, 3, 4, ...ENCNET.gw, 6, 4, ...ENCNET.gw, 255);
  while (r.length < 300) r.push(0);
  if (type === 3) { x.s.ip = ip; x.s.mac = mac; }
  gwSendTo(x, mac, udpPacket(ENCNET.gw, 67, [255, 255, 255, 255], 68, r));
}
const LOCAL_NAMES = /^(cappy|cappytronic|komputer|computer|router|gateway|brama|mqtt|localhost)(\.local|\.lan)?$/i;
function gwDns(x, mac, sip, sp, dip, q) {
  if (q.length < 17) return;
  let i = 12, labels = []; while (i < q.length && q[i]) { labels.push(String.fromCharCode(...q.slice(i + 1, i + 1 + q[i]))); i += 1 + q[i]; }
  const qend = i + 5, qtype = (q[i + 1] << 8) | q[i + 2], name = labels.join('.');
  const reply = ip => { const r = q.slice(0, qend); r[2] = 0x81; r[3] = ip ? 0x80 : 0x83; r[4] = 0; r[5] = 1; r[6] = 0; r[7] = ip && qtype === 1 ? 1 : 0; r[8] = r[9] = r[10] = r[11] = 0;
    if (ip && qtype === 1) r.push(0xc0, 12, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, ...ip); if (ip && qtype !== 1) r[3] = 0x80; gwSendTo(x, mac, udpPacket(dip, 53, sip, sp, r)); E.dirty = true; };
  if (LOCAL_NAMES.test(name)) return reply(ENCNET.gw);
  const net = window.cappyNative; if (!net || !net.dns) return reply(null);
  net.dns({ host: name }).then(r => { const m = r.ok && /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(r.ip); reply(m ? [+m[1], +m[2], +m[3], +m[4]] : null); }, () => reply(null));
}
/* ---------- pośrednik TCP ---------- */
function tcpSeg(c, flags, data, opts) {
  const o = opts || [], hl = 20 + o.length, s = [c.rport >> 8, c.rport & 255, c.bport >> 8, c.bport & 255, ...u32(c.sndNxt), ...u32(c.rcvNxt), (hl / 4) << 4, flags, 0x10, 0x00, 0, 0, 0, 0, ...o, ...(data || [])];
  const ck = l4sum(c.rip, c.bip, 6, s); s[16] = ck >> 8; s[17] = ck & 255;
  gwSendTo(c.x, c.bmac, ipPacket(c.rip, c.bip, 6, s));
}
const u32 = v => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const rd32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const sdiff = (a, b) => (a - b) | 0;
function tcpFind(x, bip, bport, rip, rport) { return ENCNET.conns.find(c => c.x === x && ipEq(c.bip, bip) && c.bport === bport && ipEq(c.rip, rip) && c.rport === rport); }
function tcpKill(c, rst) { if (rst) tcpSeg(c, 0x14); const i = ENCNET.conns.indexOf(c); if (i >= 0) ENCNET.conns.splice(i, 1); if (c.h) { ENC_TCP.delete(c.h); if (window.cappyNative) cappyNative.tcpClose(c.h).catch(() => { }); c.h = 0; } }
function gwTcp(x, mac, sip, dip, d) {
  const sport = (d[0] << 8) | d[1], dport = (d[2] << 8) | d[3], seq = rd32(d, 4), ack = rd32(d, 8), off = (d[12] >> 4) * 4, fl = d[13], wnd = (d[14] << 8) | d[15], data = d.slice(off);
  let c = tcpFind(x, sip, sport, dip, dport);
  if (fl & 0x04) { if (c) tcpKill(c, false); return; }
  let mss = 536; for (let i = 20; i < off;) { if (d[i] === 0) break; if (d[i] === 1) { i++; continue; } if (d[i] === 2) mss = (d[i + 2] << 8) | d[i + 3]; i += d[i + 1] || 1; }
  if (!c) {
    if (!(fl & 0x02) || (fl & 0x10)) { const t = { x, bip: sip, bport: sport, rip: dip, rport: dport, bmac: mac, sndNxt: ack, rcvNxt: (seq + data.length + ((fl & 3) ? 1 : 0)) >>> 0 }; tcpSeg(t, 0x14); return; }
    // nowe połączenie od modułu: otwieramy prawdziwe połączenie przez komputer
    c = { x, bip: sip, bport: sport, rip: dip, rport: dport, bmac: mac, state: 'opening', rcvNxt: (seq + 1) >>> 0, iss: (ENCNET.isn += 64019) >>> 0, mss: Math.min(mss, 536), wnd, q: [], tries: 0, out: true };
    c.sndNxt = c.sndUna = c.iss; ENCNET.conns.push(c);
    const host = isLocalIp(x, dip) ? '127.0.0.1' : ip2s(dip), net = window.cappyNative;
    if (!net || !net.tcpOpen) { tcpKill(c, true); return; }
    net.tcpOpen({ host, port: dport }).then(r => {
      if (!ENCNET.conns.includes(c)) { if (r.ok) net.tcpClose(r.h); return; }
      if (!r.ok) { c.sndNxt = 0; tcpKill(c, true); x.s.lastErr = host + ':' + dport + ' – ' + (r.errno === 13 ? 'blocked' : r.msg || r.errno); E.dirty = true; return; }
      c.h = r.h; ENC_TCP.set(r.h, c); c.state = 'synrcvd'; tcpSeg(c, 0x12, null, [2, 4, 0x05, 0xb4]); c.sndNxt = (c.iss + 1) >>> 0; c.retx = eNow() + 0.5; E.dirty = true;
    });
    return;
  }
  c.wnd = wnd;
  if ((fl & 0x02) && (fl & 0x10) && c.state === 'synsent') { c.rcvNxt = (seq + 1) >>> 0; c.sndUna = ack; c.state = 'est'; c.mss = Math.min(mss, 536); tcpSeg(c, 0x10); c.retx = null; return; }
  if (fl & 0x02) { if (c.state === 'synrcvd') { const n = c.sndNxt; c.sndNxt = c.iss; tcpSeg(c, 0x12, null, [2, 4, 0x05, 0xb4]); c.sndNxt = n; } return; }
  if (fl & 0x10) {
    const n = sdiff(ack, c.sndUna);
    if (n > 0 && sdiff(ack, c.sndNxt) <= 0) {
      if (c.state === 'synrcvd') { c.state = 'est'; } else { const k = Math.min(n, c.q.length); c.q.splice(0, k); if (c.finSent && ack === c.sndNxt) c.finAcked = true; }
      c.sndUna = ack; c.retx = null; c.tries = 0;
    } else if (c.state === 'synrcvd' && ack === c.sndNxt) c.state = 'est';
  }
  if (data.length) {
    if (seq === c.rcvNxt) { c.rcvNxt = (c.rcvNxt + data.length) >>> 0; if (c.h) cappyNative.tcpWrite({ h: c.h, d: hexOf(data) }).catch(() => { }); }
    tcpSeg(c, 0x10);
  }
  if ((fl & 0x01) && sdiff(seq + data.length, c.rcvNxt) === 0) {
    c.rcvNxt = (c.rcvNxt + 1) >>> 0; c.boardFin = true;
    if (!c.finSent && !c.q.length) { tcpSeg(c, 0x11); c.sndNxt = (c.sndNxt + 1) >>> 0; c.finSent = true; c.retx = eNow() + 0.4; } else tcpSeg(c, 0x10);
    if (c.h) { const h = c.h; setTimeout(() => cappyNative.tcpClose(h).catch(() => { }), 50); ENC_TCP.delete(h); c.h = 0; }
  }
  if (c.finSent && c.finAcked && c.boardFin) tcpKill(c, false);
}
function encTcpTick(x) {
  const now = eNow();
  for (const c of ENCNET.conns.slice()) {
    if (c.x !== x) continue;
    if (c.state === 'synsent') { if (now > c.retx) { if (++c.tries > 6) { tcpKill(c, false); continue; } const n = c.sndNxt; c.sndNxt = c.iss; tcpSeg(c, 0x02, null, [2, 4, 0x05, 0xb4]); c.sndNxt = n; c.retx = now + 0.5 * c.tries; } continue; }
    if (c.state === 'synrcvd') { if (c.retx && now > c.retx) { if (++c.tries > 6) { tcpKill(c, true); continue; } const n = c.sndNxt; c.sndNxt = c.iss; tcpSeg(c, 0x12, null, [2, 4, 0x05, 0xb4]); c.sndNxt = n; c.retx = now + 0.5 * c.tries; } continue; }
    if (c.state !== 'est') continue;
    const inflight = sdiff(c.sndNxt, c.sndUna) - (c.finSent && !c.finAcked ? 1 : 0);
    if (c.retx && now > c.retx) { // retransmisja
      if (++c.tries > 8) { tcpKill(c, true); continue; }
      c.sndNxt = c.sndUna; c.finSent = false; c.retx = null;
    }
    if (sdiff(c.sndNxt, c.sndUna) === 0 && c.q.length && c.wnd > 0) {
      const n = Math.min(c.mss, c.wnd, c.q.length); tcpSeg(c, 0x18, c.q.slice(0, n)); c.sndNxt = (c.sndNxt + n) >>> 0; c.retx = now + 0.25 * (1 + c.tries);
    } else if (inflight <= 0 && !c.q.length && c.hostClosed && !c.finSent) { tcpSeg(c, 0x11); c.sndNxt = (c.sndNxt + 1) >>> 0; c.finSent = true; c.retx = now + 0.4; }
    if (c.finAcked && c.boardFin) tcpKill(c, false);
  }
}
const ENC_TCP = new Map(), ENC_LISTEN = new Map();
function encTcpEvent(m) {
  if (m.accept) { const x = ENC_LISTEN.get(m.lid); if (x) encAccept(x, m.h); else if (window.cappyNative) cappyNative.tcpClose(m.h); return true; }
  const c = ENC_TCP.get(m.h); if (!c) return false;
  if (m.d) { let b = bytesOf(m.d); if (c.fwd && !c.seen) { c.seen = true; b = httpCompact(b); } c.q.push(...b); }
  if (m.closed) { c.hostClosed = true; ENC_TCP.delete(m.h); c.h = 0; }
  return true;
}
// zapytanie przeglądarki skracamy do najważniejszych nagłówków – moduł ma mały bufor (zwykle 500–700 B)
function httpCompact(b) {
  const s = String.fromCharCode(...b), e = s.indexOf('\r\n\r\n'); if (!/^(GET|POST|PUT|DELETE|HEAD) /.test(s) || e < 0) return b;
  const lines = s.slice(0, e).split('\r\n'), keep = [lines[0], ...lines.slice(1).filter(l => /^(host|content-length|content-type):/i.test(l)), 'Connection: close'];
  const t = keep.join('\r\n') + '\r\n\r\n' + s.slice(e + 4); return Array.from(t, ch => ch.charCodeAt(0) & 255);
}
function encAccept(x, h) {
  const net = window.cappyNative;
  if (!x.s.ip || !x.s.link) { net.tcpWrite({ h, d: hexOf(PYTE.encode('HTTP/1.0 503 Service Unavailable\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nCappyTronic: modul ENC28J60 nie ma jeszcze adresu IP albo kabel jest odlaczony.\r\n')) }).then(() => net.tcpClose(h)); return; }
  const c = { x, bip: x.s.ip, bport: x.c.props.wport || 80, rip: ENCNET.gw, rport: ENCNET.ports = ENCNET.ports >= 60000 ? 40000 : ENCNET.ports + 1, bmac: x.s.mac, state: 'synsent', iss: (ENCNET.isn += 64019) >>> 0, rcvNxt: 0, mss: 536, wnd: 512, q: [], tries: 0, h, fwd: true };
  c.sndUna = c.iss; c.sndNxt = (c.iss + 1) >>> 0; ENCNET.conns.push(c); ENC_TCP.set(h, c);
  const n = c.sndNxt; c.sndNxt = c.iss; tcpSeg(c, 0x02, null, [2, 4, 0x05, 0xb4]); c.sndNxt = n; c.retx = eNow() + 0.5; E.dirty = true;
}
function encListen(x) {
  const net = window.cappyNative; if (x.s.fwdReq || !net || !net.tcpListen) return; x.s.fwdReq = true;
  const idx = encDevs().indexOf(x);
  net.tcpListen({ port: 8090 + Math.max(0, idx) }).then(r => { if (!r.ok) return; if (!CIR || !CIR.devs.includes(x)) { net.tcpUnlisten(r.lid); return; } x.s.fwd = r; ENC_LISTEN.set(r.lid, x); E.dirty = true; });
}
function encStopAll() {
  for (const [lid] of ENC_LISTEN) if (window.cappyNative) cappyNative.tcpUnlisten(lid).catch(() => { });
  ENC_LISTEN.clear(); for (const c of ENCNET.conns.slice()) tcpKill(c, false); ENCNET.conns = [];
}

/* ---------- część ---------- */
modPart('eth_enc28j60', {
  cat: 'com', name: { pl: 'ENC28J60 (Ethernet)', en: 'ENC28J60 (Ethernet)' }, sub: { pl: 'Kontroler sieci, SPI', en: 'Network controller, SPI' }, kw: 'enc28j60 ethernet siec network ethercard spi rj45 dhcp tcp www', pins: ['CLK', 'INT', 'SO', 'SCK', 'SI', 'CS', 'RST', 'VCC', 'GND'], w: 200, h: 120, title: 'ENC28J60', col: '#1f4f9e',
  props: { cable: true, wport: 80 },
  ui: [{ k: 'cable', type: 'seg', live: true, l: { pl: 'Kabel sieciowy', en: 'Network cable' }, opts: [[true, { pl: 'podłączony', en: 'plugged in' }], [false, { pl: 'odłączony', en: 'unplugged' }]] },
    { k: 'wport', type: 'seg', l: { pl: 'Port WWW modułu', en: 'Module web port' }, opts: [[80, '80'], [8080, '8080']] }],
  info: { pl: 'Kontroler Ethernet na SPI (biblioteka EtherCard: ether.begin(sizeof Ethernet::buffer, mac, 10)). Układ jest odwzorowany wg karty katalogowej: bufor 8 KB, odbiór i nadawanie ramek, filtry, DMA, rejestry PHY (stan łącza), przerwanie INT. Kabel prowadzi do wirtualnego routera CappyTronic 192.168.50.1: działa DHCP (ether.dhcpSetup()), DNS (ether.dnsLookup()), ping bramy, czas NTP i połączenia TCP przez sieć tego komputera – adres 192.168.50.1 to „ten komputer” (np. serwer MQTT, port 1883). Kilka modułów w obwodzie widzi się nawzajem (wspólny przełącznik). Stronę WWW modułu otworzysz w przeglądarce pod adresem pokazanym we właściwościach (http://127.0.0.1:8090/). Internet jest domyślnie zablokowany – włączysz go w zakładce MQTT.', en: 'An SPI Ethernet controller (EtherCard library: ether.begin(sizeof Ethernet::buffer, mac, 10)). The chip follows the datasheet: 8 KB buffer, frame reception and transmission, filters, DMA, PHY registers (link state), INT interrupt. The cable leads to the CappyTronic virtual router 192.168.50.1: DHCP (ether.dhcpSetup()), DNS (ether.dnsLookup()), gateway ping, NTP time and TCP connections through this computer’s network work – 192.168.50.1 means “this computer” (e.g. the MQTT server, port 1883). Several modules in a circuit see each other (shared switch). Open the module web page in your browser at the address shown in the properties (http://127.0.0.1:8090/). The internet is blocked by default – enable it in the MQTT tab.' },
  inner: (c, r) => `<rect x="110" y="-108" width="46" height="40" rx="2" fill="#c9cfd5" stroke="#7d858d"/>` + tx(133, -84, 'RJ45', { s: 7, c: '#333' })
    + `<circle cx="116" cy="-112" r="3" fill="${r.pw && r.link ? '#3ddc63' : '#244'}"/><circle cx="150" cy="-112" r="3" fill="${r.pw && r.act ? '#ffb020' : '#442'}"/>`
    + (c.props.cable ? `<path d="M133 -68 V-40" stroke="#3b6fd1" stroke-width="6" fill="none"/>` : ''),
  extra: {
    spi: { key: 'e', cs: 5, sck: 3, mosi: 4, miso: 2, select(x, on) { x.s.op = null; x.s.n = 0; },
      pre(x) { const s = x.s; if (s.op === null) return 0;
        if ((s.op >> 5) === 0) { const a = s.op & 31, bank = s.r[EN.ECON1] & 3; const v = encRead(x, bank, a); return s.n >= (encIsMac(bank, a) ? 2 : 1) ? v : 0; }
        if (s.op === 0x3a) { const b0 = s.bk[0]; let p = w16(b0, EN.ERDPT); const v = s.mem[p]; if (s.r[EN.ECON2] & 0x80) { p = p === w16(b0, EN.ERXND) ? w16(b0, EN.ERXST) : (p + 1) & 0x1fff; s16(b0, EN.ERDPT, p); } return v; }
        return 0; },
      byte(x, v) { const s = x.s; if (s.op === null) { s.op = v; s.n = 1; if (v === 0xff) { const m = s.mem; encReset(s); s.mem = m; s.link = !!x.c.props.cable; } return; }
        s.n++; const op = s.op >> 5, a = s.op & 31, bank = s.r[EN.ECON1] & 3;
        if (op === 2) encWrite(x, bank, a, v);
        else if (op === 4) { if (!encIsMac(bank, a)) encWrite(x, bank, a, encRead(x, bank, a) | v); }
        else if (op === 5) { if (!encIsMac(bank, a)) encWrite(x, bank, a, encRead(x, bank, a) & ~v); }
        else if (s.op === 0x7a) { const b0 = s.bk[0]; const p = w16(b0, EN.EWRPT); s.mem[p] = v; if (s.r[EN.ECON2] & 0x80) s16(b0, EN.EWRPT, (p + 1) & 0x1fff); } } },
    sim: { supply: [7, 8],
      init(d) { d.s.mem = new Uint8Array(8192); encReset(d.s); d.s.link = !!d.c.props.cable; d.s.ip = null; d.s.gwQ = []; d.s.fwdReq = false; d.s.fwd = null; d.s.intLv = null; spiListen(d, PARTS.eth_enc28j60.spi); eListen(d, 6); eDrive(d, 1, null, 60, 7, 8, true); },
      lin(d, S) { if (dVp(d, 7, 8) > 2.5) S.G(7, 8, 1 / 22); }, // ok. 120–160 mA przy 3,3 V
      onIn(d, p, lvl, old) { if (p === 6) { if (lvl === 0) { const m = d.s.mem; encReset(d.s); d.s.mem = m; d.s.link = !!d.c.props.cable; } return; } spiPinIn(d, PARTS.eth_enc28j60.spi, p, lvl, old); },
      commit(d) {
        const s = d.s, vdd = dVp(d, 7, 8); s.pw = vdd > 2.9; d.s.warn = vdd > 3.9 ? 'encVolt' : null;
        const lk = !!d.c.props.cable && s.pw; if (lk !== s.link) { s.link = lk; s.phy[0x13] |= 0x14; s.r[EN.EIR] |= 0x10; if (!lk) s.llstat = 0; }
        if (s.txAt !== null && eNow() >= s.txAt) encTxDone(d);
        if (s.gwQ && s.gwQ.length) { const q = s.gwQ; s.gwQ = []; for (const f of q) encRx(d, f); }
        encTcpTick(d);
        if (s.ip && s.link && !s.fwdReq) encListen(d);
        const want = encIrq(s) ? 0 : null; if (want !== s.intLv) { s.intLv = want; eDrive(d, 1, want, 60, 7, 8, true); }
        s.act = (s.rxN || 0) + (s.txN || 0) !== s._act; s._act = (s.rxN || 0) + (s.txN || 0);
      } },
  readings: (c, r) => [[{ pl: 'Łącze', en: 'Link' }, r.link ? { pl: 'połączone (10 Mb/s)', en: 'up (10 Mb/s)' } : { pl: 'brak kabla', en: 'no cable' }],
    [{ pl: 'Adres IP', en: 'IP address' }, r.ip ? ip2s(r.ip) : '—'], [{ pl: 'Ramki wysł./odebr.', en: 'Frames sent/received' }, (r.txN || 0) + ' / ' + (r.rxN || 0)],
    [{ pl: 'Strona WWW modułu', en: 'Module web page' }, r.fwd ? 'http://127.0.0.1:' + r.fwd.port + '/' : '—'], ...(r.lastErr ? [[{ pl: 'Ostatni błąd', en: 'Last error' }, r.lastErr]] : [])],
  },

});
