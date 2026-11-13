/* Pure calculations, sample generation, and the live endpoint contract. */
const MarketingModel = (() => {
  'use strict';
  const channels=['Google Ads','Meta Ads','LinkedIn Ads','Organic'];
  const fields=['spend','impressions','clicks','leads','conversions','revenue'];
  const ratio=(a,b,multiplier=1)=>b>0?a/b*multiplier:null;
  function summarize(rows) {
    const totals=Object.fromEntries(fields.map(key=>[key,rows.reduce((sum,row)=>sum+row[key],0)]));
    return {...totals,ctr:ratio(totals.clicks,totals.impressions,100),cac:ratio(totals.spend,totals.conversions),roas:ratio(totals.revenue,totals.spend)};
  }
  function metric(row,key) {
    if(key==='ctr')return ratio(row.clicks,row.impressions,100);
    if(key==='cac')return ratio(row.spend,row.conversions);
    if(key==='roas')return ratio(row.revenue,row.spend);
    return row[key];
  }
  function sample(settings,time,index) {
    const wave=1+Math.sin(index*1.7)*.16,channel=channels[((index%channels.length)+channels.length)%channels.length];
    const impressions=Math.round(settings.impressions*wave),clicks=Math.round(impressions*settings.ctr/100),leads=Math.round(clicks*settings.lead/100),conversions=Math.round(leads*settings.close/100);
    const spend=channel==='Organic'?0:Math.round(clicks*settings.cpc*(1+Math.sin(index*.7)*.09)*100)/100;
    return {timestamp:new Date(time).toISOString(),channel,impressions,clicks,leads,conversions,spend,revenue:conversions*180};
  }
  function simulate(settings,now=Date.now(),offset=0) {return Array.from({length:40},(_,i)=>sample(settings,now-(39-i)*15000,offset+i));}
  function validatePayload(payload) {
    if(!payload || typeof payload!=='object' || Array.isArray(payload))throw new Error('Expected a JSON object.');
    if(payload.currency!=='USD')throw new Error('This dashboard requires currency: USD. Convert amounts in your backend.');
    const validTime=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
    if(!validTime(payload.updatedAt))throw new Error('updatedAt must be an ISO timestamp with a time zone.');
    if(!Array.isArray(payload.intervals) || payload.intervals.length>10000)throw new Error('intervals must be an array with at most 10,000 records.');
    const seen=new Set();
    const rows=payload.intervals.map((row,index)=>{
      if(!row || !validTime(row.timestamp))throw new Error(`Interval ${index+1}: invalid timestamp.`);
      if(typeof row.channel!=='string' || !row.channel.trim() || row.channel.length>100)throw new Error(`Interval ${index+1}: channel is required (up to 100 characters).`);
      for(const key of fields)if(typeof row[key]!=='number' || !Number.isFinite(row[key]) || row[key]<0 || row[key]>1e12)throw new Error(`Interval ${index+1}: ${key} must be a finite nonnegative number up to 1e12.`);
      for(const key of ['impressions','clicks','leads','conversions'])if(!Number.isInteger(row[key]))throw new Error(`Interval ${index+1}: ${key} must be an integer.`);
      if(row.clicks>row.impressions || row.leads>row.clicks || row.conversions>row.leads)throw new Error(`Interval ${index+1}: expected impressions ≥ clicks ≥ leads ≥ conversions.`);
      const normalized={timestamp:new Date(row.timestamp).toISOString(),channel:row.channel.trim(),...Object.fromEntries(fields.map(key=>[key,row[key]]))};
      const key=normalized.timestamp+'|'+normalized.channel;
      if(seen.has(key))throw new Error('Duplicate timestamp/channel interval.');seen.add(key);
      if(Date.parse(normalized.timestamp)>Date.parse(payload.updatedAt))throw new Error('An interval is newer than updatedAt.');
      return normalized;
    }).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)||a.channel.localeCompare(b.channel));
    if(Date.parse(payload.updatedAt)>Date.now()+60000)throw new Error('updatedAt is more than 60 seconds in the future.');
    return {updatedAt:new Date(payload.updatedAt).toISOString(),intervals:rows.slice(-40),currency:'USD'};
  }
  function csv(rows) {
    const cell=value=>'"'+String(/^[=+@\-\t\r]/.test(String(value))?"'"+value:value).replaceAll('"','""')+'"';
    return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
  }
  return {channels,fields,ratio,summarize,metric,sample,simulate,validatePayload,csv};
})();
if(typeof module!=='undefined')module.exports=MarketingModel;
