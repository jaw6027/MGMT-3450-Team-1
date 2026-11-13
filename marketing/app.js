(() => {
  'use strict';
  const model=MarketingModel,$=id=>document.getElementById(id);
  const state={mode:'demo',rows:[],updatedAt:null,error:'',pending:false,endpoint:'',hasResponse:false,sequence:0,offset:0,nextIndex:40};
  let controller=null,sortKey='timestamp',sortDirection=-1;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
  const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
  const time=value=>new Date(value).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const format=(value,key)=>value===null?'—':['spend','cac','revenue'].includes(key)?money(value):key==='ctr'?value.toFixed(2)+'%':key==='roas'?value.toFixed(2)+'×':number(value);
  const definitions=[['spend','Outreach Spend','Outreach investment','Σ'],['impressions','Impressions','Buyer audience reach','◉'],['ctr','CTR','Outreach engagement','↗'],['conversions','Conversions','Buyer response tracking','◇'],['cac','Customer Acquisition Cost','Segment acquisition cost','÷'],['roas','Return on Outreach Spend','Attributed buyer revenue','×']];
  const columns=[['timestamp','Time'],['channel','Buyer segment'],['spend','Outreach spend'],['impressions','Impressions'],['ctr','CTR'],['leads','Leads'],['conversions','Conversions'],['cac','CAC'],['roas','ROAS']];
  function settings(){return Object.fromEntries(['impressions','ctr','lead','close','cpc'].map(key=>[key,Number($('demo-'+key).value)]));}
  function selected(){return state.rows.filter(row=>$('channel').value==='all'||row.channel===$('channel').value);}
  function regenerate(){const offset=state.offset++;state.rows=model.simulate(settings(),Date.now(),offset);state.nextIndex=offset+40;state.updatedAt=new Date().toISOString();render();}
  function updateChannels(){
    const channels=[...new Set(state.rows.map(row=>row.channel))].sort(),select=$('channel');
    const next=['all',...channels];
    if(JSON.stringify([...select.options].map(option=>option.value))!==JSON.stringify(next)){
      const previous=select.value;select.innerHTML='<option value="all">All buyer segments</option>'+channels.map(channel=>`<option value="${escape(channel)}">${escape(channel)}</option>`).join('');
      select.value=next.includes(previous)?previous:'all';
    }
  }
  function renderKpis(rows){
    const totals=rows.length?model.summarize(rows):null;
    const segment=$('channel').value==='all'?'All buyer segments':$('channel').value;
    $('kpis').innerHTML=definitions.map(([key,label,tag,symbol])=>`<article class="kpi"><div class="kpi-title"><span>${label}</span><span class="kpi-symbol" aria-hidden="true">${symbol}</span></div><strong class="kpi-value">${totals?format(totals[key],key):'—'}</strong><span class="source-tag">${escape(segment)}</span><p class="kpi-note">${state.mode==='demo'?'Simulated':'Backend aggregate'} · ${escape(tag)}${totals&&totals[key]===null?' · No denominator':''}</p></article>`).join('');
  }
  function renderFunnel(rows){
    const svg=$('funnel'),mobile=svg.clientWidth<500,canvasWidth=mobile?520:740;
    const segment=$('channel').value==='all'?'All buyer segments':$('channel').value;
    const segments=state.mode==='demo'?model.channels:[...new Set(state.rows.map(row=>row.channel))];
    $('funnel-segments').innerHTML=segments.map(name=>`<button type="button" class="segment-chip" data-segment="${escape(name)}" aria-pressed="${$('channel').value===name}">${escape(name)}</button>`).join('');
    $('funnel-scope').textContent=segment+' · impressions → clicks → leads → conversions';
    svg.setAttribute('viewBox',`0 0 ${canvasWidth} 370`);
    if(!rows.length){svg.innerHTML=`<title id="funnel-svg-title">No funnel data</title><desc id="funnel-svg-description">Connect a valid API endpoint or use Demo Mode.</desc><text x="${canvasWidth/2}" y="180" text-anchor="middle" fill="#83969f" font-size="16">Waiting for segment measurements</text>`;return;}
    const totals=model.summarize(rows),stages=[['Impressions',totals.impressions],['Clicks',totals.clicks],['Leads',totals.leads],['Conversions',totals.conversions]];
    const widths=stages.map(([,count])=>totals.impressions>0&&count>0?24+Math.sqrt(count/totals.impressions)*(mobile?220:390):0),center=mobile?145:240,labelX=mobile?300:500,rateX=mobile?428:635;
    const description=segment+'. '+stages.map(([name,count])=>name+': '+number(count)).join('; ');
    svg.innerHTML=`<title id="funnel-svg-title">Marketing conversion funnel</title><desc id="funnel-svg-description">${escape(description)}. Stage widths use a square-root scale.</desc><line x1="${center}" x2="${center}" y1="15" y2="345" stroke="#cddde0" stroke-dasharray="3 6"/>`+stages.map(([name,count],i)=>{
      const top=25+i*79,bottom=top+66,w=widths[i],next=widths[i+1]??w*.7;
      const rate=i===0?null:model.ratio(count,stages[i-1][1],100),light=rate===null?74:83-Math.min(100,rate)*.38;
      return `${w?`<polygon points="${center-w/2},${top} ${center+w/2},${top} ${center+next/2},${bottom} ${center-next/2},${bottom}" fill="hsl(${163+i*3} 26% ${light}%)" stroke="#67988f" stroke-width="1"/>`:''}<text x="${mobile?5:24}" y="${top+29}" fill="#6c8993" font-size="${mobile?12:9}" letter-spacing="1">0${i+1}</text><line x1="${center+w/2+10}" x2="${labelX-15}" y1="${top+32}" y2="${top+32}" stroke="#bacfd3" stroke-dasharray="3 4"/><text x="${labelX}" y="${top+17}" fill="#6c8590" font-size="${mobile?13:10}" letter-spacing="1">${name.toUpperCase()}</text><text x="${labelX}" y="${top+47}" fill="#244954" font-size="${mobile?25:23}" font-weight="550">${number(count)}</text><text x="${rateX}" y="${top+45}" fill="#627d85" font-size="${mobile?12:10}">${i===0?'ENTRY':rate===null?'—':rate.toFixed(1)+'% →'}</text>`;
    }).join('');
  }
  function renderChart(rows){
    const key=$('chart-metric').value,label=$('chart-metric').selectedOptions[0].textContent;
    $('chart-title').textContent=label;$('chart-source').textContent=state.mode==='demo'?'Simulated samples':'API measurements';
    const svg=$('trend-chart'),chartWidth=Math.max(300,Math.min(1100,svg.clientWidth||1100)),right=chartWidth-20,prefix=`<title id="chart-svg-title">${escape(label)} over time</title><desc id="chart-svg-description">${rows.length} buyer-segment intervals. Hover or focus points for exact values.</desc>`;
    svg.setAttribute('viewBox',`0 0 ${chartWidth} 250`);
    if(!rows.length){svg.innerHTML=prefix+`<text x="${chartWidth/2}" y="125" text-anchor="middle" fill="#81959e" font-size="13">No measurements to display</text>`;return;}
    const points=rows.map(row=>({row,value:model.metric(row,key)})),values=points.filter(p=>p.value!==null).map(p=>p.value),max=Math.max(...values,1)*1.12;
    const first=Date.parse(rows[0].timestamp),last=Date.parse(rows.at(-1).timestamp),x=row=>last===first?(65+right)/2:65+(Date.parse(row.timestamp)-first)/(last-first)*(right-65),y=value=>205-value/max*175;
    let grid='';for(let i=0;i<5;i++){const value=max*i/4,yy=y(value);grid+=`<line x1="65" x2="${right}" y1="${yy}" y2="${yy}" stroke="#e8eef0" stroke-dasharray="3 4"/><text x="52" y="${yy+3}" text-anchor="end" fill="#718993" font-size="10">${escape(new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value))}</text>`;}
    let path='',previousValid=false;
    for(const point of points){if(point.value===null){previousValid=false;continue;}path+=(previousValid?' L ':' M ')+x(point.row)+' '+y(point.value);previousValid=true;}
    const ticks=[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])].map(index=>`<text x="${x(rows[index])}" y="232" text-anchor="${index===0?'start':index===rows.length-1?'end':'middle'}" fill="#718993" font-size="9">${escape(time(rows[index].timestamp))}</text>`).join('');
    svg.innerHTML=prefix+grid+`<path d="${path}" fill="none" stroke="#468c80" stroke-width="2" stroke-linejoin="round"/>`+points.filter(p=>p.value!==null).map(p=>{const tip=`${time(p.row.timestamp)} · ${p.row.channel}: ${format(p.value,key)}`;return `<circle class="chart-point" cx="${x(p.row)}" cy="${y(p.value)}" r="3" fill="#72a697" tabindex="0" aria-label="${escape(tip)}"><title>${escape(tip)}</title></circle>`;}).join('')+ticks+(!values.length?`<text x="${chartWidth/2}" y="110" text-anchor="middle" fill="#81959e" font-size="12">No defined ratios for this selection</text>`:'');
  }
  function sortValue(row,key){return key==='timestamp'?Date.parse(row.timestamp):key==='channel'?row.channel:model.metric(row,key);}
  function renderTable(rows){
    document.querySelectorAll('#table-head th').forEach(th=>{const active=th.dataset.key===sortKey;th.setAttribute('aria-sort',active?(sortDirection===1?'ascending':'descending'):'none');th.querySelector('button').textContent=columns.find(([key])=>key===th.dataset.key)[1]+(active?(sortDirection===1?' ↑':' ↓'):' ↕');});
    const ordered=[...rows].sort((a,b)=>{const av=sortValue(a,sortKey),bv=sortValue(b,sortKey);if(av===null)return bv===null?0:1;if(bv===null)return -1;return (typeof av==='string'?av.localeCompare(bv):av-bv)*sortDirection;});
    $('table-body').innerHTML=ordered.length?ordered.map(row=>`<tr>${columns.map(([key])=>`<td>${key==='timestamp'?`<time datetime="${escape(row.timestamp)}" title="${escape(new Date(row.timestamp).toLocaleString())}">${escape(time(row.timestamp))}</time>`:key==='channel'?`<span class="channel-dot" aria-hidden="true"></span>${escape(row.channel)}`:escape(format(model.metric(row,key),key))}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="9" class="empty">No segment intervals available. Connect an endpoint or switch to Demo Mode.</td></tr>';
    $('table-description').textContent=`${rows.length} of ${state.rows.length} recent intervals shown. Select a column header to sort.`;
    $('export').disabled=!rows.length;
  }
  function renderNotice(){
    const notice=$('notice');let level='',title='',message='';
    const budget=Number($('budget').value),stale=state.mode==='live'&&state.updatedAt&&(Date.now()-Date.parse(state.updatedAt)>60000||(state.rows.length&&Date.now()-Date.parse(state.rows.at(-1).timestamp)>60000));
    if(state.error){level='error';title='Live source unavailable';message=state.error+' No simulated values are shown.';}
    else if(state.mode==='live'&&!state.rows.length){level='warning';title=state.pending?'Connecting to live telemetry':state.hasResponse?'Live source returned no intervals':'Waiting for live telemetry';message=state.hasResponse?'The endpoint is connected but returned an empty interval list. No campaign measurements are available.':'Choose an API endpoint that follows the documented JSON contract. No campaign data is available yet.';}
    else if(stale){level='warning';title='Live telemetry is stale';message='The latest source update or measurement is more than 60 seconds old. Displayed values are the last received measurements.';}
    else if(!Number.isFinite(budget)||budget<1||budget>1e9){level='warning';title='Enter a valid budget limit';message='Use a rolling-window budget between $1 and $1,000,000,000 to enable pacing notices.';}
    else{const spent=model.summarize(state.rows).spend,used=spent/budget*100;level=used>=100?'error':used>=80?'warning':'';title=used>=100?'Budget pacing: window limit exceeded':used>=80?'Budget pacing: approaching the window limit':'Budget pacing: within the window limit';message=`${money(spent)} across all displayed buyer segments · ${used.toFixed(1)}% of the ${money(budget)} rolling-window budget. ${state.mode==='demo'?'Demonstration thresholds: notice at 80%, exceeded at 100%.':'Configured notice thresholds: 80% and 100%.'}`;}
    notice.className='notice '+level;notice.innerHTML=`<span class="notice-icon" aria-hidden="true">${level?'!':'✓'}</span><div><strong>${escape(title)}</strong><p>${escape(message)}</p></div>`;
  }
  function render(){
    updateChannels();const rows=selected();renderKpis(rows);renderFunnel(rows);renderChart(rows);renderTable(rows);renderNotice();
    $('sample-count').textContent=`${rows.length} intervals${state.mode==='demo'?' · 15-second spacing across segments':' · source timestamps'}`;
    $('status-label').textContent=state.mode==='demo'?'Simulation active':state.error?'Connection unavailable':state.pending?'Refreshing live source':state.rows.length?'Live source connected':state.hasResponse?'Connected · no intervals':'Awaiting API endpoint';
    $('updated').textContent=state.updatedAt?'Updated '+time(state.updatedAt)+' · local time':'No measurements received';
    $('source-description').textContent=state.mode==='demo'?'Simulated buyer-segment data. No outreach systems are connected.':'Live mode uses only the configured endpoint. No mock data or fallback.';
    $('mode-badge').className='pill '+(state.mode==='demo'?'':state.error||!state.rows.length?'offline':'live');
    $('mode-badge').textContent=state.mode==='demo'?'SIMULATION ACTIVE':state.rows.length?'API DATA':state.hasResponse?'NO INTERVALS':'AWAITING DATA';
    $('connection-message').textContent=state.error||(state.mode==='live'&&!state.endpoint?'Enter your backend endpoint below to connect.':'');
    $('architecture-status').textContent=state.mode==='demo'?'Current route: browser simulation → dashboard.':state.hasResponse?'Current route: configured JSON endpoint → dashboard.':'Current route: live endpoint not connected.';
  }
  function stopRequest(){state.sequence++;if(controller)controller.abort();controller=null;state.pending=false;}
  async function fetchLive(){
    if(state.mode!=='live'||!state.endpoint||state.pending)return;
    const sequence=++state.sequence,requestController=new AbortController();controller=requestController;state.pending=true;render();
    const timeout=setTimeout(()=>requestController.abort(),10000);
    try{
      const response=await fetch(state.endpoint,{signal:requestController.signal,credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`Endpoint returned HTTP ${response.status}.`);
      if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('Endpoint must return application/json.');
      const text=await response.text();if(text.length>3000000)throw new Error('Response exceeds the 3 MB limit.');
      const payload=model.validatePayload(JSON.parse(text));
      if(sequence!==state.sequence||state.mode!=='live')return;
      state.rows=payload.intervals;state.updatedAt=payload.updatedAt;state.error='';state.hasResponse=true;
    }catch(error){if(sequence!==state.sequence||state.mode!=='live')return;state.rows=[];state.updatedAt=null;state.hasResponse=false;state.error=error.name==='AbortError'?'The endpoint did not respond within 10 seconds.':error instanceof SyntaxError?'Endpoint returned invalid JSON.':error.message==='Failed to fetch'?'Could not reach the endpoint. Check its address, network access, and CORS settings.':error.message;}
    finally{clearTimeout(timeout);if(sequence===state.sequence){state.pending=false;controller=null;render();}}
  }
  $('mode-toggle').addEventListener('click',()=>{
    stopRequest();state.mode=state.mode==='demo'?'live':'demo';state.rows=[];state.updatedAt=null;state.error='';state.hasResponse=false;
    const live=state.mode==='live';$('mode-toggle').setAttribute('aria-checked',String(live));$('api-form').hidden=!live;$('demo-controls').disabled=live;$('controls-note').textContent=live?'Simulation is disabled. Funnel geometry follows the endpoint’s measured counts.':'Adjust the inputs. Watch the entire system respond.';
    if(live){render();fetchLive();}else regenerate();
  });
  $('api-form').addEventListener('submit',event=>{
    event.preventDefault();stopRequest();state.rows=[];state.updatedAt=null;state.error='';state.endpoint='';state.hasResponse=false;
    try{const url=new URL($('api-endpoint').value.trim());if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS, or HTTP on localhost for development.');if(url.username||url.password)throw new Error('Do not put credentials in the endpoint URL.');state.endpoint=url.href;fetchLive();}catch(error){state.error=error.message==='Invalid URL'?'Enter a complete API URL, such as https://your-backend.example/api/marketing.':error.message;render();}
  });
  $('table-head').innerHTML=columns.map(([key,label])=>`<th scope="col" data-key="${key}" aria-sort="none"><button type="button" data-sort="${key}">${label} ↕</button></th>`).join('');
  $('table-head').addEventListener('click',event=>{const button=event.target.closest('[data-sort]');if(!button)return;sortDirection=sortKey===button.dataset.sort?-sortDirection:-1;sortKey=button.dataset.sort;renderTable(selected());});
  $('channel').addEventListener('change',render);$('chart-metric').addEventListener('change',()=>renderChart(selected()));$('budget').addEventListener('input',renderNotice);
  $('funnel-segments').addEventListener('click',event=>{const button=event.target.closest('[data-segment]');if(!button)return;$('channel').value=$('channel').value===button.dataset.segment?'all':button.dataset.segment;render();});
  $('demo-controls').addEventListener('input',()=>{if(state.mode==='demo'){renderOutputs();regenerate();}});
  function renderOutputs(){const s=settings();for(const key of Object.keys(s))$('value-'+key).textContent=key==='impressions'?number(s[key]):key==='cpc'?money(s[key]):s[key]+'%';}
  $('export').addEventListener('click',()=>{
    const keys=['timestamp','channel',...model.fields],rows=[keys,...selected().map(row=>keys.map(key=>row[key]))],url=URL.createObjectURL(new Blob([model.csv(rows)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='marketing-telemetry-'+state.mode+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  renderOutputs();regenerate();
  setInterval(()=>{if(state.mode==='demo'){state.rows.shift();state.rows.push(model.sample(settings(),Date.now(),state.nextIndex++));state.updatedAt=new Date().toISOString();render();}else fetchLive();},15000);
  setInterval(()=>{if(state.mode==='live')renderNotice();},5000);
  window.addEventListener('pagehide',stopRequest);
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{renderFunnel(selected());renderChart(selected());},100);});
})();
