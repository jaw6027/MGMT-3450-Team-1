/* LOCAL REVIEW FIXTURE ONLY. Never deploy this in place of the PHP API. */
(() => {
  const keys = ['strain_arm_1', 'strain_arm_2', 'vibration_1', 'vibration_2', 'motor_temp_1', 'motor_temp_2'];
  function reading(i, base) {
    const values = [85 + Math.sin(i / 3) * 20, 110 + Math.cos(i / 4) * 18, .13 + Math.sin(i / 5) * .02, .14 + Math.cos(i / 4) * .02, 31 + Math.sin(i / 6), 33 + Math.cos(i / 7)];
    return {device_id:'UAV-SHM-01 · LOCAL FIXTURE', timestamp_utc:new Date(base - (39 - i) * 15000).toISOString(), is_simulated:true, health_status:'Demo / Not assessed', sensors:Object.fromEntries(keys.map((key, n) => [key,{value:i === 16 && n === 0 ? null : values[n]}])), telemetry:{battery_percent:81.6,battery_voltage:3.86,lora_rssi_dbm:-70,lora_snr_db:6.4}};
  }
  let batch = [], base = 0;
  window.SHMapi = {
    async getSnapshot(mode) {
      base = Date.now(); batch = Array.from({length:40}, (_, i) => reading(i, base));
      return {success:true, mode, connected:mode === 'demo', reading:mode === 'demo' ? batch.at(-1) : null, alerts:[{title:mode === 'demo' ? 'Local simulated preview' : 'No live connection in preview', message:'This isolated review uses browser-generated fixtures. The university website and hardware are not connected.'}]};
    },
    async getHistory(mode) { return {success:true,mode,readings:mode === 'demo' ? batch : []}; }
  };
})();
