/* Workspace decision support. The existing CRM is read only from this page. */
(() => {
  'use strict';
  const root=document.getElementById('flightpath-draft'),M=SegmentStrategy;
  const $=s=>root.querySelector(s);
  const segments=['U.S. Air Force','U.S. Navy','Defense contractors','Commercial drone manufacturers','Agricultural drone companies','Infrastructure inspection companies','Civilian drone operators'];
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let settings={reviewer:'Brandon',source:'Research catalog',segments:segments.slice(),weights:M.criteria.map(c=>c.weight)};
  try { const old=JSON.parse(localStorage.getItem('flightpath.decision-settings.v1'));if(old){if(['Brandon','Josh'].includes(old.reviewer))settings.reviewer=old.reviewer;if(['Research catalog','CRM workspace (sample database)'].includes(old.source))settings.source=old.source;if(Array.isArray(old.segments)&&old.segments.some(s=>segments.includes(s)))settings.segments=old.segments.filter(s=>segments.includes(s));if(Array.isArray(old.weights)&&old.weights.length===5&&old.weights.every(w=>Number.isInteger(w)&&w>=0&&w<=100)&&old.weights.some(w=>w>0))settings.weights=old.weights;} } catch { /* Optional browser preferences. */ }
  let segmentation={groupBy:'segment',group:'all',qualification:'all',readiness:'all',minimum:0};
  let crm=null,team={revision:0,reviews:[]},ready=false,selected='',formReviewer='Brandon',dirty=false;
  const style=document.createElement('style');style.textContent=`
  #flightpath-draft .decision-settings{display:grid;gap:12px;border-block:1px solid var(--fp-line);padding:16px 0}
  #flightpath-draft .segment-choices{display:flex;gap:10px 18px;flex-wrap:wrap}
  #flightpath-draft .segment-choices label{display:flex;align-items:center;gap:6px}
  #flightpath-draft .decision-weights{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:12px}
  #flightpath-draft textarea{font:inherit;color:var(--fp-ink);background:var(--fp-panel);border:1px solid var(--fp-line);border-radius:6px;padding:9px;width:100%;min-width:0;resize:vertical}
  #flightpath-draft .review-fields{display:grid;gap:14px;margin-top:16px}
  #flightpath-draft .evidence-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(0,2fr);gap:12px;padding:14px 0;border-bottom:1px solid var(--fp-line)}
  #flightpath-draft .evidence-detail{display:grid;gap:8px}
  #flightpath-draft .decision-error{color:light-dark(#9b2c20,#ffb0a5)}
  #flightpath-draft .decision-table{min-width:630px}
  #flightpath-draft .decision-heading{margin-top:20px}
  #flightpath-draft .segmentation{background:var(--fp-panel);border:1px solid var(--fp-line);border-radius:12px;padding:20px;margin-bottom:24px;display:grid;gap:16px}
  #flightpath-draft .seg-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--fp-sub)}
  #flightpath-draft .seg-dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
  #flightpath-draft .seg-ready{background:#247a68}#flightpath-draft .seg-research{background:#b77a15}#flightpath-draft .seg-unassessed{background:#8593a8}#flightpath-draft .seg-blocked{background:#bd4e58}
  #flightpath-draft .seg-charts{display:grid;gap:9px}
  #flightpath-draft .seg-bar{display:grid;grid-template-columns:minmax(150px,1fr) minmax(80px,2fr) 36px;gap:12px;align-items:center;text-align:left;width:100%}
  #flightpath-draft .seg-bar[aria-pressed=true]{background:var(--fp-soft);color:var(--fp-ink);outline:2px solid var(--fp-action)}
  #flightpath-draft .seg-track{height:20px;display:flex;background:var(--fp-bg);border-radius:4px;overflow:hidden}
  #flightpath-draft .seg-count{text-align:right;font-variant-numeric:tabular-nums}
  #flightpath-draft button:focus-visible{outline:3px solid var(--fp-action);outline-offset:3px}
  @media(max-width:600px){#flightpath-draft .segmentation{padding:12px}#flightpath-draft .seg-bar{grid-template-columns:minmax(0,1fr) 36px}#flightpath-draft .seg-track{grid-row:2;grid-column:1 / -1}}

  #flightpath-draft .decision-settings input[type=checkbox]{min-height:0;width:18px;height:18px}
  @media(max-width:600px){#flightpath-draft .evidence-row{grid-template-columns:1fr}}
  `;root.append(style);
  $('.tabs').insertAdjacentHTML('afterend',`<section class="decision-settings" aria-label="Prospect comparison settings">
  <h2>Prospect comparison settings</h2><div class="toolbar"><label>Decision data<select id="decision-source"><option>Research catalog</option><option>CRM workspace (sample database)</option></select></label><label>Whose ratings to compare<select id="decision-reviewer"><option>Brandon</option><option>Josh</option></select></label><button type="button" id="decision-refresh">Refresh team reviews</button></div>
  <p class="muted">Catalog and CRM records stay separate. Geography and market filters exclude CRM records with unknown locations or market labels; choose all locations and labels to include them. Top summary cards always describe the research catalog.</p>
  <div class="segment-choices" role="group" aria-label="Segments to compare">${segments.map((s,i)=>`<label><input type="checkbox" data-segment="${i}" ${settings.segments.includes(s)?'checked':''}>${escape(s)}</label>`).join('')}</div>
  <details><summary>Prospect scoring weights</summary><div class="decision-weights">${M.criteria.map((c,i)=>`<label>${c.label}<input type="number" min="0" max="100" step="1" data-weight="${i}" value="${settings.weights[i]}" aria-label="${c.label} weight"></label>`).join('')}</div><p class="muted">Scores are weighted averages from 1–5. Weights are local viewing preferences. Unknown ratings stay blank; public evidence does not establish buying intent.</p></details>
  <p id="decision-connection" role="status">Connecting to workspace reviews…</p><p class="muted">Reviews are shared by windows using this running server. Separate laptops do not synchronize through GitHub. Reviewer names are labels, not authenticated accounts.</p><p id="decision-error" class="decision-error" role="alert"></p></section>`);
  $('#decision-source').value=settings.source;$('#decision-reviewer').value=settings.reviewer;
  $('#strategy-comparison').innerHTML='<h2>Compare segment readiness</h2><div id="decision-matrix" class="table-wrap"></div><p class="muted">Counts use selected data, segments, and filters. Fractions use unique matching companies in each segment; multi-segment companies can appear in several columns. Confirmation requires customer-conversation evidence. Review completion is not independent verification.</p><hr>';
  $('#strategy-comparison').insertAdjacentHTML('afterbegin',`<section class="segmentation" aria-labelledby="seg-title">
  <div><p class="eyebrow">CUSTOMER SEGMENTATION</p><h2 id="seg-title">Find your next outreach group</h2><p class="muted">Uses the location, market, search, data source, reviewer and segment selections above. Narrow by qualification or assessment, then select a bar to explore that group.</p></div>
  <div class="toolbar"><label>Compare groups by<select id="seg-group-by"><option value="segment">Buyer segment</option><option value="state">State</option><option value="market">Military-market focus</option></select></label><label>CRM qualification<select id="seg-qualification"><option value="all">All qualifications</option></select></label><label>Assessment status<select id="seg-readiness"><option value="all">All assessments</option><option>Ready to compare</option><option>Needs research</option><option>Unassessed</option><option>Blocked</option></select></label><label>Minimum assessed score<select id="seg-minimum"><option value="0">Any score / unassessed</option><option value="3">3+ / 5</option><option value="4">4+ / 5</option><option value="4.5">4.5+ / 5</option></select></label></div>
  <p class="muted">Ready to compare = all five criteria rated with evidence and compatible in the selected review. A blocker from either reviewer takes precedence. Scores reflect reviewer judgments; they do not establish purchase intent. Catalog qualification starts as Not assessed.</p>
  <div class="seg-legend"><span><i class="seg-dot seg-ready"></i>Ready to compare</span><span><i class="seg-dot seg-research"></i>Needs research</span><span><i class="seg-dot seg-unassessed"></i>Unassessed</span><span><i class="seg-dot seg-blocked"></i>Blocked</span></div>
  <p id="seg-summary" role="status" aria-live="polite"></p><div id="seg-charts" class="seg-charts" role="group" aria-label="Customer groups; select a bar to filter prospects"></div>
  <p class="muted">Bars show company counts on one shared scale. Multi-segment companies can appear in several segment bars; the prospect total counts each company once. Unknown locations remain labeled unknown.</p>
  <div class="toolbar"><p id="seg-selection"></p><button type="button" id="seg-clear-group">Show all groups</button><button type="button" id="seg-reset">Reset segmentation filters</button><button type="button" id="seg-export">Export matching prospects</button></div>
  <div id="seg-results" class="table-wrap"></div>
  </section>`);
  $('#fp-prospects').innerHTML='<h2>Evidence-backed prospect ratings</h2><p class="muted">Complete criteria from 1 (unfavorable) to 5 (favorable). Keep unknowns blank. A score does not override a technical blocker or establish customer intent.</p><div id="decision-ranking" class="table-wrap"></div><h2 class="decision-heading">Review a prospect</h2><p id="decision-form-note" class="muted"></p><div class="toolbar"><label>Prospect<select id="decision-prospect"></select></label><button type="button" id="decision-open">Open review</button></div><div id="decision-form"></div>';
  $('#fp-shortlist').innerHTML='<h2>Team shortlist</h2><p class="muted">All nominations across data sources, segments and filters are shown here. Brandon and Josh keep separate ratings and reasons. A technical blocker from either reviewer pauses the prospect for team resolution.</p><button type="button" id="decision-export">Export shortlist and evidence</button><div id="decision-shortlist" class="table-wrap"></div>';
  function persist(){try{localStorage.setItem('flightpath.decision-settings.v1',JSON.stringify(settings));}catch{}}
  function all(){return M.candidates(FlightpathProspects,crm);}
  function matching(){const geo=$('#fp-state').value,market=$('#fp-market').value,tokens=$('#fp-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);return all().filter(p=>p.source===settings.source&&p.segments.some(s=>settings.segments.includes(s))&&(geo==='all'||p.state===geo)&&(market==='all'||p.marketUse===market)&&ProspectModel.matches(p,$('#fp-quality').value)&&($('#fp-outreach').value==='all'||(p.outreachStatus||'Not contacted')===$('#fp-outreach').value)&&tokens.every(t=>[p.name,p.city,p.focus,p.contactEmail,p.contactPhone,p.notes,...p.segments].join(' ').toLowerCase().includes(t)));}
  function mine(key){return team.reviews.find(r=>r.prospect.key===key&&r.reviewer===settings.reviewer);}
  function fraction(n,d){return `${n}/${d}${d?' ('+Math.round(n/d*100)+'%)':''}`;}
  function render(){
    renderSegmentation();
    const candidates=matching(),available=ready&&(settings.source==='Research catalog'||crm!==null);
    const metrics=settings.segments.map(s=>M.metrics(candidates,team.reviews,s,settings.reviewer,settings.weights));
    const fields=[['Matching companies','count'],['Rated on all five criteria','assessed'],['Customer-confirmed problem','confirmedPain'],['Confirmed buyer access rated 4–5','buyerAccess'],['Compatible + pilot readiness 4–5 confirmed','pilotReady'],['Nominated by either reviewer','nominated'],['Technical blockers ('+settings.reviewer+')','blocked']];
    $('#decision-matrix').innerHTML=`<table class="decision-table"><thead><tr><th scope="col">Decision measure · ${escape(settings.reviewer)}</th>${settings.segments.map(s=>`<th scope="col">${escape(s)}</th>`).join('')}</tr></thead><tbody>${fields.map(([label,key])=>`<tr><th scope="row">${label}</th>${metrics.map(m=>`<td>${available?(key==='count'?m.count:fraction(m[key],m.count)):'Unavailable'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const sorted=[...candidates].sort((a,b)=>{const x=M.score(mine(a.key),settings.weights),y=M.score(mine(b.key),settings.weights);return Number(x.blocked)-Number(y.blocked)||(y.value??-1)-(x.value??-1)||a.name.localeCompare(b.name);});
    $('#decision-ranking').innerHTML=`<table><thead><tr><th>Prospect</th><th>Score / 5</th><th>Evidence coverage</th><th>Decision status</th><th>Review</th></tr></thead><tbody>${sorted.map(p=>{const r=mine(p.key),s=M.score(r,settings.weights),blocked=team.reviews.some(x=>x.prospect.key===p.key&&x.compatibility==='Incompatible');return `<tr><td>${escape(p.name)}<p class="muted">${escape(p.source)}</p></td><td>${ready?(s.value===null?'Unassessed':s.value.toFixed(2)):'Unavailable'}</td><td>${ready?s.coverage+'/5 rated; '+s.confirmed+' conversation-backed':'Unavailable'}</td><td>${ready?(blocked?'Team technical blocker':escape(s.status)):'Unavailable'}</td><td><button type="button" data-review-key="${escape(p.key)}" ${ready?'':'disabled'}>Review</button></td></tr>`;}).join('')||`<tr><td colspan="5">${available?'No matching companies. Try all locations, all labels, or different segments.':'Selected workspace data is unavailable. Refresh team reviews to retry.'}</td></tr>`}</tbody></table>`;
    const prior=$('#decision-prospect').value;$('#decision-prospect').innerHTML=sorted.map(p=>`<option value="${escape(p.key)}">${escape(p.name)}</option>`).join('');if(sorted.some(p=>p.key===prior))$('#decision-prospect').value=prior;
    $('#decision-open').disabled=!available||!sorted.length;
    $('#decision-export').disabled=!ready;
    const nominated=team.reviews.filter(r=>r.nominated);
    $('#decision-shortlist').innerHTML=!ready?'<p>Team reviews are unavailable. Refresh to retry; no blank data has replaced your saved reviews.</p>':nominated.length?`<table class="decision-table"><thead><tr><th>Prospect / reviewer</th><th>Score / evidence</th><th>Why prioritize</th><th>Next step</th><th>Updated</th></tr></thead><tbody>${nominated.map(r=>{const s=M.score(r,settings.weights),blocked=team.reviews.some(x=>x.prospect.key===r.prospect.key&&x.compatibility==='Incompatible');return `<tr><td>${escape(r.prospect.name)}<p>${escape(r.reviewer)}</p><p class="muted">${escape(r.prospect.source)}${all().some(p=>p.key===r.prospect.key)?'':' · no longer in active data'}</p></td><td>${blocked?'Paused: team technical blocker':s.value===null?'Needs research':s.value.toFixed(2)+' / 5'}<p class="muted">${s.coverage}/5 rated · ${s.confirmed} conversation-backed</p><p class="muted">${escape(s.status)}</p></td><td>${escape(r.reason)}</td><td>${escape(r.nextStep)}</td><td>${escape(r.updatedAt.slice(0,10))}</td></tr>`;}).join('')}</tbody></table>`:'<p>No nominations yet. Open a prospect review, explain why it merits attention, and record a next step.</p>';
  }
  function renderSegmentation(){
    const base=matching(),qualification=$('#seg-qualification');
    const values=[...new Set(base.map(p=>p.qualification))].sort();
    qualification.innerHTML='<option value="all">All qualifications</option>'+[...new Set([...values,...(segmentation.qualification==='all'?[]:[segmentation.qualification])])].map(v=>`<option>${escape(v)}</option>`).join('');qualification.value=segmentation.qualification;
    const available=ready&&(settings.source==='Research catalog'||crm!==null);
    $('#seg-readiness').disabled=!available;$('#seg-minimum').disabled=!available;
    const result=M.segmentation(base,available?team.reviews:[],{...segmentation,...(!available?{readiness:'all',minimum:0}:{}),reviewer:settings.reviewer,weights:settings.weights});
    const max=Math.max(1,...result.groups.map(g=>g.count));
    $('#seg-summary').textContent=!available?'Assessment data unavailable. Group counts remain visible; assessment filters are paused. Refresh team reviews to compare readiness.':`${result.rows.length} unique matching prospects · ${result.rows.filter(r=>r.status==='Ready to compare').length} ready to compare · ${result.rows.filter(r=>r.status==='Blocked').length} blocked`;
    $('#seg-charts').innerHTML=result.groups.map(g=>{
      const label=available?`${g.key}: ${g.count} companies; ${g.ready} ready to compare, ${g.research} need research, ${g.unassessed} unassessed, ${g.blocked} blocked`:`${g.key}: ${g.count} companies; assessments unavailable`;
      return `<button type="button" class="seg-bar" data-seg-group="${escape(g.key)}" aria-label="${escape(label)}" aria-pressed="${segmentation.group===g.key}"><span>${escape(g.key)}</span><span class="seg-track" aria-hidden="true">${available?['ready','research','unassessed','blocked'].map(k=>`<span class="seg-${k}" style="width:${g[k]/max*100}%"></span>`).join(''):`<span class="seg-unassessed" style="width:${g.count/max*100}%"></span>`}</span><span class="seg-count">${g.count}</span></button>`;
    }).join('')||'<p>No groups match. Try another location, market, segment, or assessment filter.</p>';
    $('#seg-selection').textContent=segmentation.group==='all'?'Prospects across all matching groups':`Selected group: ${segmentation.group}`;
    $('#seg-clear-group').disabled=segmentation.group==='all';$('#seg-export').disabled=!available||!result.rows.length;
    $('#seg-results').innerHTML=`<table><caption>Outreach comparison · ${escape(settings.reviewer)}'s ratings · outreach-paused prospects last; otherwise readiness, then score</caption><thead><tr><th scope="col">Prospect / location</th><th scope="col">Market / qualification</th><th scope="col">Assessment</th><th scope="col">Score / 5</th><th scope="col">Evidence</th><th scope="col">Action</th></tr></thead><tbody>${result.rows.map(r=>`<tr><td>${escape(r.prospect.name)}<p class="muted">${escape([r.prospect.city,r.prospect.state].filter(Boolean).join(', ')||'Unknown location')}</p></td><td>${escape(r.prospect.marketUse)}<p class="muted">${escape(r.prospect.qualification)}</p></td><td>${available?escape(r.status):'Unavailable'}<p class="muted">${escape(r.prospect.outreachStatus||'No outreach recorded')}${r.outreachPaused?' · Outreach paused':''}</p></td><td>${available&&r.value!==null?r.value.toFixed(2):'—'}</td><td>${available?r.assessment.coverage+'/5 criteria':'Unavailable'}</td><td><button type="button" data-seg-review="${escape(r.prospect.key)}" ${available?'':'disabled'}>Review</button></td></tr>`).join('')||'<tr><td colspan="6">No matching prospects. Broaden the filters above.</td></tr>'}</tbody></table>`;
  }
  for(const [id,key] of [['seg-group-by','groupBy'],['seg-qualification','qualification'],['seg-readiness','readiness'],['seg-minimum','minimum']])$('#'+id).addEventListener('change',e=>{segmentation[key]=key==='minimum'?Number(e.target.value):e.target.value;segmentation.group='all';render();});
  $('#seg-clear-group').addEventListener('click',()=>{segmentation.group='all';render();});
  $('#seg-reset').addEventListener('click',()=>{segmentation={groupBy:'segment',group:'all',qualification:'all',readiness:'all',minimum:0};for(const [id,value] of [['seg-group-by','segment'],['seg-qualification','all'],['seg-readiness','all'],['seg-minimum','0']])$('#'+id).value=value;render();});
  root.addEventListener('click',e=>{const bar=e.target.closest('[data-seg-group]'),review=e.target.closest('[data-seg-review]');if(bar){const key=bar.dataset.segGroup;segmentation.group=segmentation.group===key?'all':key;render();[...root.querySelectorAll('[data-seg-group]')].find(b=>b.dataset.segGroup===key)?.focus();}if(review){root.querySelector('[data-view="prospects"]').click();openForm(review.dataset.segReview);}});
  $('#seg-export').addEventListener('click',()=>{
    if(!ready)return;
    const result=M.segmentation(matching(),team.reviews,{...segmentation,reviewer:settings.reviewer,weights:settings.weights});
    const rows=[['company','segments','city','state','marketUse','source','qualification','reviewer','assessment','score','evidenceCoverage','weights'],...result.rows.map(r=>[r.prospect.name,r.prospect.segments.join('; '),r.prospect.city,r.prospect.state,r.prospect.marketUse,r.prospect.source,r.prospect.qualification,settings.reviewer,r.status,r.value??'',r.assessment.coverage+'/5',M.criteria.map((c,i)=>c.key+'='+settings.weights[i]).join('; ')])];
    const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(M.csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='flightpath-customer-segments.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function openForm(key){
    if(!ready)return;
    if(dirty&&!window.confirm('Discard the unsaved review and open another one?'))return;
    const prospect=all().find(p=>p.key===key);if(!prospect)return;
    selected=key;formReviewer=settings.reviewer;dirty=false;$('#decision-prospect').value=key;
    const r=mine(key)||{criteria:{},compatibility:'Unknown',compatibilityNote:'',nominated:false,reason:'',nextStep:''};
    $('#decision-form-note').textContent=`Editing ${formReviewer}'s review. Changes to comparison settings do not change this form's reviewer.`;
    $('#decision-form').innerHTML=`<form id="prospect-review-form" class="review-fields"><h2>${escape(prospect.name)} · ${formReviewer}</h2><p class="muted">${escape(prospect.source)} · Last saved: ${r.updatedAt?escape(r.updatedAt):'Never'}</p>${prospect.sourceUrl?`<p><a href="${escape(prospect.sourceUrl)}" target="_blank" rel="noopener noreferrer">Catalog business evidence ↗</a> · Evidence must support each rating.</p>`:''}
    <label>Technical compatibility<select name="compatibility">${['Unknown','Compatible','Incompatible'].map(v=>`<option ${r.compatibility===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Compatibility evidence or blocker<textarea name="compatibilityNote" maxlength="1200" rows="2">${escape(r.compatibilityNote)}</textarea></label>
    ${M.criteria.map(c=>{const v=r.criteria[c.key]||{rating:null,evidence:'',kind:'Unverified',url:''};return `<div class="evidence-row"><label>${c.label}<select name="${c.key}-rating"><option value="">Unknown / not rated</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===v.rating?'selected':''}>${n}</option>`).join('')}</select></label><div class="evidence-detail"><label>${c.label}: evidence<textarea name="${c.key}-evidence" maxlength="1200" rows="2">${escape(v.evidence)}</textarea></label><label>${c.label}: evidence type<select name="${c.key}-kind">${['Unverified','Public source','Customer conversation','Classroom scenario'].map(k=>`<option ${v.kind===k?'selected':''}>${k}</option>`).join('')}</select></label><label>${c.label}: source link<input name="${c.key}-url" type="url" maxlength="1000" value="${escape(v.url)}" placeholder="https://…"></label></div></div>`;}).join('')}
    <label>Nominate for team shortlist<select name="nominated"><option value="false">No</option><option value="true" ${r.nominated?'selected':''}>Yes</option></select></label><label>Why prioritize this prospect?<textarea name="reason" maxlength="1200" rows="2">${escape(r.reason)}</textarea></label><label>Next action and owner<textarea name="nextStep" maxlength="1200" rows="2" placeholder="For example: Brandon to confirm an engineering contact before the next team review.">${escape(r.nextStep)}</textarea></label><p class="muted">Public-source ratings need a URL; conversation evidence should identify the role/date and what was learned. Classroom scenarios cannot be recorded as real customer conversations. Incompatible prospects cannot be nominated.</p><p id="review-error" class="decision-error" role="alert"></p><button type="submit">Save ${formReviewer}'s review</button></form>`;
    $('#prospect-review-form').addEventListener('input',()=>{dirty=true;});
    $('#prospect-review-form').addEventListener('change',()=>{dirty=true;});
    $('#prospect-review-form').addEventListener('submit',saveReview);
    $('#prospect-review-form select').focus();
  }
  async function saveReview(e){
    e.preventDefault();const form=e.target,fields=new FormData(form),criteria={};
    for(const c of M.criteria){const n=fields.get(c.key+'-rating');criteria[c.key]={rating:n===''?null:Number(n),evidence:fields.get(c.key+'-evidence'),kind:fields.get(c.key+'-kind'),url:fields.get(c.key+'-url')};}
    const payload={revision:team.revision,key:selected,reviewer:formReviewer,criteria,compatibility:fields.get('compatibility'),compatibilityNote:fields.get('compatibilityNote'),nominated:fields.get('nominated')==='true',reason:fields.get('reason'),nextStep:fields.get('nextStep')};
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try{const response=await fetch('/api/segment-reviews',{method:'PUT',headers:{'Content-Type':'application/json','X-Customer-Write':'1'},body:JSON.stringify(payload)}),body=await response.json();if(!response.ok)throw Error(body.error||'Review was not saved.');team=body;dirty=false;$('#review-error').textContent='';$('#decision-connection').textContent=`Saved ${formReviewer}'s review. Workspace revision ${team.revision}.`;render();}
    catch(error){$('#review-error').textContent=error.message+' Your form is preserved.';}
    finally{button.disabled=false;}
  }
  async function refresh(){
    $('#decision-error').textContent='';
    try{const responses=await Promise.all([fetch('/api/segment-reviews',{cache:'no-store'}),fetch('/api/customers',{cache:'no-store'})]);if(!responses[0].ok)throw Error('Workspace reviews could not be loaded. Start the updated Node server.');const loaded=await responses[0].json();if(!Array.isArray(loaded.reviews)||!Number.isSafeInteger(loaded.revision))throw Error('Invalid workspace review response.');team=loaded;ready=true;crm=responses[1].ok?await responses[1].json():null;$('#decision-connection').textContent=`Workspace reviews connected · ${team.reviews.length} reviews · revision ${team.revision}${crm?'':' · CRM records unavailable'}.`;}
    catch(error){ready=false;$('#decision-connection').textContent='Workspace reviews unavailable; saving is disabled.';$('#decision-error').textContent=error.message;}
    render();const submit=$('#prospect-review-form [type=submit]');if(submit)submit.disabled=!ready;
  }
  $('#decision-refresh').addEventListener('click',refresh);
  $('#decision-reviewer').addEventListener('change',e=>{settings.reviewer=e.target.value;segmentation.group='all';persist();render();});
  $('#decision-source').addEventListener('change',e=>{settings.source=e.target.value;segmentation.group='all';persist();render();});
  root.addEventListener('change',e=>{if(e.target.matches('[data-segment]')){const values=[...root.querySelectorAll('[data-segment]:checked')].map(x=>segments[Number(x.dataset.segment)]);if(!values.length){e.target.checked=true;return;}settings.segments=values;segmentation.group='all';persist();render();}if(e.target.matches('[data-weight]')){const n=Number(e.target.value),next=[...settings.weights];next[Number(e.target.dataset.weight)]=n;if(!Number.isInteger(n)||n<0||n>100||!next.some(w=>w>0)){e.target.value=settings.weights[Number(e.target.dataset.weight)];$('#decision-error').textContent='Weights must be whole numbers from 0–100, with at least one above zero.';return;}settings.weights=next;$('#decision-error').textContent='';persist();render();}});
  root.addEventListener('flightpath:filters',()=>{segmentation.group='all';render();});
  root.addEventListener('click',e=>{const button=e.target.closest('[data-review-key]');if(button)openForm(button.dataset.reviewKey);});
  $('#decision-open').addEventListener('click',()=>openForm($('#decision-prospect').value));
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  $('#decision-export').addEventListener('click',()=>{const columns=['company','source','reviewer','teamTechnicalBlocker','compatibility','score','scoringWeights','evidenceCoverage','reason','nextStep','updatedAt',...M.criteria.flatMap(c=>[c.key+'Rating',c.key+'Evidence',c.key+'Type',c.key+'URL'])];const rows=team.reviews.filter(r=>r.nominated).map(r=>{const s=M.score(r,settings.weights),blocked=team.reviews.some(x=>x.prospect.key===r.prospect.key&&x.compatibility==='Incompatible');return [r.prospect.name,r.prospect.source,r.reviewer,blocked?'Yes':'No',r.compatibility,blocked?'Blocked':s.value??'',M.criteria.map((c,i)=>c.key+'='+settings.weights[i]).join('; '),s.coverage+'/5',r.reason,r.nextStep,r.updatedAt,...M.criteria.flatMap(c=>{const v=r.criteria[c.key];return [v.rating??'',v.evidence,v.kind,v.url];})];});const blob=new Blob([[columns,...rows].map(row=>row.map(M.csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='flightpath-team-shortlist.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  render();refresh();
})();


