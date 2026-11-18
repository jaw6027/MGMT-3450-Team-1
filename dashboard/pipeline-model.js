// Existing procurement records retain their stored stages until explicitly edited.
const PipelineModel=(()=>{
  const stages=['New Lead','Contacted','Demo Scheduled','Pilot Evaluation','Proposal Sent','Closed Won','Closed Lost'];
  const legacy={Research:'New Lead',Qualification:'Contacted','Budget planning':'Contacted','RFI / market research':'Contacted','Solicitation / RFP':'Proposal Sent','Proposal submitted':'Proposal Sent',Evaluation:'Pilot Evaluation',Negotiation:'Proposal Sent',Renewal:'Contacted',Awarded:'Closed Won',Delivery:'Closed Won',Lost:'Closed Lost',Cancelled:'Closed Lost'};
  const stage=p=>legacy[p.stage]||p.stage;
  const open=p=>!['Closed Won','Closed Lost'].includes(stage(p));
  const overdue=(p,today=new Date().toISOString().slice(0,10))=>open(p)&&Boolean(p.followupDate)&&p.followupDate<today;
  function select(data,{sector='all',query=''}={}){
    const tokens=query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
    return data.opportunities.filter(p=>{
      const o=data.organizations.find(o=>o.id===p.organizationId);
      if(!o)return false;
      const text=[o.name,...(o.segments||[o.segment]),p.name,stage(p),p.stage,p.owner,p.nextAction,p.followupDate].join(' ').toLowerCase();
      return (sector==='all'||o.sector===sector)&&tokens.every(token=>text.includes(token));
    });
  }
  const counts=rows=>stages.map(name=>({stage:name,count:rows.filter(p=>stage(p)===name).length}));
  return {stages,stage,open,overdue,select,counts};
})();
if(typeof module!=='undefined')module.exports=PipelineModel;
