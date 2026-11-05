'use strict';
/* ================= ZAKŁADKA MQTT ================= */
const NET = { status: null, log: [], cfg: { share: false, internet: false, port: 1883 }, pub: { topic: 'cappy/test', payload: '21.5', retain: false } };
try { Object.assign(NET.cfg, JSON.parse(LS.get('cappytronic.net') || '{}')); } catch (e) { }
const hasNet = () => !!(window.cappyNative && window.cappyNative.netStatus);
function netInit() {
  if (!hasNet()) return;
  const n = window.cappyNative;
  n.onNetEvent(ev => {
    if (ev.type === 'status') NET.status = ev.data;
    else if (ev.type === 'log') { for (const m of ev.data) NET.log.unshift(m); if (NET.log.length > 300) NET.log.length = 300; if (tab !== 'mqtt') $('#mqttDot').hidden = false; }
    if (tab === 'mqtt') mqttRefresh(ev.type);
  });
  n.netConfig(Object.assign({}, NET.cfg, { restart: true })).then(st => { NET.status = st; if (tab === 'mqtt') renderMqtt(); });
}
function netSave(patch) {
  Object.assign(NET.cfg, patch); LS.set('cappytronic.net', JSON.stringify(NET.cfg));
  if (hasNet()) window.cappyNative.netConfig(Object.assign({}, patch, { restart: patch.share !== undefined || patch.port !== undefined })).then(st => { NET.status = st; if (tab === 'mqtt') renderMqtt(); });
}
function b64text(b64) {
  try { const bin = atob(b64 || ''); const u8 = Uint8Array.from(bin, c => c.charCodeAt(0)); const s = new TextDecoder('utf-8', { fatal: true }).decode(u8); return /[\x00-\x08\x0e-\x1f]/.test(s) ? '0x' + Array.from(u8, b => b.toString(16).padStart(2, '0')).join(' ') : s; }
  catch (e) { return '(' + t('mqBinary') + ')'; }
}
function mqttLogHtml() {
  if (!NET.log.length) return `<div class="empty">${t('mqNoMsg')}</div>`;
  return NET.log.slice(0, 150).map(m => `<div class="m"><span class="tp">${esc(m.topic)}</span><span class="tm">${new Date(m.t).toLocaleTimeString(LANG === 'pl' ? 'pl-PL' : 'en-GB')}${m.retain ? ' · retain' : ''} · ${esc(m.from)}</span><span class="pl">${esc(b64text(m.payload))}</span></div>`).join('');
}
function mqttClientsHtml(st) {
  const cl = (st && st.clients) || [];
  if (!cl.length) return `<span class="hint">${t('mqNoClients')}</span>`;
  return cl.map(c => `<span class="chip${c.sim ? ' sim' : ''}" title="${esc(c.ip || '')}">${esc(c.id)}${c.sim ? ' · ' + t('mqSim') : c.ip && c.ip !== '127.0.0.1' ? ' · ' + esc(c.ip) : ''}</span>`).join('');
}
function renderMqtt() {
  const pb = $('#pbody'); $('#mqttDot').hidden = true;
  if (!hasNet()) { pb.innerHTML = `<div class="mq"><div class="ph"><div><h2>${t('mqTitle')}</h2></div></div><p class="info">${t('mqNoNative')}</p></div>`; return; }
  const st = NET.status || {}; const on = st.running;
  const addrs = (st.addresses || []).map(a => `<div class="addr">${esc(a.address)}:${st.port}</div>`).join('') || `<span class="hint">${t('mqNoLan')}</span>`;
  pb.innerHTML = `<div class="mq">
    <div class="ph"><div><h2>${t('mqTitle')}</h2><div class="sb">${t('mqSub')}</div></div></div>
    <div class="stat${on ? '' : ' off'}"><i></i>${on ? t('mqRunning', { p: st.port }) : st.error === 'EADDRINUSE' ? t('mqPortBusy', { p: st.port }) : t('mqStopped') + (st.error ? ' (' + esc(st.error) + ')' : '')}</div>
    <label class="sw2"><input type="checkbox" id="mqShare"${st.share ? ' checked' : ''}><span><b>${t('mqShare')}</b><br><span class="hint">${t('mqShareHint')}</span></span></label>
    ${st.share ? `<div><span class="lbl">${t('mqAddr')}</span><div class="chips" style="flex-direction:column;align-items:flex-start">${addrs}</div><p class="hint">${t('mqFirewall')}</p></div>` : ''}
    <label class="sw2"><input type="checkbox" id="mqNet"${st.internet ? ' checked' : ''}><span><b>${t('mqInternet')}</b><br><span class="hint">${t('mqInternetHint')}</span></span></label>
    <div><span class="lbl">${t('mqPort')}</span><div class="sirow"><input class="inp" id="mqPort" type="number" min="1" max="65535" value="${st.port || 1883}"><button class="btn" id="mqPortApply">${t('mqApply')}</button></div></div>
    <div><span class="lbl">${t('mqHowTo')}</span><pre class="addr" style="white-space:pre-wrap;user-select:text">from umqtt.simple import MQTTClient
c = MQTTClient("plytka1", "localhost")
c.connect()
c.publish("klasa/temp", "21.5")</pre><p class="hint">${t('mqHowToHint')}</p></div>
    <div><span class="lbl">${t('mqClients')} (${(st.clients || []).length})</span><div class="chips" id="mqClients">${mqttClientsHtml(st)}</div></div>
    <div><span class="lbl">${t('mqSend')}</span><form class="pubf" id="mqPub"><input class="inp" id="mqTopic" placeholder="${esc(t('mqTopic'))}" value="${esc(NET.pub.topic)}"><input class="inp" id="mqPayload" placeholder="${esc(t('mqPayload'))}" value="${esc(NET.pub.payload)}"><label class="full"><input type="checkbox" id="mqRetain"${NET.pub.retain ? ' checked' : ''}> retain <button class="btn pri" style="margin-left:auto"${on ? '' : ' disabled'}>${t('send')}</button></label></form></div>
    <div><span class="lbl" style="display:flex;align-items:center">${t('mqLog')}<button class="btn" id="mqClear" style="margin-left:auto;padding:2px 8px;text-transform:none;letter-spacing:0">${t('clearOut')}</button></span><div class="mlog" id="mqLog">${mqttLogHtml()}</div></div>
  </div>`;
  $('#mqShare').onchange = e => netSave({ share: e.target.checked });
  $('#mqNet').onchange = e => netSave({ internet: e.target.checked });
  $('#mqPortApply').onclick = () => { const v = +$('#mqPort').value; if (v >= 1 && v <= 65535) netSave({ port: v }); };
  $('#mqClear').onclick = () => { NET.log = []; $('#mqLog').innerHTML = mqttLogHtml(); };
  $('#mqTopic').oninput = e => NET.pub.topic = e.target.value; $('#mqPayload').oninput = e => NET.pub.payload = e.target.value; $('#mqRetain').onchange = e => NET.pub.retain = e.target.checked;
  $('#mqPub').onsubmit = e => { e.preventDefault(); if (!NET.pub.topic) return; window.cappyNative.netPublish({ topic: NET.pub.topic, payload: NET.pub.payload, retain: NET.pub.retain }); };
}
let mqttT = 0;
function mqttRefresh(type) {
  if (type === 'log') { clearTimeout(mqttT); mqttT = setTimeout(() => { const el = $('#mqLog'); if (el) el.innerHTML = mqttLogHtml(); }, 60); return; }
  if (type === 'status') { const a = document.activeElement; if (a && a.closest && a.closest('#mqPub')) { const cl = $('#mqClients'); if (cl) cl.innerHTML = mqttClientsHtml(NET.status); return; } renderMqtt(); }
}
