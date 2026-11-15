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
  return {criteria,score,candidates,metrics,csvCell};
})();
if(typeof module!=='undefined')module.exports=SegmentStrategy;
