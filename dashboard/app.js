(() => {
  'use strict';
  let data = FlightpathData;
  const model = FlightpathModel;
  const $ = id => document.getElementById(id);
  let view = 'customers';
  const titles = {
    customers:['Customers','Know your customers. Grow your opportunities.','Customer relationships, sales potential, and the next conversation — in one place.'],
    overview:['Overview','A clearer view of your pipeline.','From first contact to contract award. Keep every opportunity in sight.'],
    campaigns:['Campaigns','Make every touchpoint count.','Explore campaign audiences, activity, and planned investment.'],
    leads:['Leads & accounts','Relationships that move you forward.','Know the people and organizations behind your next opportunity.'],
    pipeline:['Sales pipeline','From possibility to procurement.','Track every deal across commercial and government sales cycles.']
  };
  const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
  const compact = value => '$'+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(value);
  const date = value => value?new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Not scheduled';
  const current = () => model.select(data,$('sector').value,$('search').value);
  const badge = value => `<span class="badge ${['Awarded','Active','Sales qualified','Negotiation'].includes(value)?'green':['Evaluation','Proposal submitted','Scheduled'].includes(value)?'amber':['Lost','Completed'].includes(value)?'gray':''}">${escape(value)}</span>`;
  function panel(title,description,body,action='') {return `<section class="panel"><div class="panel-header"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>${body}</section>`;}
  function table(headers,rows) {return rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="empty">No records match these filters. Try another search or reset filters.</div>';}
  function stats(s) {
    const m=model.metrics(s);
    return `<div class="stats">${[
      ['Open pipeline',compact(m.pipeline),`${m.openCount} active opportunities`,'↗'],
      ['Weighted pipeline',compact(m.weighted),'Value × estimated win probability','◈'],
      ['Qualified leads',m.qualified,`${s.leads.length} contacts in selected accounts`,'♧'],
      ['Active campaigns',m.activeCampaigns,`${s.campaigns.length} matching campaigns`,'◎']
    ].map(([label,value,note,icon])=>`<article class="stat"><span class="stat-label">${label}</span><span class="stat-icon" aria-hidden="true">${icon}</span><strong class="stat-value">${value}</strong><span class="stat-note">${note}</span></article>`).join('')}</div>`;
  }
  function opportunityTable(s,openOnly=false) {
    const items=openOnly?s.opportunities.filter(model.open):s.opportunities;
    return table(['Opportunity / account','Sector','Stage','Contract value','Expected award'],items.map(p=>{
      const o=s.orgById.get(p.organizationId);
      return [`<button class="link-button" data-opportunity="${p.id}">${escape(p.name)}</button><small>${escape(o.name)}</small>`,escape(o.sector),badge(p.stage),money(p.value),date(p.award)];
    }));
  }
  function charts(s) {
    const open=s.opportunities.filter(model.open),total=model.metrics(s).pipeline;
    const stages=[...new Set(['Research','Qualification','Budget planning','RFI / market research','Solicitation / RFP','Proposal submitted','Evaluation','Negotiation','Renewal',...open.map(p=>p.stage)])];
    const totals=stages.map(stage=>open.filter(p=>p.stage===stage).reduce((sum,p)=>sum+p.value,0));
    const max=Math.max(...totals,1);
    const stageBody=`<div class="stage-chart" role="img" aria-label="Open pipeline value by procurement stage">${stages.map((stage,i)=>`<div class="stage-row"><span>${stage}</span><div class="bar-track"><div class="bar-fill" style="width:${totals[i]/max*100}%"></div></div><span class="stage-value">${compact(totals[i])}</span></div>`).join('')}</div>`;
    const sectorBody=`<div class="sector-list">${['Air Force','Navy','Civilian Commercial'].map(sector=>{
      const items=open.filter(p=>s.orgById.get(p.organizationId).sector===sector),value=items.reduce((sum,p)=>sum+p.value,0),share=total?value/total*100:0;
      return `<div class="sector-row"><div class="sector-top"><span>${sector}</span><strong>${compact(value)}</strong></div><div class="sector-track"><div class="sector-fill" style="width:${share}%"></div></div><div class="sector-caption">${items.length} opportunities · ${share.toFixed(0)}% of open pipeline</div></div>`;
    }).join('')}</div>`;
    return `<div class="middle-grid">${panel('Procurement at a glance','Open opportunities by stage · USD',stageBody,'<span class="mini-tag">VALUE BY STAGE</span>')}${panel('A balanced horizon','Open pipeline by customer sector',sectorBody)}</div>`;
  }
  function activities(s) {
    const body=s.engagements.length?`<div class="activity">${[...s.engagements].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<div class="activity-row"><span class="activity-icon" aria-hidden="true">↗</span><div><div class="activity-title">${escape(e.type)} · ${escape(s.orgById.get(e.organizationId).name)}</div><div class="activity-summary">${escape(e.summary)}</div></div><time class="activity-date" datetime="${e.date}">${date(e.date)}</time></div>`).join('')}</div>`:'<div class="empty">No recent activity matches these filters.</div>';
    return panel('The latest conversations','Recent engagement across your accounts',body);
  }
  function campaigns(s) {
    const rows=s.campaigns.map(c=>{
      const visibleLeads=s.leads.filter(l=>c.leadIds.includes(l.id));
      return [`<strong>${escape(c.name)}</strong><small>${escape(c.channel)}</small>`,escape(c.sectors.join(' · ')),badge(c.status),String(visibleLeads.length),money(c.budget)];
    });
    return panel('Campaign portfolio','Lead counts follow current filters; budgets show the full campaign budget.',table(['Campaign / channel','Target sectors','Status','Matching leads','Full budget'],rows));
  }
  function leads(s) {
    return panel('People behind the pipeline','All names and organizations are fictional.',table(['Contact / role','Organization','Sector','Qualification','Lead score'],s.leads.map(l=>[
      `<strong>${escape(l.name)}</strong><small>${escape(l.role)}</small>`,escape(s.orgById.get(l.organizationId).name),escape(s.orgById.get(l.organizationId).sector),badge(l.stage),`<span class="score">${l.score}</span> / 100`
    ])))+panel('Account directory','Clearance requirements are illustrative planning notes.',table(['Organization','Sector','Clearance requirements'],s.organizations.map(o=>[`<strong>${escape(o.name)}</strong>`,escape(o.sector),escape(o.clearance)])));
  }
  function render() {
    const s=current(),[label,title,description]=titles[view];
    $('breadcrumb').textContent=label;$('page-title').textContent=title;$('page-description').textContent=description;
    document.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    $('export').disabled=view==='customers'&&!CustomerDashboard.isReady();
    $('export').textContent=view==='customers'?'↓ Export customers':'↓ Export opportunities';
    $('dashboard').innerHTML=view==='customers'?CustomerDashboard.render({sector:$('sector').value,query:$('search').value}):stats(s)+(view==='overview'?charts(s)+panel('Opportunities on the radar','Open deals in your selected accounts. Select a deal to explore.',opportunityTable(s,true),'<button class="quiet" data-go="pipeline">View all opportunities ↗</button>')+activities(s):view==='campaigns'?campaigns(s):view==='leads'?leads(s):panel('Every deal, every stage','Includes open, awarded, and lost opportunities. Select a deal for details.',opportunityTable(s)));
  }
  function navigate(next) {view=next;history.replaceState(null,'','#'+next);render();}
  document.querySelector('nav').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)navigate(button.dataset.view);});
  document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();navigate('overview');});
  $('dashboard').addEventListener('change',event=>CustomerDashboard.change(event));
  $('dashboard').addEventListener('click',event=>{
    if(CustomerDashboard.click(event))return;
    const go=event.target.closest('[data-go]');if(go){navigate(go.dataset.go);return;}
    const button=event.target.closest('[data-opportunity]');if(!button)return;
    const p=data.opportunities.find(p=>p.id===Number(button.dataset.opportunity)),o=data.organizations.find(o=>o.id===p.organizationId);
    $('detail').classList.remove('customer-dialog');$('detail').removeAttribute('aria-labelledby');
    $('detail-content').innerHTML=`<h2>${escape(p.name)}</h2><p class="subtitle">${escape(o.name)} · ${escape(o.sector)}</p><dl>${[['Stage',p.stage],['Contract value',money(p.value)],['Win probability',Math.round(p.probability*100)+'%'],['Expected award',date(p.award)],['Opportunity owner',p.owner],['Clearance requirements',o.clearance]].map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><p class="dialog-note">Fictional opportunity for demonstration. Values, dates, and probabilities are illustrative.</p>`;
    $('detail').showModal();
  });
  $('close-detail').addEventListener('click',()=>$('detail').close());
  $('search').addEventListener('input',render);$('sector').addEventListener('change',render);
  $('reset').addEventListener('click',()=>{$('search').value='';$('sector').value='all';CustomerDashboard.reset();render();});
  $('export').addEventListener('click',()=>{
    if(view==='customers'){CustomerDashboard.exportRows();return;}
    const s=current(),rows=[['Opportunity','Organization','Sector','Stage','Contract value','Currency','Win probability','Expected award','Owner'],...s.opportunities.map(p=>[p.name,s.orgById.get(p.organizationId).name,s.orgById.get(p.organizationId).sector,p.stage,p.value,'USD',p.probability,p.award,p.owner])];
    const url=URL.createObjectURL(new Blob([model.csv(rows)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='flightpath-opportunities.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function fromHash(){view=Object.hasOwn(titles,location.hash.slice(1))?location.hash.slice(1):'customers';render();}
  window.addEventListener('hashchange',fromHash);fromHash();CustomerDashboard.init(()=>{data=CustomerDashboard.getData()||FlightpathData;render();});
})();
