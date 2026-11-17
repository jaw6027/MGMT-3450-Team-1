(()=>{'use strict';
const $=id=>document.getElementById(id),keys=['strain_arm_1','strain_arm_2','vibration_1','vibration_2','motor_temp_1','motor_temp_2'];
const fmt=(n,d=1)=>n===null||n===undefined||n===''||!Number.isFinite(Number(n))?'—':Number(n).toFixed(d);
const value=(r,k)=>r?.sensors?.[k]?.value??null;
const flatten=r=>Object.fromEntries(keys.map(k=>[k,value(r,k)]));
let selectedMode='demo',history=[],requestCounter=0;
try{selectedMode=localStorage.getItem('shm-mode')==='live'?'live':'demo';}catch(e){}
function chart(){SHMchart($('trendChart'),history.map(flatten),$('metricSelect').value)}
function notices(items){$('alertsList').replaceChildren();(items||[]).forEach(a=>{const div=document.createElement('div');div.className='alert';const b=document.createElement('b');b.textContent=a.title;const s=document.createElement('span');s.textContent=a.message;div.append(b,s);$('alertsList').append(div)});}
function clearMeasurements(){keys.forEach(k=>$(k).textContent='—');['battery','voltage','rssi','snr'].forEach(k=>$(k).textContent='—');$('device').textContent='Not connected';$('health').textContent='Not assessed';window.SHMdrone?.update(null);history=[];chart();}
function setModeUI(){const live=selectedMode==='live';$('dataModeSelect').value=selectedMode;$('mode').textContent=live?'LIVE MODE':'DEMO MODE';$('modeStatus').classList.toggle('offline',live);$('modeStatus').classList.toggle('demo',!live);$('source').textContent=live?'Real sensor data only (no simulated fallback)':'Simulated server-side PHP readings';$('feedState').textContent=live?'WAITING FOR SENSOR DATA':'SIMULATION ACTIVE';$('feedState').className='feed-state '+(live?'waiting':'simulating');$('updated').textContent=live?'Waiting for live readings…':'Loading demo…';$('trendDescription').textContent=live?'Real sensor history, when configured; no simulated values':'40 simulated samples · 15-second spacing · not persisted';$('noticeType').textContent=live?'Live feed':'Demonstration only';}
async function refresh(){const generation=++requestCounter,mode=selectedMode;try{
 const [snap,series]=await Promise.all([SHMapi.getSnapshot(mode),SHMapi.getHistory(mode)]);
 if(generation!==requestCounter||mode!==selectedMode)return;
 const r=snap.connected===false&&mode==='live'?null:snap.reading;
 history=Array.isArray(series.readings)?series.readings:[];
 if(!r){clearMeasurements();$('updated').textContent='No live readings received';$('feedState').textContent='NO DATA / DISCONNECTED';$('feedState').className='feed-state waiting';$('modeStatus').classList.add('offline');notices(snap.alerts);return;}
 keys.forEach(k=>$(k).textContent=fmt(value(r,k),k.startsWith('vibration')?4:k.startsWith('motor')?2:1));
 $('device').textContent=r.device_id||'Unknown UAV';$('health').textContent=r.health_status||'Not assessed';$('battery').textContent=fmt(r.telemetry?.battery_percent,1);$('voltage').textContent=fmt(r.telemetry?.battery_voltage,2);$('rssi').textContent=fmt(r.telemetry?.lora_rssi_dbm,0);$('snr').textContent=fmt(r.telemetry?.lora_snr_db,1);
 $('updated').textContent='Updated '+new Date(r.timestamp_utc).toLocaleTimeString();$('feedState').textContent=mode==='live'?'LIVE READING RECEIVED':'SIMULATION ACTIVE';$('feedState').className='feed-state '+(mode==='live'?'connected':'simulating');$('modeStatus').classList.toggle('offline',false);
 notices(snap.alerts);chart();window.SHMdrone?.update(r);
 }catch(e){if(generation!==requestCounter)return;clearMeasurements();$('updated').textContent='Data unavailable';$('feedState').textContent='DATA SOURCE ERROR';$('feedState').className='feed-state waiting';$('modeStatus').classList.add('offline');notices([{title:'Unable to load telemetry',message:e.message}]);console.error(e)}}
 $('dataModeSelect').addEventListener('change',e=>{selectedMode=e.target.value==='live'?'live':'demo';try{localStorage.setItem('shm-mode',selectedMode);}catch(err){}requestCounter++;clearMeasurements();setModeUI();refresh()});
 $('metricSelect').addEventListener('change',chart);window.addEventListener('resize',chart);setModeUI();clearMeasurements();refresh();setInterval(refresh,5000);
})();
