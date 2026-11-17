/* Optional replacement renderer: preserve sample spacing and gaps for missing data. */
window.SHMchart = function(canvas, readings, key) {
  const width = Math.max(300, canvas.getBoundingClientRect().width), height = 260, ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio; canvas.height = height * ratio;
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  const values = readings.map(row => {
    const value = row[key];
    return value === null || value === undefined || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value)) ? null : Number(value);
  });
  const available = values.filter(value => value !== null);
  ctx.font = '12px system-ui'; ctx.fillStyle = '#c1d4e0';
  if (!available.length) { ctx.fillText('No telemetry available. See readings table below.', 20, 80); return; }
  const low = Math.min(...available), high = Math.max(...available), padding = (high - low || Math.max(Math.abs(high) * .1, 1)) * .2;
  const min = low - padding, max = high + padding, left = 62, right = width - 16, top = 22, bottom = height - 32;
  for (let i = 0; i <= 4; i++) {
    const y = top + (bottom - top) * i / 4;
    ctx.strokeStyle = '#3d5363'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.fillStyle = '#c1d4e0'; ctx.fillText((max - (max - min) * i / 4).toFixed(key.startsWith('vibration') ? 4 : 1), 4, y + 4);
  }
  ctx.strokeStyle = '#8cd9e8'; ctx.fillStyle = '#8cd9e8'; ctx.lineWidth = 2.5;
  let previous = false; ctx.beginPath();
  values.forEach((value, i) => {
    if (value === null) { previous = false; return; }
    const x = left + (values.length === 1 ? (right - left) / 2 : i * (right - left) / (values.length - 1)), y = top + (max - value) / (max - min) * (bottom - top);
    if (previous) ctx.lineTo(x, y); else ctx.moveTo(x, y); previous = true;
  }); ctx.stroke();
  values.forEach((value, i) => {
    if (value === null) return;
    const x = left + (values.length === 1 ? (right - left) / 2 : i * (right - left) / (values.length - 1)), y = top + (max - value) / (max - min) * (bottom - top);
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = '#c1d4e0'; ctx.fillText('Older', left, height - 8); ctx.fillText('Latest', right - 40, height - 8);
};
