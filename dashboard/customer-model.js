const CustomerModel=(()=>{
  const open=p=>!['Awarded','Delivery','Lost','Cancelled'].includes(p.stage);
  function select(data,{sector='all',query='',type='all',relationship='all',industry='all',segment='all',owner='all',source='all'}={}){
    const q=query.trim().toLowerCase();
    const organizations=data.organizations.filter(o=>{
      const contacts=data.leads.filter(l=>l.organizationId===o.id);
      const text=[o.name,o.industry,...(o.segments||[o.segment]),o.accountOwner,o.leadSource,o.customerType,o.relationship,o.needs,...o.interests,...contacts.flatMap(l=>[l.name,l.email,l.phone,l.role,l.buyerRole]),...data.notes.filter(n=>n.organizationId===o.id).map(n=>n.text)];
      return (sector==='all'||o.sector===sector)&&(type==='all'||o.customerType===type)&&(relationship==='all'||o.relationship===relationship)&&(industry==='all'||o.industry===industry)&&(segment==='all'||(o.segments||[o.segment]).includes(segment))&&(owner==='all'||(o.accountOwner||'')===owner)&&(source==='all'||(o.leadSource||'')===source)&&text.some(t=>String(t??'').toLowerCase().includes(q));
    });
    const ids=new Set(organizations.map(o=>o.id));
    return Object.fromEntries(['leads','opportunities','engagements','followups','notes'].map(key=>[key,data[key].filter(r=>ids.has(r.organizationId))]).concat([['organizations',organizations]]));
  }
  function summary(data){
    const active=data.opportunities.filter(open);
    const groups=field=>Object.entries(data.organizations.reduce((acc,o)=>(acc[o[field]]=(acc[o[field]]||0)+1,acc),Object.create(null))).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const stages=['Research','Qualification','Budget planning','RFI / market research','Solicitation / RFP','Proposal submitted','Evaluation','Negotiation','Renewal'];
    active.forEach(p=>{if(!stages.includes(p.stage))stages.push(p.stage);});
    return {customers:data.organizations.filter(o=>o.relationship==='Customer').length,prospects:data.organizations.filter(o=>o.relationship==='Prospect').length,qualified:data.leads.filter(l=>l.stage==='Sales qualified').length,active:active.length,pipeline:active.reduce((n,p)=>n+p.value,0),weighted:active.reduce((n,p)=>n+p.value*p.probability,0),industries:groups('industry'),types:groups('customerType'),stages:stages.map(stage=>({stage,count:active.filter(p=>p.stage===stage).length,value:active.filter(p=>p.stage===stage).reduce((n,p)=>n+p.value,0)})).filter(s=>s.count)};
  }
  function alerts(data,today=new Date().toISOString().slice(0,10)){
    const start=new Date(today+'T12:00:00Z'),end=new Date(start);end.setUTCDate(end.getUTCDate()+(7-end.getUTCDay())%7);
    const weekEnd=end.toISOString().slice(0,10),openTasks=data.followups.filter(f=>!f.completed);
    return {overdue:openTasks.filter(f=>f.dueDate<today).length,dueThisWeek:openTasks.filter(f=>f.dueDate>=today&&f.dueDate<=weekEnd).length,withoutFollowup:data.organizations.filter(o=>o.relationship==='Prospect'&&!openTasks.some(f=>f.organizationId===o.id)).length,weekEnd};
  }
  function profile(data,id){
    const company=data.organizations.find(o=>o.id===id);
    if(!company)return null;
    const linked=key=>data[key].filter(r=>r.organizationId===id);
    return {...company,contacts:linked('leads'),opportunities:linked('opportunities'),notes:linked('notes').sort((a,b)=>b.date.localeCompare(a.date)),communications:linked('engagements').sort((a,b)=>b.date.localeCompare(a.date)),lastContact:linked('engagements').map(e=>e.date).sort().at(-1)||null,nextFollowup:linked('followups').filter(f=>!f.completed).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0]||null};
  }
  return {select,summary,profile,open,alerts};
})();
if(typeof module!=='undefined')module.exports=CustomerModel;
