// Validate every write before it reaches SQLite. IDs are scoped to a company by the store.
const choices={
  customerTypes:['Military','Civilian'],relationships:['Customer','Prospect'],
  sectors:['Air Force','Navy','Civilian Commercial'],
  segments:['U.S. Air Force','U.S. Navy','Defense contractors','Commercial drone manufacturers','Agricultural drone companies','Infrastructure inspection companies','Civilian drone operators'],
  industries:['Aerospace & defense','Maritime defense','Drone manufacturing','Agriculture','Infrastructure inspection','Drone operations','Energy inspection'],
  accountOwners:['Vanessa','Janice','Sherry','Austin','Hannah'],
  leadSources:['Referral','Website inquiry','Networking','Direct outreach','Industry event','Other'],
  buyerRoles:['Technical evaluator','Decision-maker','Budget owner','Procurement contact'],
  interests:['Vibration','Structural bending','Temperature'],
  leadStages:['New','Marketing qualified','Sales qualified','Nurture','Disqualified','Converted'],
  opportunityStages:['Research','Qualification','Budget planning','RFI / market research','Solicitation / RFP','Proposal submitted','Evaluation','Negotiation','Awarded','Delivery','Renewal','Lost','Cancelled'],
  communicationTypes:['Call','Email','Meeting','Demo','Other']
};
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function object(value,label){if(!value||typeof value!=='object'||Array.isArray(value))fail(label+' must be an object.');return value;}
function text(value,label,{required=false,max=300}={}){
  if(value===undefined||value===null)value='';
  if(typeof value!=='string')fail(label+' must be text.');
  const result=value.trim();if(required&&!result)fail(label+' is required.');if(result.length>max)fail(label+' is too long.');return result;
}
function choice(value,values,label){if(!values.includes(value))fail('Choose a valid '+label+'.');return value;}
function number(value,label,min,max,integer=false){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))fail(label+' is invalid.');return value;}
function date(value,label,required=false){const result=text(value,label,{required,max:10});if(!result)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||!Number.isFinite(Date.parse(result+'T12:00:00Z'))||new Date(result+'T12:00:00Z').toISOString().slice(0,10)!==result)fail(label+' must be a valid date.');return result;}
function id(value){return value===undefined||value===null?null:number(value,'Record ID',1,Number.MAX_SAFE_INTEGER,true);}
function rows(value,label,validate){if(value===undefined)return [];if(!Array.isArray(value)||value.length>200)fail(label+' must be a list with at most 200 records.');const result=value.map(item=>validate(object(item,label)));const ids=result.filter(r=>r.id!==null).map(r=>r.id);if(new Set(ids).size!==ids.length)fail(label+' contains duplicate IDs.');return result;}
function revision(value){return number(value,'Database revision',0,Number.MAX_SAFE_INTEGER,true);}
function categoryName(value,label){return text(value,label,{required:true,max:150}).normalize('NFKC').replace(/\s+/gu,' ');}
function categoryKey(value){return categoryName(value,'Category name').toLowerCase();}
function validateCustomer(payload){
  object(payload,'Customer request');const company=object(payload.company,'Company');
  if(!Array.isArray(company.interests)||company.interests.length>choices.interests.length)fail('Product interests must be a list.');
  const segments=company.segments===undefined?[company.segment]:company.segments;
  if(!Array.isArray(segments)||!segments.length||segments.length>50)fail('Choose at least one customer segment (up to 50).');
  const selectedSegments=[...new Map(segments.map(s=>{const name=categoryName(s,'Customer segment');return [categoryKey(name),name];})).values()];
  const result={segments:selectedSegments,revision:revision(payload.revision),company:{
    name:text(company.name,'Company name',{required:true,max:200}),sector:choice(company.sector,choices.sectors,'market sector'),
    clearance:text(company.clearance,'Clearance requirements',{max:1000}),customerType:choice(company.customerType,choices.customerTypes,'customer type'),
    industry:categoryName(company.industry,'Industry'),segment:selectedSegments[0],
    relationship:choice(company.relationship,choices.relationships,'relationship'),interests:[...new Set(company.interests.map(i=>choice(i,choices.interests,'product interest')))],needs:text(company.needs,'Customer needs',{max:5000})
  }};
  if(company.accountOwner!==undefined)result.company.accountOwner=choice(company.accountOwner,['',...choices.accountOwners],'account owner');
  if(company.leadSource!==undefined)result.company.leadSource=choice(company.leadSource,['',...choices.leadSources],'lead source');
  result.newCategories=rows(payload.newCategories,'New categories',c=>({id:null,kind:choice(c.kind,['industry','segment'],'category type'),name:categoryName(c.name,'Category name')}));
  result.contacts=rows(payload.contacts,'Contacts',c=>{
    const email=text(c.email,'Email address',{max:254});if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email address.');
    return {...(c.buyerRole===undefined?{}:{buyerRole:choice(c.buyerRole,['',...choices.buyerRoles],'buyer role')}),id:id(c.id),name:text(c.name,'Contact name',{required:true,max:150}),email,phone:text(c.phone,'Phone number',{max:60}),role:text(c.role,'Contact role',{max:150}),stage:choice(c.stage,choices.leadStages,'lead qualification'),score:number(c.score??0,'Lead score',0,100,true)};
  });
  const emails=result.contacts.map(c=>c.email.toLowerCase()).filter(Boolean);if(new Set(emails).size!==emails.length)fail('A contact email is repeated for this company.');
  result.opportunities=rows(payload.opportunities,'Opportunities',o=>({id:id(o.id),name:text(o.name,'Opportunity name',{required:true,max:200}),stage:choice(o.stage,choices.opportunityStages,'sales stage'),value:number(o.value,'Contract value',0,1e12,true),probability:number(o.probability,'Win probability',0,1),award:date(o.award,'Expected decision date'),owner:text(o.owner,'Opportunity owner',{max:150})}));
  result.followups=rows(payload.followups,'Follow-ups',f=>{
    if(typeof f.completed!=='boolean')fail('Follow-up completion must be true or false.');
    return {id:id(f.id),dueDate:date(f.dueDate,'Follow-up date',true),action:text(f.action,'Follow-up action',{required:true,max:1000}),owner:text(f.owner,'Follow-up owner',{required:true,max:150}),completed:f.completed};
  });
  if(payload.note){const n=object(payload.note,'Note');result.note={text:text(n.text,'Customer note',{required:true,max:10000}),author:text(n.author,'Note author',{required:true,max:150})};}
  if(payload.communication){const c=object(payload.communication,'Communication');result.communication={type:choice(c.type,choices.communicationTypes,'communication type'),date:date(c.date,'Contact date',true),summary:text(c.summary,'Communication summary',{required:true,max:5000})};}
  return result;
}
module.exports={choices,fail,revision,validateCustomer,categoryName,categoryKey};
