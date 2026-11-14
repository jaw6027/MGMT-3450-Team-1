const CustomerModel=(()=>{
  const open=p=>!['Awarded','Delivery','Lost','Cancelled'].includes(p.stage);
  const known=value=>typeof value==='number'&&Number.isFinite(value);
  function total(rows,field='value'){const included=rows.filter(r=>known(r[field]));return included.length?included.reduce((n,r)=>n+r[field],0):rows.length?null:0;}
  function weighted(rows){return total(rows.map(p=>({value:known(p.value)&&known(p.probability)?p.value*p.probability:null})));}
  function select(data,{sector='all',query='',type='all',relationship='all',industry='all',segment='all',owner='all',source='all',qualification='all'}={}){
    const q=query.trim().toLowerCase();
    const organizations=data.organizations.filter(o=>{
      const contacts=data.leads.filter(l=>l.organizationId===o.id);
      const text=[o.name,o.industry,...(o.segments||[o.segment]),o.accountOwner,o.leadSource,o.qualificationStatus,o.budgetStatus,o.decisionMakerContacted,o.purchaseTimeline,o.interestLevel,o.customerType,o.relationship,o.needs,...o.interests,...contacts.flatMap(l=>[l.name,l.email,l.phone,l.role,l.buyerRole]),...data.notes.filter(n=>n.organizationId===o.id).map(n=>n.text)];
      return (sector==='all'||o.sector===sector)&&(type==='all'||o.customerType===type)&&(relationship==='all'||o.relationship===relationship)&&(industry==='all'||o.industry===industry)&&(segment==='all'||(o.segments||[o.segment]).includes(segment))&&(owner==='all'||(o.accountOwner||'')===owner)&&(source==='all'||(o.leadSource||'')===source)&&(qualification==='all'||(o.qualificationStatus||'')===qualification)&&text.some(t=>String(t??'').toLowerCase().includes(q));
    });
    const ids=new Set(organizations.map(o=>o.id));
    return Object.fromEntries(['leads','opportunities','engagements','followups','notes'].map(key=>[key,data[key].filter(r=>ids.has(r.organizationId))]).concat([['organizations',organizations]]));
  }
  function summary(data){
    const active=data.opportunities.filter(open),won=data.opportunities.filter(p=>['Awarded','Delivery'].includes(p.stage));
    const groups=field=>Object.entries(data.organizations.reduce((acc,o)=>(acc[o[field]]=(acc[o[field]]||0)+1,acc),Object.create(null))).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const stages=['Research','Qualification','Budget planning','RFI / market research','Solicitation / RFP','Proposal submitted','Evaluation','Negotiation','Renewal'];
    active.forEach(p=>{if(!stages.includes(p.stage))stages.push(p.stage);});
    return {customers:data.organizations.filter(o=>o.relationship==='Customer').length,prospects:data.organizations.filter(o=>o.relationship==='Prospect').length,qualified:data.leads.filter(l=>l.stage==='Sales qualified').length,active:active.length,pipeline:total(active),weighted:weighted(active),unknownValues:active.filter(p=>!known(p.value)).length,unknownProbabilities:active.filter(p=>!known(p.probability)).length,weightedCount:active.filter(p=>known(p.value)&&known(p.probability)).length,awarded:total(won,'awardedValue'),awardedCount:won.length,unknownAwards:won.filter(p=>!known(p.awardedValue)).length,industries:groups('industry'),types:groups('customerType'),stages:stages.map(stage=>{const rows=active.filter(p=>p.stage===stage);return {stage,count:rows.length,value:total(rows),unknown:rows.filter(p=>!known(p.value)).length};}).filter(s=>s.count)};
  }
  function qualification(data){
    const statuses=['New Lead','Interested','Qualified','High Priority','Not Qualified','Not assessed'];
    return {statuses:statuses.map(status=>({status,count:data.organizations.filter(o=>(o.qualificationStatus||'Not assessed')===status).length})),highPriority:data.organizations.filter(o=>o.relationship==='Prospect'&&o.qualificationStatus==='High Priority'),missingBudget:data.organizations.filter(o=>!o.budgetStatus),missingTimeline:data.organizations.filter(o=>!o.purchaseTimeline)};
  }
  function forecast(data,today=new Date().toISOString().slice(0,10)){
    const active=data.opportunities.filter(open),future=active.filter(p=>p.award&&p.award>=today),year=Number(today.slice(0,4)),month=Number(today.slice(5,7))-1;
    const monthKey=date=>date.slice(0,7),quarterKey=date=>date.slice(0,4)+'-Q'+(Math.floor((Number(date.slice(5,7))-1)/3)+1);
    const makeBucket=(key,rows)=>({key,count:rows.length,value:total(rows),weighted:weighted(rows),unknownValues:rows.filter(p=>!known(p.value)).length,unweighted:rows.filter(p=>!known(p.value)||!known(p.probability)).length});
    const monthly=Array.from({length:12},(_,offset)=>{const key=new Date(Date.UTC(year,month+offset,1)).toISOString().slice(0,7);return makeBucket(key,future.filter(p=>monthKey(p.award)===key));});
    const quarterly=Array.from({length:4},(_,offset)=>{const date=new Date(Date.UTC(year,Math.floor(month/3)*3+offset*3,1)).toISOString().slice(0,10),key=quarterKey(date);return makeBucket(key,future.filter(p=>quarterKey(p.award)===key));});
    return {monthly,quarterly,undated:active.filter(p=>!p.award).length,overdue:active.filter(p=>p.award&&p.award<today).length,beyondMonthly:future.filter(p=>!monthly.some(b=>b.key===monthKey(p.award))).length,beyondQuarterly:future.filter(p=>!quarterly.some(b=>b.key===quarterKey(p.award))).length,closingSoon:[...active.filter(p=>p.award)].sort((a,b)=>a.award.localeCompare(b.award)||a.id-b.id).slice(0,6)};
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
  return {select,summary,profile,open,alerts,total,weighted,qualification,forecast};
})();
if(typeof module!=='undefined')module.exports=CustomerModel;
