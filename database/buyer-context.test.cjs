const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {openStore}=require('./customer-store.cjs');
const model=require('../dashboard/customer-model.js');

test('organization search combines with all six buyer segments and profiles show linked context',()=>{
 const store=openStore(':memory:',{expandDemo:true});
 try{
  const data=store.read(),segments=['U.S. Air Force','U.S. Navy','Defense contractors','Commercial drone manufacturers','Agricultural drone companies','Infrastructure inspection companies'];
  for(const segment of segments){
   const organization=data.organizations.find(o=>o.segment===segment);
   const selected=model.select(data,{query:organization.name,segment});
   assert.deepEqual(selected.organizations.map(o=>o.id),[organization.id]);
   assert.equal(model.select(data,{query:organization.name,segment:segments.find(s=>s!==segment)}).organizations.length,0);
   const profile=model.profile(data,organization.id);assert.ok(profile.useCase);assert.ok(profile.potentialValue);
   assert.ok(profile.contacts.every(c=>c.name&&c.role));
   assert.ok(profile.openOpportunities.every(p=>p.organizationId===organization.id&&model.open(p)));
   assert.ok(profile.closedOpportunities.every(p=>p.organizationId===organization.id&&!model.open(p)));
   if(profile.lastInteraction){assert.equal(profile.lastInteraction.organizationId,organization.id);assert.equal(profile.lastInteraction.date,profile.lastContact);}
  }
  const org=data.organizations.find(o=>o.name==='Meridian Infrastructure');
  const profile=model.profile(data,org.id);assert.equal(profile.openOpportunities.length,1);assert.equal(profile.closedOpportunities.length,1);assert.ok(profile.lastInteraction.summary);
  const mf=data.organizations.find(o=>o.name==='Atlas Drone Manufacturing');assert.match(mf.potentialValue,/maintenance data for its customers/);
  assert.match(org.potentialValue,/interruptions to scheduled inspections/);
 }finally{store.close();}
});

test('additive buyer context migration, validation, omitted-field preservation and persistence',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'buyer-context-')),file=path.join(dir,'test.sqlite');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let store=openStore(file),before=store.read();store.close();
 const db=new DatabaseSync(file);db.exec("ALTER TABLE organizations DROP COLUMN useCase; ALTER TABLE organizations DROP COLUMN potentialValue; DELETE FROM metadata WHERE key='buyerContextDemoV1'");db.close();
 store=openStore(file);let data=store.read();assert.deepEqual(data.opportunities,before.opportunities);assert.deepEqual(data.leads,before.leads);
 const org=data.organizations[0];assert.ok(org.useCase);assert.ok(org.potentialValue);
 store.save(org.id,{revision:data.meta.revision,company:{...org,useCase:'Team-entered use case',potentialValue:'Team-entered value hypothesis'}});
 data=store.read();const {useCase,potentialValue,...legacyCompany}=data.organizations[0];
 store.save(org.id,{revision:data.meta.revision,company:legacyCompany});
 data=store.read();assert.equal(data.organizations[0].potentialValue,'Team-entered value hypothesis');
 assert.throws(()=>store.save(org.id,{revision:data.meta.revision,company:{...legacyCompany,potentialValue:'x'.repeat(5001)}}),/too long/);
 assert.throws(()=>store.save(org.id,{revision:data.meta.revision,company:{...legacyCompany,useCase:123}}),/must be text/);
 store.close();store=openStore(file);assert.deepEqual(store.read(),data);store.close();
});
