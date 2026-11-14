const CustomerDashboard=(()=>{
  let data=null,error='',loading=true,refresh=()=>{};
  const filters={type:'all',relationship:'all',industry:'all',segment:'all',owner:'all',source:'all'};
  let currentFilters={},notice='',deleting=false;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  const date=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Not recorded';
  const today=()=>new Date().toISOString().slice(0,10);
  const pill=(text,style='')=>`<span class="badge ${style}">${escape(text)}</span>`;
  const options=(values,selected)=>values.map(([value,label])=>`<option value="${escape(value)}" ${value===selected?'selected':''}>${escape(label)}</option>`).join('');
  const panel=(title,note,body)=>`<section class="panel customer-panel"><div class="panel-header"><div><h2>${title}</h2><p>${note}</p></div></div>${body}</section>`;
  const empty=text=>`<p class="customer-empty">${text}</p>`;
  async function load(){
    loading=true;error='';refresh();
    try{
      const response=await fetch('/api/customers',{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Request failed');
      const result=await response.json();
      if(result.meta?.sampleData!==true||!['organizations','leads','opportunities','engagements','followups','notes'].every(key=>Array.isArray(result[key])))throw new Error('Unexpected response');
      data=result;
    }catch(e){data=null;error='The customer database could not be loaded. Start the local Node server and retry. No customer metrics are available while disconnected.';}
    loading=false;refresh();
  }
  function selected(){return CustomerModel.select(data,{...currentFilters,...filters});}
  function followups(s){
    const tasks=s.followups.filter(f=>!f.completed).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.id-b.id);
    return tasks.length?`<ol class="followup-list">${tasks.map(f=>{
      const org=s.organizations.find(o=>o.id===f.organizationId),status=f.dueDate<today()?'Overdue':f.dueDate===today()?'Today':'Upcoming';
      return `<li><div class="followup-date"><strong>${date(f.dueDate)}</strong>${pill(status,status==='Overdue'?'amber':status==='Today'?'green':'')}</div><div><button class="link-button" data-customer="${org.id}">${escape(org.name)}</button><p>${escape(f.action)}</p><small>Assigned to ${escape(f.owner)}</small></div></li>`;
    }).join('')}</ol>`:empty('No incomplete follow-ups match these filters.');
  }
  function render(shared){
    currentFilters=shared;
    if(loading)return '<div class="panel customer-message" role="status">Loading customer database…</div>';
    if(error)return `<div class="panel customer-message" role="alert"><h2>Customer database unavailable</h2><p>${error}</p><button class="primary" data-customer-retry>Retry connection</button></div>`;
    const s=selected(),m=CustomerModel.summary(s),total=s.organizations.length;
    const industries=data.meta.choices.industries;
    const alerts=CustomerModel.alerts(s);
    const stats=[['Existing customers',m.customers,'Organizations with a customer relationship'],['Potential customers',m.prospects,'Prospect organizations'],['Qualified leads',m.qualified,'Contacts marked sales qualified'],['Active opportunities',m.active,'Open sales opportunities'],['Potential sales revenue',money(m.pipeline),'Open pipeline · USD'],['Weighted pipeline',money(m.weighted),'Value × illustrative win probability']];
    const military=m.types.find(([type])=>type==='Military')?.[1]||0;
    const filterHtml=`<div class="customer-filters"><label>Customer type<select data-customer-filter="type">${options([['all','Military & civilian'],['Military','Military'],['Civilian','Civilian']],filters.type)}</select></label><label>Relationship<select data-customer-filter="relationship">${options([['all','Customers & prospects'],['Customer','Existing customers'],['Prospect','Potential customers']],filters.relationship)}</select></label><label>Industry<select data-customer-filter="industry">${options([['all','All industries'],...industries.map(i=>[i,i])],filters.industry)}</select></label><label>Customer segment<select data-customer-filter="segment">${options([['all','All segments'],...data.meta.choices.segments.map(s=>[s,s])],filters.segment)}</select></label><label>Account owner<select data-customer-filter="owner">${options([['all','All owners'],['','Unassigned'],...data.meta.choices.accountOwners.map(s=>[s,s])],filters.owner)}</select></label><label>Lead source<select data-customer-filter="source">${options([['all','All sources'],['','Not recorded'],...data.meta.choices.leadSources.map(s=>[s,s])],filters.source)}</select></label><button class="quiet" data-customer-clear>Clear all filters</button></div>`;
    const industryChart=total?`<div class="customer-bars">${m.industries.map(([industry,count])=>`<div class="customer-bar-row"><div><span>${escape(industry)}</span><strong>${count}</strong></div><div class="customer-bar-track"><div style="width:${count/total*100}%"></div></div></div>`).join('')}</div>`:empty('No organizations match these filters.');
    const typeChart=total?`<div class="customer-type-chart"><svg viewBox="0 0 120 120" role="img" aria-label="${military} military and ${total-military} civilian organizations"><circle cx="60" cy="60" r="44" fill="none" stroke="#b5cd98" stroke-width="15"/><circle cx="60" cy="60" r="44" fill="none" stroke="#214c59" stroke-width="15" pathLength="100" stroke-dasharray="${military/total*100} 100" transform="rotate(-90 60 60)"/><text x="60" y="58" text-anchor="middle">${total}</text><text class="donut-label" x="60" y="75" text-anchor="middle">organizations</text></svg><ul><li><i></i>Military <strong>${military}</strong></li><li><i class="civilian"></i>Civilian <strong>${total-military}</strong></li></ul></div>`:empty('No organizations match these filters.');
    const max=Math.max(...m.stages.map(x=>x.count),1);
    const pipeline=m.stages.length?`<div class="customer-bars">${m.stages.map(x=>`<div class="customer-bar-row"><div><span>${escape(x.stage)}</span><strong>${x.count} ${x.count===1?'opportunity':'opportunities'} · ${money(x.value)}</strong></div><div class="customer-bar-track"><div style="width:${x.count/max*100}%"></div></div></div>`).join('')}</div>`:empty('No active sales opportunities match these filters.');
    const rows=s.organizations.map(o=>{
      const p=CustomerModel.profile(data,o.id),lead=p.contacts[0],active=p.opportunities.filter(CustomerModel.open);
      const stage=active.length===1?active[0].stage:active.length>1?`${active.length} active deals`:'No active deal';
      return `<tr><td><button class="link-button" data-customer="${o.id}">${escape(o.name)}</button><small>${escape((o.segments||[o.segment]).join(' · '))}</small><small>Owner: ${escape(o.accountOwner||'Unassigned')} · Source: ${escape(o.leadSource||'Not recorded')}</small></td><td>${lead?`<strong>${escape(lead.name)}</strong><small>${escape(lead.email)}</small>`:'No contact recorded'}${p.contacts.length>1?`<small>+${p.contacts.length-1} more contact(s)</small>`:''}</td><td>${pill(o.relationship,o.relationship==='Customer'?'green':'')}<small>${escape(o.customerType)} · ${escape(o.industry)}</small></td><td>${escape(stage)}</td><td>${money(active.reduce((n,p)=>n+p.value,0))}</td><td>${p.nextFollowup?date(p.nextFollowup.dueDate):'Not scheduled'}</td></tr>`;
    }).join('');
    const directory=`<div class="table-wrap"><table class="customer-table"><caption class="sr-only">Searchable customer and prospect directory. Select a company to review its full profile.</caption><thead><tr>${['Company / segment','Primary contact','Relationship / classification','Sales pipeline','Open pipeline · USD','Next follow-up'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows||'<tr><td colspan="6" class="customer-empty">No customers match. Clear filters or try another search.</td></tr>'}</tbody></table></div>`;
    return `<div class="customer-demo-banner"><div><strong>Customer intelligence <span> / SAMPLE DATA</span></strong><p>Fictional companies, contacts and sales estimates. Database seeded ${date(data.meta.seededOn)}; follow-up status uses today’s UTC date.</p></div><span class="customer-connection">● Local database connected</span></div>${notice?`<p class="customer-success" role="status">${escape(notice)}</p>`:''}<div class="customer-toolbar"><button class="primary" data-customer-add>+ Add customer or company</button><button class="secondary-action" data-customer-refresh>Refresh records</button></div>${filterHtml}<p class="customer-scope" role="status">Showing ${total} of ${data.organizations.length} organizations. All cards, charts, follow-ups and exports use these filters.</p><section class="customer-alerts" aria-label="Follow-up alerts"><article class="customer-alert-card alert-overdue"><span>Overdue follow-ups</span><strong>${alerts.overdue}</strong><small>Incomplete tasks before today</small></article><article class="customer-alert-card alert-week"><span>Follow-ups due this week</span><strong>${alerts.dueThisWeek}</strong><small>Today through ${date(alerts.weekEnd)} · UTC</small></article><article class="customer-alert-card alert-missing"><span>Prospects without scheduled follow-ups</span><strong>${alerts.withoutFollowup}</strong><small>Prospect companies with no incomplete task</small></article></section><div class="stats customer-stats">${stats.map(([label,value,note])=>`<article class="stat"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong><span class="stat-note">${note}</span></article>`).join('')}</div><div class="customer-chart-grid">${panel('Customers & prospects by industry','Organization counts · includes both relationship types',industryChart)}${panel('Military vs civilian','Organization counts · private defense contractors are civilian',typeChart)}</div><div class="customer-chart-grid customer-operations">${panel('Sales pipeline overview','Active opportunity counts and illustrative contract values · excludes awarded, delivery, lost and cancelled',pipeline)}${panel('Follow-ups that need attention','Incomplete tasks ordered by due date · overdue tasks shown first',followups(s))}</div>${panel('Customer directory',`${total} organizations · select a company to review contacts, needs and history`,directory)}<p class="customer-footnote">Potential sales revenue is an estimate of open opportunities, not booked or earned revenue. Existing customers and prospects can both have active opportunities. Add a company or select a customer profile to edit records. Changes persist in the local database.</p>`;
  }
  function showProfile(id){
    const p=CustomerModel.profile(data,id);if(!p)return;
    const field=(label,value)=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`;
    const contacts=p.contacts.map(l=>`<article class="customer-detail-card"><h4>${escape(l.name)}</h4><p>${escape(l.role)} · ${escape(l.stage)}</p><p>Buyer role: ${escape(l.buyerRole||'Not recorded')}</p><p>${escape(l.email)}<br>${escape(l.phone)}</p></article>`).join('')||empty('No contacts recorded.');
    const opps=p.opportunities.map(o=>`<li><strong>${escape(o.name)}</strong><p>${escape(o.stage)} · ${money(o.value)} · ${Math.round(o.probability*100)}% illustrative probability</p><small>Expected decision: ${date(o.award)} · Owner: ${escape(o.owner)}</small></li>`).join('');
    const history=p.communications.map(e=>`<li><strong>${escape(e.type)} · ${date(e.date)}</strong><p>${escape(e.summary)}</p></li>`).join('');
    const notes=p.notes.map(n=>`<li><strong>${escape(n.author)} · ${date(n.date)}</strong><p>${escape(n.text)}</p></li>`).join('');
    document.getElementById('detail-content').innerHTML=`<h2 id="customer-profile-title">${escape(p.name)}</h2><p class="subtitle">${escape(p.relationship)} · Sample customer workspace</p><div class="customer-profile-actions"><button class="primary" data-customer-edit="${p.id}">Edit customer</button><button class="customer-danger" data-customer-delete="${p.id}">Delete customer</button></div><p id="customer-action-error" role="alert" tabindex="-1"></p><dl>${field('Customer type',p.customerType)+field('Industry',p.industry)+field('Customer segments',(p.segments||[p.segment]).join(', '))+field('Account owner',p.accountOwner||'Unassigned')+field('Lead source',p.leadSource||'Not recorded')+field('Product interests',p.interests.join(', '))+field('Last recorded contact',p.lastContact?date(p.lastContact):'Not recorded')+field('Next follow-up',p.nextFollowup?date(p.nextFollowup.dueDate):'Not scheduled')}</dl><h3>Customer needs</h3><p>${escape(p.needs||'Not recorded')}</p>${p.nextFollowup?`<h3>Next action</h3><p>${escape(p.nextFollowup.action)} · ${escape(p.nextFollowup.owner)}</p>`:''}<h3>Contacts</h3><div class="customer-contact-grid">${contacts}</div><h3>Sales opportunities</h3><ul class="customer-history">${opps||'<li>No opportunities recorded.</li>'}</ul><h3>Communication history</h3><ul class="customer-history">${history||'<li>No communications recorded.</li>'}</ul><h3>Relationship notes</h3><ul class="customer-history">${notes||'<li>No notes recorded.</li>'}</ul><p class="dialog-note">Sample data only. No actual procurement, customer relationship, or verified product performance is represented.</p>`;
    const dialog=document.getElementById('detail');dialog.classList.add('customer-dialog');dialog.setAttribute('aria-labelledby','customer-profile-title');if(!dialog.open)dialog.showModal();
  }
  function acceptSaved(result,message){
    const added=result.organizations.some(o=>!data.organizations.some(previous=>previous.id===o.id));
    if(added){Object.assign(filters,{type:'all',relationship:'all',industry:'all',segment:'all',owner:'all',source:'all'});document.getElementById('search').value='';document.getElementById('sector').value='all';}
    data=result;notice=message;
    // A changed industry may no longer be available; never leave an invisible stale filter.
    if(filters.industry!=='all'&&!data.organizations.some(o=>o.industry===filters.industry))filters.industry='all';
    refresh();
  }
  function edit(id){
    const detail=document.getElementById('detail');if(detail.open)detail.close();
    CustomerEditor.open({id,data,saved:acceptSaved,cancel:()=>{if(id)showProfile(id);}});
  }
  async function removeCustomer(id){
    if(deleting)return;
    const p=CustomerModel.profile(data,id);if(!p)return;
    const taskCount=data.followups.filter(f=>f.organizationId===id).length;
    if(!window.confirm(`Delete ${p.name}?\n\nThis permanently deletes the company, ${p.contacts.length} contact(s), ${p.opportunities.length} opportunity(s), ${taskCount} follow-up(s), and its notes and communication history. Campaigns remain, but these contacts are removed from them. This cannot be undone.`))return;
    deleting=true;const detail=document.getElementById('detail'),buttons=detail.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try{
      const response=await fetch('/api/customers/'+id,{method:'DELETE',headers:{'Content-Type':'application/json','X-Customer-Write':'1'},body:JSON.stringify({revision:data.meta.revision}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Customer could not be deleted.');
      detail.close();acceptSaved(result,'Customer deleted. Linked records were removed.');
    }catch(e){const error=detail.querySelector('#customer-action-error');error.textContent=e.name==='TypeError'||e.name==='TimeoutError'?'Connection lost. Refresh records to check whether deletion completed before retrying.':e.message;error.focus();}
    finally{deleting=false;buttons.forEach(b=>b.disabled=false);}
  }
  function profileAction(event){
    const editButton=event.target.closest('[data-customer-edit]');if(editButton){edit(Number(editButton.dataset.customerEdit));return;}
    const deleteButton=event.target.closest('[data-customer-delete]');if(deleteButton)removeCustomer(Number(deleteButton.dataset.customerDelete));
  }
  function exportRows(){
    if(!data)return;
    const rows=[['Sample data','Company','Relationship','Type','Industry','Segments','Account owner','Lead source','Contact','Email','Phone','Product interests','Customer needs','Open pipeline USD','Last contact','Next follow-up'],...selected().organizations.map(o=>{const p=CustomerModel.profile(data,o.id),c=p.contacts[0];return ['Fictional',o.name,o.relationship,o.customerType,o.industry,(o.segments||[o.segment]).join('; '),o.accountOwner||'',o.leadSource||'',c?.name||'',c?.email||'',c?.phone||'',o.interests.join('; '),o.needs,p.opportunities.filter(CustomerModel.open).reduce((n,x)=>n+x.value,0),p.lastContact||'',p.nextFollowup?.dueDate||''];})];
    const url=URL.createObjectURL(new Blob([FlightpathModel.csv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='flightpath-sample-customers.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return {render,getData(){return data;},isReady(){return Boolean(data)&&!loading&&!error;},init(callback){refresh=callback;CustomerEditor.init();document.getElementById('detail').addEventListener('click',profileAction);document.getElementById('detail').addEventListener('cancel',event=>{if(deleting)event.preventDefault();});load();},exportRows,reset(){Object.assign(filters,{type:'all',relationship:'all',industry:'all',segment:'all',owner:'all',source:'all'});},click(event){
    if(event.target.closest('[data-customer-add]')){edit(null);return true;}
    if(event.target.closest('[data-customer-refresh]')){notice='';load();return true;}
    const button=event.target.closest('[data-customer]');if(button){showProfile(Number(button.dataset.customer));return true;}
    if(event.target.closest('[data-customer-retry]')){load();return true;}
    if(event.target.closest('[data-customer-clear]')){this.reset();document.getElementById('search').value='';document.getElementById('sector').value='all';refresh();return true;}
    return false;
  },change(event){const key=event.target.dataset.customerFilter;if(key){filters[key]=event.target.value;refresh();}}};
})();
