// Real-company directory and persistent outreach tracking. Never sends outreach.
(()=>{
  'use strict';
  const root=document.getElementById('flightpath-draft'),M=ProspectModel;
  const $=s=>root.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=url=>{try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
  const link=(url,label)=>safe(url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
  let connected=false,editing=null,dirty=false;
  const style=document.createElement('style');style.textContent=`
    #flightpath-draft .prospect-facts{display:grid;gap:8px;margin-top:12px}
    #flightpath-draft .prospect-facts p{max-width:85ch}
    #flightpath-draft .prospect-facts details{padding:10px;background:var(--fp-panel);border:1px solid var(--fp-line);border-radius:6px}
    #flightpath-draft .prospect-facts summary{cursor:pointer}
    #flightpath-draft #prospect-outreach{width:min(600px,calc(100% - 24px));max-height:90vh;overflow:auto;color:var(--fp-ink);background:var(--fp-panel);border:1px solid var(--fp-line);border-radius:12px;padding:22px}
    #flightpath-draft #prospect-outreach form{display:grid;gap:14px}
    #flightpath-draft #prospect-outreach textarea{font:inherit;width:100%;min-height:110px;color:var(--fp-ink);background:var(--fp-panel);border:1px solid var(--fp-line);border-radius:6px;padding:9px}
    #flightpath-draft #prospect-outreach input[type=checkbox]{width:18px;min-height:18px}
    #flightpath-draft #prospect-outreach::backdrop{background:#15283a99}
  `;root.append(style);
  $('#fp-directory').insertAdjacentHTML('afterbegin',`<h2>Real prospect database</h2><p class="notice">Public-source research, separate from the fictional CRM. California sources were checked November 15, 2026; other states await recheck. Published contact channels have not been tested. A civilian label describes reviewed offerings, not proof of no military activity. Sources checked is not a legal operating-status certification or a confirmed customer need.</p><div class="toolbar" style="margin:14px 0"><button type="button" id="prospect-refresh">Refresh saved outreach</button><p id="prospect-connection" role="status">Connecting to saved outreach…</p></div><p id="prospect-quality-summary" class="muted" aria-live="polite"></p>`);
  root.insertAdjacentHTML('beforeend','<dialog id="prospect-outreach" aria-labelledby="prospect-outreach-title"></dialog>');
  const dialog=$('#prospect-outreach');
  const old=$('#fp-export'),exportButton=old.cloneNode(true);old.replaceWith(exportButton);
  function matching(){
    const q=$('#fp-search').value.trim().toLowerCase(),geo=$('#fp-state').value,market=$('#fp-market').value,segment=$('#fp-directory-segment').value,quality=$('#fp-quality').value,status=$('#fp-outreach').value;
    return FlightpathProspects.filter(p=>(geo==='all'||p.state===geo)&&(market==='all'||p.marketUse===market)&&(segment==='all'||p.segment===segment)&&M.matches(p,quality)&&(status==='all'||(p.outreachStatus||'Not contacted')===status)&&(!q||[p.name,p.city,p.focus,p.segment,p.contactEmail,p.contactPhone,p.notes].join(' ').toLowerCase().includes(q)));
  }
  function draw(){
    const list=matching();
    $('#prospect-quality-summary').textContent=`Current directory results: ${list.length} companies · ${list.filter(p=>M.quality(p)==='Sources checked').length} sources checked · ${list.filter(p=>M.quality(p)==='Not rechecked').length} not rechecked · ${list.filter(p=>['Recheck due','Needs recheck'].includes(M.quality(p))).length} due or flagged for recheck. Review dates expire after 90 days; sources are rechecked manually.`;
    $('#fp-directory-count').textContent=`${list.length} real-company prospects · Buying intent unknown unless your team independently confirms it.`;
    $('#fp-companies').innerHTML=list.map(p=>`<article class="company"><div><h2>${esc(p.name)}</h2><p>${p.city?esc(p.city)+", ":"City unconfirmed · "}${esc(p.state)} · ${esc(p.segment)}</p><div class="prospect-facts"><p><span class="badge">${esc(p.marketUse)}</span> <span class="badge">${esc(M.quality(p))}</span></p><p>${esc(p.focus)}</p><p class="muted">Activity: ${esc(p.activityStatus)} · Checked: ${esc(p.reviewedAt||'Not rechecked')} · Recheck due: ${esc(p.reviewDue||'Pending first recheck')}</p><p><strong>Public business contact:</strong> ${esc(p.contactType||'Not yet researched')}${p.contactEmail?' · '+esc(p.contactEmail):''}${p.contactPhone?' · '+esc(p.contactPhone):''} ${link(p.contactUrl,'Contact source')}</p><p class="muted">${p.contactCheckedAt?'Published channel checked '+esc(p.contactCheckedAt)+'; deliverability and decision-maker access unconfirmed.':'No contact channel verified in this review.'}</p><p><strong>Outreach:</strong> ${esc(p.outreachStatus||'Not contacted')} · Owner: ${esc(p.owner||'Unassigned')} · Next action: ${esc(p.nextActionDate||'Not scheduled')}</p>${p.outreachStatus==='Do not contact'?'<p><strong>Do not contact this prospect.</strong></p>':''}<p><strong>Fit hypothesis:</strong> ${esc(p.fitHypothesis)}</p><details><summary>Sources and verification notes</summary><p>${esc(p.activityNote)} ${link(p.activityEvidenceUrl,'Activity evidence')}</p><p><strong>Market:</strong> ${esc(p.marketNote)} ${link(p.marketEvidenceUrl||p.sourceUrl,'Market source')}</p><p><strong>Location:</strong> ${esc(p.locationNote)} ${link(p.locationSourceUrl,'Location source')}</p>${p.contactEmailSourceUrl?`<p>${link(p.contactEmailSourceUrl,'Published email source')}</p>`:''}<p><strong>Research next step:</strong> ${esc(p.nextResearchStep)}</p><p><strong>Team notes:</strong> ${esc(p.notes||'None recorded')}</p><p class="muted">Last outreach record saved: ${esc(p.updatedAt||'Never')}. Public records do not establish a relationship, budget or interest in our monitoring system.</p></details></div></div><div><button type="button" data-outreach-key="${esc(p.key)}" ${connected?'':'disabled'}>Manage outreach</button></div></article>`).join('')||'<p>No prospects match these filters. Try another location, market or verification status.</p>';
    exportButton.disabled=!list.length;
  }
  function redraw(){ $('#fp-state').dispatchEvent(new Event('change',{bubbles:true})); }
  async function refresh(){
    try{
      const r=await fetch('/api/prospects',{cache:'no-store'});if(!r.ok)throw Error('Prospect database unavailable. Start the updated Node server.');
      const body=await r.json();if(!Array.isArray(body.prospects)||!body.prospects.every(p=>typeof p.key==='string'&&Number.isSafeInteger(p.revision)))throw Error('Invalid prospect database response.');
      FlightpathProspects.splice(0,FlightpathProspects.length,...body.prospects);connected=true;
      $('#prospect-connection').textContent='Outreach connected to this running server. Separate laptops do not synchronize through GitHub.';
    }catch(e){connected=false;$('#prospect-connection').textContent=e.message+' Showing the last loaded research; saving is disabled.';}
    redraw();const submit=dialog.querySelector('[type=submit]');if(submit)submit.disabled=!connected;
  }
  function close(){if(dirty&&!window.confirm('Discard unsaved outreach changes?'))return;dirty=false;dialog.close();}
  function open(key){
    const p=FlightpathProspects.find(p=>p.key===key);if(!connected||!p)return;
    editing={key:p.key,revision:p.revision};dirty=false;
    dialog.innerHTML=`<form><h2 id="prospect-outreach-title">${esc(p.name)} · outreach</h2><p class="muted">This saves team tracking only. It does not contact the company or change sourced research.</p><label>Outreach status<select name="outreachStatus">${M.statuses.map(s=>`<option ${s===(p.outreachStatus||'Not contacted')?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label>Owner<input name="owner" maxlength="100" value="${esc(p.owner)}"></label><label>Last contact date<input name="lastContact" type="date" max="${M.today()}" value="${esc(p.lastContact)}"></label><label>Next action date<input name="nextActionDate" type="date" value="${esc(p.nextActionDate)}"></label><label>Notes / next action<textarea name="notes" maxlength="2000">${esc(p.notes)}</textarea></label><label><input name="dataIssue" type="checkbox" ${p.dataIssue?'checked':''}>Flag a data issue for recheck; explain it in notes</label><p id="prospect-save-error" role="alert"></p><div class="toolbar"><button type="submit">Save outreach</button><button type="button" id="prospect-close">Cancel</button></div></form>`;
    $('#prospect-close').addEventListener('click',close);
    dialog.querySelector('form').addEventListener('input',()=>{dirty=true;});
    dialog.querySelector('form').addEventListener('change',()=>{dirty=true;});
    dialog.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();const form=e.target,f=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;
      const payload={revision:editing.revision,...Object.fromEntries(['outreachStatus','owner','lastContact','nextActionDate','notes'].map(k=>[k,f.get(k)])),dataIssue:f.has('dataIssue')};
      try{
        const r=await fetch('/api/prospects/'+encodeURIComponent(editing.key),{method:'PUT',headers:{'Content-Type':'application/json','X-Customer-Write':'1'},body:JSON.stringify(payload)}),body=await r.json();
        if(!r.ok)throw Error(body.error||'Outreach was not saved.');
        FlightpathProspects.splice(0,FlightpathProspects.length,...body.prospects);dirty=false;dialog.close();redraw();$('#prospect-connection').textContent='Outreach saved to this running server. No message was sent.';
      }catch(error){$('#prospect-save-error').textContent=error.message+' Your form is preserved. If there is a conflict, copy your notes, cancel and refresh before reopening.';}
      finally{button.disabled=!connected;}
    });
    dialog.showModal();
  }
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  root.addEventListener('click',e=>{const b=e.target.closest('[data-outreach-key]');if(b)open(b.dataset.outreachKey);});
  root.addEventListener('flightpath:filters',draw);
  $('#prospect-refresh').addEventListener('click',refresh);
  exportButton.addEventListener('click',()=>{
    const fields=['key','name','segment','city','state','marketUse','activityStatus','reviewedAt','reviewDue','activityEvidenceUrl','marketEvidenceUrl','locationSourceUrl','locationNote','contactType','contactEmail','contactPhone','contactUrl','contactEmailSourceUrl','contactCheckedAt','buyingIntent','fitHypothesis','nextResearchStep','outreachStatus','owner','lastContact','nextActionDate','notes','dataIssue','updatedAt'];
    const rows=[fields,...matching().map(p=>fields.map(k=>p[k]??''))],url=URL.createObjectURL(new Blob([rows.map(r=>r.map(M.csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='flightpath-real-prospects.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  draw();refresh();
})();

