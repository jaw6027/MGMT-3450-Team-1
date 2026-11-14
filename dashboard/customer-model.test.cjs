const test=require('node:test');
const assert=require('node:assert/strict');
const {demoData}=require('../database/demo.cjs');
const model=require('./customer-model.js');
const data=demoData('2026-11-14');
test('customer KPIs distinguish companies, contacts and open deal revenue',()=>{
  const result=model.summary(model.select(data));
  assert.equal(result.customers,1);assert.equal(result.prospects,8);
  assert.equal(result.qualified,4);assert.equal(result.active,6);
  assert.equal(result.pipeline,4400000);assert.equal(result.weighted,2244500);
  assert.equal(result.industries.reduce((n,[,count])=>n+count,0),9);
  assert.deepEqual(Object.fromEntries(result.types),{Civilian:6,Military:3});
  assert.equal(result.stages.reduce((n,s)=>n+s.count,0),6);
  assert.equal(result.stages.reduce((n,s)=>n+s.value,0),4400000);
});
test('customer search covers secondary contacts, email, needs, industry and notes',()=>{
  for(const query of ['sam.rivera@example.com','sAm RiVeRa','airframe fatigue','limited evaluation'])assert.deepEqual(model.select(data,{query}).organizations.map(o=>o.id),[1]);
  assert.deepEqual(model.select(data,{query:' agriculture '}).organizations.map(o=>o.id),[7]);
});
test('all filters constrain linked records and private defense contractors stay civilian',()=>{
  const result=model.select(data,{type:'Civilian',sector:'Air Force',relationship:'Prospect',industry:'Aerospace & defense'});
  assert.deepEqual(result.organizations.map(o=>o.id),[4]);
  for(const key of ['leads','opportunities','engagements','followups','notes'])assert.ok(result[key].every(r=>r.organizationId===4));
  assert.equal(model.summary(result).pipeline,650000);
});
test('profile derives last contact and next incomplete task without mixing accounts',()=>{
  const profile=model.profile(data,3);
  assert.equal(profile.contacts.length,2);assert.equal(profile.lastContact,'2026-11-12');
  assert.equal(profile.nextFollowup,null);assert.equal(profile.opportunities.length,2);
  const prospect=model.profile(data,1);assert.equal(prospect.nextFollowup.dueDate,'2026-11-14');
  assert.equal(model.profile(data,999),null);
});
test('no matches produce empty charts and zero totals',()=>{
  const result=model.summary(model.select(data,{query:'no such customer'}));
  for(const key of ['customers','prospects','qualified','active','pipeline','weighted'])assert.equal(result[key],0);
  for(const key of ['industries','types','stages'])assert.deepEqual(result[key],[]);
});
test('delivery, awarded, lost and cancelled opportunities are closed for forecasting',()=>{
  for(const stage of ['Delivery','Awarded','Lost','Cancelled'])assert.equal(model.open({stage}),false);
  const copy=structuredClone(data);copy.opportunities.push({id:99,organizationId:1,stage:'Delivery',value:9999999,probability:1});
  assert.equal(model.summary(copy).pipeline,4400000);
});

test('editable industry names cannot collide with JavaScript object properties',()=>{
  const custom=structuredClone(data);custom.organizations[0].industry='constructor';custom.organizations[1].industry='__proto__';
  const result=model.summary(custom);assert.equal(result.industries.find(([name])=>name==='constructor')[1],1);assert.equal(result.industries.find(([name])=>name==='__proto__')[1],1);
});

test('owner, source, and any selected segment filter companies once and scope their related records',()=>{
  const custom=structuredClone(data);custom.organizations[0].segments=['U.S. Air Force','Defense contractors'];custom.organizations[0].accountOwner='Vanessa';custom.organizations[0].leadSource='Referral';custom.leads[0].buyerRole='Budget owner';
  const result=model.select(custom,{owner:'Vanessa',source:'Referral',segment:'Defense contractors'});
  assert.deepEqual(result.organizations.map(o=>o.id),[1]);assert.equal(model.summary(result).pipeline,840000);
  assert.deepEqual(model.select(custom,{query:'budget owner'}).organizations.map(o=>o.id),[1]);assert.deepEqual(model.select(custom,{owner:'Hannah'}).organizations,[]);
  assert.equal(model.select(custom,{owner:''}).organizations.length,8);
});
test('follow-up alerts separate overdue, today-to-Sunday, completed tasks and missing prospect follow-ups',()=>{
  const custom={organizations:[{id:1,relationship:'Prospect'},{id:2,relationship:'Prospect'},{id:3,relationship:'Prospect'},{id:4,relationship:'Customer'}],followups:[
    {organizationId:1,dueDate:'2026-11-12',completed:false},
    {organizationId:1,dueDate:'2026-11-13',completed:false},
    {organizationId:2,dueDate:'2026-11-15',completed:false},
    {organizationId:2,dueDate:'2026-11-16',completed:false},
    {organizationId:3,dueDate:'2026-11-14',completed:true}
  ]};
  assert.deepEqual(model.alerts(custom,'2026-11-13'),{overdue:1,dueThisWeek:2,withoutFollowup:1,weekEnd:'2026-11-15'});
  assert.deepEqual(model.alerts(custom,'2026-11-15'),{overdue:2,dueThisWeek:1,withoutFollowup:1,weekEnd:'2026-11-15'});
  assert.equal(model.alerts(custom,'2026-11-16').weekEnd,'2026-11-22');
  assert.deepEqual(model.alerts({organizations:[],followups:[]},'2026-11-13'),{overdue:0,dueThisWeek:0,withoutFollowup:0,weekEnd:'2026-11-15'});
});
