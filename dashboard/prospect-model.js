// Public-source verification is distinct from sales qualification and buying intent.
const ProspectModel=(()=>{
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function quality(p,date=today()){
    if(p.dataIssue)return 'Needs recheck';
    if(!p.reviewedAt)return 'Not rechecked';
    if(!p.reviewDue||p.reviewDue<=date)return 'Recheck due';
    return 'Sources checked';
  }
  function matches(p,filter='all',date=today()){
    return filter==='all'||quality(p,date)===filter||(filter==='Public contact listed'&&Boolean(p.contactUrl&&p.contactCheckedAt));
  }
  const statuses=['Not contacted','Researching','Contacted','In discussion','Not a fit','Do not contact'];
  const csvCell=value=>{let s=String(value??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return {today,quality,matches,statuses,csvCell};
})();
if(typeof module!=='undefined')module.exports=ProspectModel;

