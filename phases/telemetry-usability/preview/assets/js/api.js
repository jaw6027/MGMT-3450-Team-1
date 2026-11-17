window.SHMapi = {
 async request(endpoint,mode){const response=await fetch(`api/${endpoint}?mode=${encodeURIComponent(mode)}`,{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const payload=await response.json();if(!payload.success)throw new Error(payload.error||'API error');if(payload.mode!==mode)throw new Error('Unexpected data source');return payload;},
 getSnapshot(mode){return this.request('live-sensors.php',mode);},
 getHistory(mode){return this.request('history.php',mode);}
};
