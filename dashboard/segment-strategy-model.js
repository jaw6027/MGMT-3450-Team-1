// Decision support: ratings are reviewer judgments, never inferred buying intent.
const SegmentStrategy = (() => {
  const criteria = [
    {key:'fit',label:'Technical fit',weight:30},
    {key:'pain',label:'Confirmed customer problem',weight:25},
    {key:'access',label:'Buyer access',weight:20},
    {key:'pilot',label:'Pilot readiness',weight:15},
    {key:'commercial',label:'Commercial potential',weight:10}
  ];
  function score(review, weights=criteria.map(c=>c.weight)) {
    const known=criteria.filter(c=>Number.isInteger(review?.criteria?.[c.key]?.rating)&&review.criteria[c.key].rating>=1&&review.criteria[c.key].rating<=5&&review.criteria[c.key].evidence?.trim());
    const confirmed=known.filter(c=>review.criteria[c.key].kind==='Customer conversation').length;
    const blocked=review?.compatibility==='Incompatible';
    const validWeights=weights.length===5&&weights.every(w=>Number.isFinite(w)&&w>=0)&&weights.some(w=>w>0);
    const value=!blocked&&known.length===5&&validWeights?criteria.reduce((sum,c,i)=>sum+review.criteria[c.key].rating*weights[i],0)/weights.reduce((a,b)=>a+b,0):null;
    return {value,coverage:known.length,confirmed,blocked,status:blocked?'Blocked':known.length<5?'Needs research':review.compatibility!=='Compatible'?'Compatibility unverified':'Assessed'};
  }
  function candidates(catalog,crm) {
    const real=catalog.map(p=>({...p,key:'catalog:'+p.key,segments:[p.segment],source:'Research catalog',qualification:'Not assessed',contact:false}));
    const linked=new Set(real.map(p=>p.key));
    const workspace=(crm?.organizations||[]).filter(o=>!o.publicProspect?.key||!linked.has('catalog:'+o.publicProspect.key)).map(o=>({key:'crm:'+o.id,name:o.name,segments:o.segments||[o.segment],segment:o.segment,source:'CRM workspace (sample database)',state:'',city:'',marketUse:'Not yet verified',focus:o.needs||'Needs not recorded',qualification:o.qualificationStatus||'Not assessed',contact:(crm.leads||[]).some(l=>l.organizationId===o.id&&l.buyerRole==='Technical evaluator'),sourceUrl:'',researchDate:''}));
    return [...real,...workspace];
  }
  function metrics(candidates,reviews,segment,reviewer,weights) {
    const members=candidates.filter(p=>p.segments.includes(segment));
    const selected=members.map(p=>reviews.find(r=>r.prospect.key===p.key&&r.reviewer===reviewer)).filter(Boolean);
    const assessed=selected.map(r=>score(r,weights));
    return {count:members.length,nominated:new Set(reviews.filter(r=>r.nominated&&members.some(p=>p.key===r.prospect.key)).map(r=>r.prospect.key)).size,assessed:assessed.filter(s=>s.coverage===5).length,confirmedPain:selected.filter(r=>r.criteria.pain?.kind==='Customer conversation'&&r.criteria.pain.rating!==null).length,buyerAccess:selected.filter(r=>r.criteria.access?.kind==='Customer conversation'&&r.criteria.access.rating>=4).length,pilotReady:selected.filter(r=>r.criteria.pilot?.kind==='Customer conversation'&&r.criteria.pilot.rating>=4&&r.compatibility==='Compatible').length,blocked:assessed.filter(s=>s.blocked).length};
  }
  function csvCell(value) { let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'; }
  function outreach(prospect,reviews,reviewer,weights) {
    const own=reviews.find(r=>r.prospect.key===prospect.key&&r.reviewer===reviewer);
    const assessment=score(own,weights);
    const blocked=reviews.some(r=>r.prospect.key===prospect.key&&r.compatibility==='Incompatible');
    const status=blocked?'Blocked':!own||assessment.coverage===0?'Unassessed':assessment.coverage<5||own.compatibility!=='Compatible'?'Needs research':'Ready to compare';
    return {prospect,assessment,status,outreachPaused:['Not a fit','Do not contact'].includes(prospect.outreachStatus),value:status==='Ready to compare'?assessment.value:null};
  }
  function segmentation(prospects,reviews,{reviewer,weights,qualification='all',readiness='all',minimum=0,groupBy='segment',group='all'}={}) {
    const records=prospects.map(p=>outreach(p,reviews,reviewer,weights)).filter(r=>(qualification==='all'||r.prospect.qualification===qualification)&&(readiness==='all'||r.status===readiness)&&(!minimum||(r.value!==null&&r.value>=minimum)));
    const keys=p=>groupBy==='segment'?[...new Set(p.segments)]:[groupBy==='state'?(p.state||'Unknown location'):(p.marketUse||'Not yet verified')];
    const groups=new Map();
    for(const r of records)for(const key of keys(r.prospect)){if(!groups.has(key))groups.set(key,{key,count:0,ready:0,research:0,unassessed:0,blocked:0});const g=groups.get(key);g.count++;g[{'Ready to compare':'ready','Needs research':'research','Unassessed':'unassessed','Blocked':'blocked'}[r.status]]++;}
    const rank={'Ready to compare':0,'Needs research':1,'Unassessed':2,'Blocked':3};
    const rows=records.filter(r=>group==='all'||keys(r.prospect).includes(group)).sort((a,b)=>Number(a.outreachPaused)-Number(b.outreachPaused)||rank[a.status]-rank[b.status]||(b.value??-1)-(a.value??-1)||a.prospect.name.localeCompare(b.prospect.name));
    return {groups:[...groups.values()].sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key)),rows};
  }
  return {criteria,score,candidates,metrics,csvCell,outreach,segmentation};
})();
if(typeof module!=='undefined')module.exports=SegmentStrategy;

