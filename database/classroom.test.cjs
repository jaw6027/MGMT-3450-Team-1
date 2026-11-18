const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {openStore}=require('./customer-store.cjs');
const {organizationName,opportunityName}=require('../dashboard/classroom.js');
const customers=require('../dashboard/customer-model.js'),pipeline=require('../dashboard/pipeline-model.js'),overview=require('../dashboard/model.js');

test('classroom buyer conversation persists interest, stage, next action and follow-up across profile, pipeline and overview selections',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'classroom-workflow-')),file=path.join(dir,'customers.sqlite');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let store=openStore(file,{expandDemo:true}),data=store.read();
 const company=data.organizations.find(o=>o.name===organizationName),deal=data.opportunities.find(p=>p.organizationId===company.id);
 assert.match(company.needs,/downtime/);assert.deepEqual(company.interests,[]);assert.equal(deal.stage,'Contacted');assert.equal(deal.followupDate,null);
 assert.match(data.leads.find(l=>l.organizationId===company.id).email,/@example\.invalid$/);
 const initialCounts=pipeline.counts(data.opportunities);
 const changed={...deal,stage:'Demo Scheduled',owner:'Josh',nextAction:'Confirm the vibration demo agenda and ask about inspection downtime',followupDate:'2027-02-12'};
 store.save(company.id,{revision:data.meta.revision,company:{...company,interests:['Vibration']},opportunities:[changed]});
 data=store.read();
 const profile=customers.profile(data,company.id);assert.deepEqual(profile.interests,['Vibration']);assert.ok(profile.lastInteraction.summary);
 const pipelineDeal=pipeline.select(data,{query:organizationName})[0];
 const overviewSelection=overview.select(data,'all',organizationName),overviewDeal=overviewSelection.opportunities[0];
 for(const record of [profile.openOpportunities[0],pipelineDeal,overviewDeal]){
  assert.equal(record.name,opportunityName);assert.equal(record.stage,'Demo Scheduled');assert.equal(record.owner,'Josh');assert.equal(record.nextAction,changed.nextAction);assert.equal(record.followupDate,'2027-02-12');
 }
 assert.deepEqual(overviewSelection.organizations[0].interests,['Vibration']);
 const updatedCounts=pipeline.counts(data.opportunities);
 assert.equal(updatedCounts.find(s=>s.stage==='Contacted').count,initialCounts.find(s=>s.stage==='Contacted').count-1);
 assert.equal(updatedCounts.find(s=>s.stage==='Demo Scheduled').count,initialCounts.find(s=>s.stage==='Demo Scheduled').count+1);
 assert.equal(overview.metrics(overviewSelection).openCount,1);
 store.close();store=openStore(file,{expandDemo:true});assert.deepEqual(store.read(),data);store.close();
});

test('existing expanded demos receive the new class example once without overwriting other records or recreating deleted examples',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'classroom-upgrade-')),file=path.join(dir,'customers.sqlite');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let store=openStore(file,{expandDemo:true}),data=store.read();
 store.remove(data.organizations.find(o=>o.name===organizationName).id,data.meta.revision);const before=store.read();store.close();
 // Simulate the original 28-record expansion marker without the new class marker.
 const db=new DatabaseSync(file);db.prepare("DELETE FROM metadata WHERE key='classroomInspectionV1'").run();db.close();
 store=openStore(file,{expandDemo:true});const upgraded=store.read();
 for(const key of ['organizations','leads','opportunities','followups','engagements','notes']){
  const ids=new Set(before[key].map(r=>r.id));assert.deepEqual(upgraded[key].filter(r=>ids.has(r.id)),before[key]);
 }
 assert.equal(upgraded.organizations.length,before.organizations.length+1);
 store.remove(upgraded.organizations.find(o=>o.name===organizationName).id,upgraded.meta.revision);const deleted=store.read();store.close();
 store=openStore(file,{expandDemo:true});assert.deepEqual(store.read(),deleted);store.close();
});
