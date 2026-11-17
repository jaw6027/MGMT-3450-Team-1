/* Optional Drone SHM usability phase. Load after api.js and before dashboard.js. */
(() => {
  'use strict';
  if (window.SHMUsability || !window.SHMapi) return;
  window.SHMUsability = true;
  const $ = id => document.getElementById(id);
  const main = document.querySelector('main');
  if (!main || !$('trends') || !$('metricSelect')) return;
  const sensors = {
    strain_arm_1: ['Strain arm 1', 'µε', 'Microstrain describes stretching or compression at the gauge. It is not a displacement measurement.'],
    strain_arm_2: ['Strain arm 2', 'µε', 'Compare the two monitored arms in context; a difference alone does not establish damage.'],
    vibration_1: ['Vibration point 1', 'g RMS', 'RMS summarizes acceleration over a measurement window. It does not report vibration frequency.'],
    vibration_2: ['Vibration point 2', 'g RMS', 'The displayed association with arm 2 is an assumption until the mounting position is confirmed.'],
    motor_temp_1: ['Motor temperature 1', '°C', 'Temperature near a motor mount; this is not necessarily the internal winding temperature.'],
    motor_temp_2: ['Motor temperature 2', '°C', 'Interpret temperature with the sensor position and operating conditions. No validated limit is configured.']
  };
  const number = value => value === null || value === undefined || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value)) ? null : Number(value);
  const format = (value, key) => number(value) === null ? 'Unavailable' : number(value).toFixed(key.startsWith('vibration') ? 4 : key.startsWith('motor') ? 2 : 1);
  const stamp = value => { const date = new Date(value); return value && Number.isFinite(date.getTime()) ? date.toISOString() : 'Unavailable'; };
  const skip = document.createElement('a');
  skip.className = 'ux-skip'; skip.href = '#ux-start'; skip.textContent = 'Skip to dashboard tools';
  document.body.prepend(skip);
  const tools = document.createElement('section');
  tools.id = 'ux-start'; tools.className = 'ux-tools'; tools.tabIndex = -1;
  tools.setAttribute('aria-labelledby', 'ux-title');
  tools.innerHTML = `<div class="ux-heading"><div><p class="ux-kicker">DASHBOARD TOOLS</p><h2 id="ux-title">Understand your readings</h2><p>Start with the data source, then explore a sensor. Missing readings stay unavailable.</p></div><a class="ux-button" href="#ux-help">How to use this dashboard</a></div>
    <div class="ux-actions"><button type="button" id="ux-motion" aria-pressed="false">Reduce motion</button><button type="button" id="ux-text" aria-pressed="false">Larger text</button><a href="#ux-data">View readings as a table</a></div>
    <p class="ux-mode" id="ux-mode" role="status"></p>`;
  main.querySelector('header').after(tools);
  const help = document.createElement('section'); help.id = 'ux-help'; help.className = 'ux-help';
  help.setAttribute('aria-labelledby', 'ux-help-title');
  help.innerHTML = `<p class="ux-kicker">QUICK START & REFERENCE</p><h2 id="ux-help-title">A clearer path through the dashboard</h2>
    <ol class="ux-steps"><li><b>Choose your source.</b> Demo is simulated. Live needs a configured real data feed and never substitutes demo readings.</li><li><b>Explore a measurement.</b> Choose a metric under Recent telemetry. Use the table for exact timestamps and missing values.</li><li><b>Check the context.</b> Read System notices and the source timestamp before interpreting a change.</li></ol>
    <label for="ux-search">Search dashboard help</label><input type="search" id="ux-search" placeholder="Try strain, battery, or no data" aria-describedby="ux-search-count">
    <p id="ux-search-count" role="status"></p><div id="ux-topics"></div><p id="ux-no-help" hidden>No matching topics. Try “live”, “units”, or clear your search.</p>`;
  main.querySelector('footer').before(help);
  const topics = [
    ['Demo versus live data', 'Demo readings are simulated examples, not physical measurements. Live mode displays only readings accepted by the configured backend. No data means there is no usable reading; it does not mean zero.'],
    ['Strain and microstrain units', 'Strain is local stretching or compression. µε means microstrain. Positive and negative values can reflect different loading directions. Gauge placement and calibration matter.'],
    ['Vibration and g RMS units', 'g is acceleration relative to standard gravity; RMS is root mean square. This is a summary of vibration amplitude, not its frequency or a structural damage classification.'],
    ['Temperature units', 'Motor temperature is reported in degrees Celsius (°C) near the mounting location. No calibrated warning or failure temperature is configured.'],
    ['Battery and radio reception', 'Battery percent and voltage require calibrated sensing. LoRa RSSI (dBm) and SNR (dB) describe the radio link, not the aircraft structure.'],
    ['No data or connection error', 'Check the Data source control and System notices. If Live is selected, ask the team to check the trusted sensor bridge and server configuration. Do not switch to Demo and treat its values as real measurements.'],
    ['Drone colors and movement', 'Arm curvature and wobble are illustrative. Color bands are display ranges, not validated safety thresholds. Reduce motion stops the illustrative movement without stopping data refresh.'],
    ['Readings, downloads, and timestamps', 'The table and CSV show the history returned by the current source, oldest to newest. Times are UTC. Missing values remain Unavailable. History and the latest sensor card may represent different samples; compare timestamps. Downloads contain only the selected metric and current returned history.']
  ];
  topics.forEach(([title, text]) => {
    const details = document.createElement('details'); const summary = document.createElement('summary'); const p = document.createElement('p');
    summary.textContent = title; p.textContent = text; details.append(summary, p); $('ux-topics').append(details);
  });
  $('ux-search').addEventListener('input', () => {
    const words = $('ux-search').value.toLowerCase().trim().split(/\s+/).filter(Boolean); let count = 0;
    [...$('ux-topics').children].forEach(topic => { const match = words.every(word => topic.textContent.toLowerCase().includes(word)); topic.hidden = !match; if (match) count++; });
    $('ux-search-count').textContent = `${count} of ${topics.length} help topics`; $('ux-no-help').hidden = count > 0;
  });
  $('ux-search-count').textContent = `${topics.length} help topics`;
  Object.entries(sensors).forEach(([key, [, unit, explanation]]) => {
    const card = $(key)?.closest('article'); if (!card) return;
    const details = document.createElement('details'); details.className = 'ux-sensor-help';
    const summary = document.createElement('summary'); summary.textContent = `About ${sensors[key][0].toLowerCase()}`;
    const p = document.createElement('p'); p.textContent = `${unit}: ${explanation}`; details.append(summary, p); card.append(details);
  });
  const data = document.createElement('section'); data.id = 'ux-data'; data.className = 'ux-data'; data.setAttribute('aria-labelledby', 'ux-data-title');
  data.innerHTML = `<div class="ux-heading"><div><h3 id="ux-data-title">Readings table</h3><p id="ux-summary">Waiting for history.</p></div><button type="button" id="ux-export" disabled>Download selected metric CSV</button></div><p id="ux-data-context"></p><p id="ux-refresh-note">Table refreshes with the dashboard. Times are UTC; missing values are not zero.</p><div class="ux-table-scroll" role="region" aria-label="Sensor readings" tabindex="0"><table><caption id="ux-caption">Selected metric history</caption><thead><tr><th scope="col">Time (UTC)</th><th scope="col" id="ux-value-heading">Value</th><th scope="col">Availability</th></tr></thead><tbody id="ux-rows"></tbody></table></div>`;
  $('trends').append(data);
  let history = [], source = '', paused = false, latest = null;
  const pause = document.createElement('button'); pause.type = 'button'; pause.textContent = 'Pause table updates'; pause.setAttribute('aria-pressed', 'false');
  $('ux-export').before(pause);
  function mode() {
    const live = $('dataModeSelect').value === 'live';
    $('ux-mode').textContent = live ? 'LIVE SELECTED · Measurements require a connected source. Check System notices for availability.' : 'DEMO SELECTED · All displayed measurements are simulated. Structural condition is not assessed.';
  }
  function render() {
    const key = $('metricSelect').value, [name, unit] = sensors[key] || [key, ''];
    const valid = history.map(row => number(row?.sensors?.[key]?.value)).filter(v => v !== null);
    $('ux-summary').textContent = history.length ? `${valid.length} of ${history.length} readings available${valid.length ? ` · Min ${format(Math.min(...valid), key)} · Max ${format(Math.max(...valid), key)} ${unit}` : ''}` : 'No history available for this source.';
    $('ux-caption').textContent = `${name} (${unit}) · ${source || 'Waiting for source'}`;
    $('ux-value-heading').textContent = `${name} (${unit})`;
    $('ux-data-context').textContent = `${paused ? 'PAUSED TABLE · ' : ''}${source || 'Waiting for source'} · ${history.length ? 'Last history timestamp: '+stamp(history.at(-1)?.timestamp_utc) : 'No history timestamp'}`;
    $('ux-export').disabled = !history.length; $('ux-rows').replaceChildren();
    history.forEach(row => {
      const tr = document.createElement('tr'); const value = row?.sensors?.[key]?.value;
      [stamp(row?.timestamp_utc), format(value, key), number(value) === null ? 'Unavailable' : 'Available'].forEach(text => { const td = document.createElement('td'); td.textContent = text; tr.append(td); }); $('ux-rows').append(tr);
    });
  }
  function reset() {
    history = []; latest = null; paused = false; source = $('dataModeSelect').value === 'live' ? 'Live history' : 'Simulated demo history';
    pause.textContent = 'Pause table updates'; pause.setAttribute('aria-pressed', 'false'); $('ux-refresh-note').textContent = 'Table refreshes with the dashboard. Times are UTC; missing values are not zero.'; mode(); render();
  }
  pause.addEventListener('click', () => {
    paused = !paused; pause.setAttribute('aria-pressed', String(paused)); pause.textContent = paused ? 'Resume table updates' : 'Pause table updates';
    $('ux-refresh-note').textContent = paused ? 'Table and its CSV are frozen. Sensor cards, chart, notices, and source checks continue updating.' : 'Table refreshes with the dashboard. Times are UTC; missing values are not zero.';
    if (!paused && latest) history = latest; render();
  });
  const originalSnapshot = SHMapi.getSnapshot, originalHistory = SHMapi.getHistory;
  // Observe existing requests; never start another poll or change the API response.
  let generation = 0;
  SHMapi.getSnapshot = async function(selected) {
    const token = generation;
    try {
      const result = await originalSnapshot.call(this, selected);
      if (token === generation && selected === $('dataModeSelect').value && (result.connected === false || !result.reading)) { reset(); generation++; }
      return result;
    } catch (error) { if (token === generation) { reset(); generation++; } throw error; }
  };
  SHMapi.getHistory = async function(selected) {
    const token = generation;
    try {
      const result = await originalHistory.call(this, selected);
      if (token === generation && selected === $('dataModeSelect').value) {
        latest = Array.isArray(result.readings) ? result.readings.slice() : [];
        if (!paused) { history = latest; source = selected === 'demo' ? 'Simulated demo history' : 'Live history'; render(); }
      }
      return result;
    } catch (error) { if (token === generation) { reset(); generation++; } throw error; }
  };
  $('dataModeSelect').addEventListener('change', () => { generation++; reset(); });
  $('metricSelect').addEventListener('change', render);
  $('ux-export').addEventListener('click', () => {
    const key = $('metricSelect').value, [name, unit] = sensors[key];
    const cell = value => '"' + String(value).replace(/"/g, '""') + '"';
    const rows = [['timestamp_utc', `${name} (${unit})`, 'source', 'availability'], ...history.map(row => {
      const v = row?.sensors?.[key]?.value; return [stamp(row?.timestamp_utc), format(v, key), source, number(v) === null ? 'Unavailable' : 'Available'];
    })];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `drone-shm-${key}-${$('dataModeSelect').value}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  [['ux-motion', 'ux-reduce-motion', 'Reduce motion'], ['ux-text', 'ux-large-text', 'Larger text']].forEach(([id, cls]) => {
    const button = $(id); let active = id === 'ux-motion' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { const saved = localStorage.getItem(cls); if (saved !== null) active = saved === 'true'; } catch (_) {}
    function apply() { document.documentElement.classList.toggle(cls, active); button.setAttribute('aria-pressed', String(active)); }
    button.addEventListener('click', () => { active = !active; apply(); try { localStorage.setItem(cls, String(active)); } catch (_) {} }); apply();
  });
  document.querySelectorAll('.sidebar nav a').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.sidebar nav a').forEach(item => item.classList.toggle('active', item === link));
  }));
  reset();
})();
