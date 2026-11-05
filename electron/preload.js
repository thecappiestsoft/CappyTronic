const { contextBridge, ipcRenderer } = require('electron');
const mqttListeners = [], netListeners = [], tcpListeners = [], webListeners = [];
ipcRenderer.on('net:event', (e, ev) => {
  if (ev.type === 'mqtt') { for (const f of mqttListeners) try { f(ev.data); } catch (x) { } return; }
  if (ev.type === 'tcp') { for (const f of tcpListeners) try { f(ev.data); } catch (x) { } return; }
  if (ev.type === 'web') { for (const f of webListeners) try { f(ev.data); } catch (x) { } return; }
  for (const f of netListeners) try { f(ev); } catch (x) { }
});
contextBridge.exposeInMainWorld('cappyNative', {
  compile: o => ipcRenderer.invoke('compile', o),
  saveFile: (name, data, kind) => ipcRenderer.invoke('saveFile', name, data, kind),
  netStatus: () => ipcRenderer.invoke('net:status'),
  netConfig: c => ipcRenderer.invoke('net:config', c),
  netPublish: o => ipcRenderer.invoke('net:publish', o),
  onNetEvent: f => { netListeners.push(f); },
  onMqttMessage: f => { mqttListeners.push(f); },
  mqttConnect: o => ipcRenderer.invoke('mqtt:connect', o),
  mqttPublish: o => ipcRenderer.invoke('mqtt:publish', o),
  mqttSubscribe: o => ipcRenderer.invoke('mqtt:subscribe', o),
  mqttUnsubscribe: o => ipcRenderer.invoke('mqtt:unsubscribe', o),
  mqttPing: o => ipcRenderer.invoke('mqtt:ping', o),
  mqttEnd: h => ipcRenderer.invoke('mqtt:end', h),
  http: o => ipcRenderer.invoke('http:request', o),
  compileCpp: o => ipcRenderer.invoke('compileCpp', o),
  compileStm: o => ipcRenderer.invoke('compileStm', o),
  dns: o => ipcRenderer.invoke('net:dns', o),
  tcpOpen: o => ipcRenderer.invoke('tcp:open', o),
  tcpWrite: o => ipcRenderer.invoke('tcp:write', o),
  tcpClose: h => ipcRenderer.invoke('tcp:close', h),
  tcpListen: o => ipcRenderer.invoke('tcp:listen', o),
  tcpUnlisten: lid => ipcRenderer.invoke('tcp:unlisten', lid),
  onTcp: f => { tcpListeners.push(f); },
  webListen: o => ipcRenderer.invoke('web:listen', o),
  webResp: o => ipcRenderer.invoke('web:resp', o),
  webClose: sid => ipcRenderer.invoke('web:close', sid),
  onWeb: f => { webListeners.push(f); },
  onSerialPorts: f => { ipcRenderer.on('serial:ports', (e, list) => f(list)); },
  serialChoose: id => ipcRenderer.send('serial:choose', id),
});
