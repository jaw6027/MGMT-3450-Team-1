const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {openStore}=require('./customer-store.cjs');
test('SQLite seed is persistent, relational and repeatable without overwriting changes',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-store-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const filename=path.join(dir,'customer.sqlite');let store=openStore(filename);
  const original=store.read();assert.equal(original.meta.sampleData,true);assert.equal(original.organizations.length,9);
  assert.deepEqual(original.organizations[0].interests,['Vibration','Structural bending']);
  assert.equal(original.followups.find(f=>f.id===6).completed,true);store.close();
  const db=new DatabaseSync(filename);db.exec('PRAGMA foreign_keys=ON');
  assert.throws(()=>db.prepare('UPDATE leads SET organizationId=999 WHERE id=1').run(),/FOREIGN KEY/);
  assert.throws(()=>db.prepare("UPDATE organizations SET customerType='Unknown' WHERE id=1").run(),/CHECK/);
  db.prepare('UPDATE organizations SET needs=? WHERE id=?').run('Preserved sample requirement',1);db.close();
  store=openStore(filename);t.after(()=>store.close());
  const reopened=store.read();assert.equal(reopened.organizations.length,9);assert.equal(reopened.leads.length,11);
  assert.equal(reopened.organizations[0].needs,'Preserved sample requirement');
  assert.deepEqual(reopened.followups,original.followups);assert.equal(reopened.meta.seededOn,original.meta.seededOn);
});

const {demoData}=require('./demo.cjs');
function companyPayload(revision=0){
  return {revision,company:{name:'Test Aero Example',sector:'Civilian Commercial',clearance:'None specified',customerType:'Civilian',industry:'Agriculture',segment:'Agricultural drone companies',relationship:'Prospect',interests:['Vibration'],needs:'Sample monitoring evaluation'},contacts:[{name:'Sample Contact',email:'sample@example.com',phone:'+1 202-555-0199',role:'Manager',stage:'New',score:0}],opportunities:[{name:'Sample pilot',stage:'Qualification',value:12000,probability:.5,award:'2027-04-01',owner:'Sample Owner'}],followups:[{dueDate:'2027-03-01',action:'Review needs',owner:'Sample Owner',completed:false}],note:{text:'Sample relationship note',author:'Sample Owner'},communication:{type:'Call',date:'2026-11-14',summary:'Sample introductory call'}};
}
function memoryStore(t){const store=openStore(':memory:');t.after(()=>store.close());return store;}
test('create and edit persist company, contacts, deal stages, notes, communication and follow-ups together',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-crud-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const filename=path.join(dir,'existing.sqlite');let store=openStore(filename);const before=store.read();
  const id=store.save(null,companyPayload(before.meta.revision));let data=store.read();
  assert.equal(data.organizations.length,before.organizations.length+1);assert.equal(data.meta.revision,1);
  const contacts=data.leads.filter(l=>l.organizationId===id),opportunities=data.opportunities.filter(p=>p.organizationId===id),followups=data.followups.filter(f=>f.organizationId===id);
  const update=companyPayload(data.meta.revision);update.company.name='Updated Aero';update.company.customerType='Military';update.company.sector='Navy';update.company.industry='Maritime defense';update.company.segment='U.S. Navy';update.company.relationship='Customer';update.company.interests=['Temperature','Structural bending'];
  update.contacts=contacts.map(c=>({...c,name:'Updated Contact',email:'updated@example.com',phone:'+1 202-555-0188',stage:'Sales qualified'}));
  update.contacts.push({name:'Second Contact',email:'second@example.com',phone:'',role:'Engineer',stage:'Marketing qualified',score:20});
  update.opportunities=opportunities.map(o=>({...o,stage:'Awarded',value:25000,probability:1,outcomeReason:'Sample evaluation accepted',awardedValue:25000}));
  update.followups=followups.map(f=>({...f,dueDate:'2027-03-03',completed:true}));
  store.save(id,update);data=store.read();
  assert.equal(data.meta.revision,2);assert.equal(data.organizations.find(o=>o.id===id).customerType,'Military');
  assert.equal(data.leads.find(l=>l.id===contacts[0].id).email,'updated@example.com');assert.equal(data.opportunities.find(o=>o.id===opportunities[0].id).stage,'Awarded');assert.equal(data.followups.find(f=>f.id===followups[0].id).completed,true);
  assert.equal(data.notes.filter(n=>n.organizationId===id).length,2);assert.equal(data.engagements.filter(e=>e.organizationId===id).length,2);
  // All original companies and linked records are unchanged by creating/editing a new company.
  for(const table of ['organizations','leads','opportunities','followups','notes','engagements'])assert.deepEqual(data[table].filter(row=>table==='organizations'?row.id!==id:row.organizationId!==id),before[table]);
  store.close();store=openStore(filename);assert.deepEqual(store.read(),data);store.close();
});
test('invalid changes, cross-company IDs and stale revisions roll back every write',t=>{
  const store=memoryStore(t),before=store.read();
  const cases=[
    p=>p.company.name=' ',p=>p.company.customerType='Unknown',p=>p.contacts[0].email='invalid',p=>p.followups[0].dueDate='2027-02-30',p=>p.opportunities[0].value=-1,p=>p.opportunities[0].value=1.5,p=>p.opportunities[0].stage='Imaginary',p=>p.contacts[0].id=1,p=>p.followups[0].id=1,p=>p.contacts.push({...p.contacts[0]})
  ];
  for(const mutate of cases){const payload=companyPayload();mutate(payload);assert.throws(()=>store.save(null,payload),e=>e.status===400);assert.deepEqual(store.read(),before);}
  const badUpdate=companyPayload();badUpdate.contacts=[{...badUpdate.contacts[0],id:2}];assert.throws(()=>store.save(1,badUpdate),e=>e.status===400);assert.deepEqual(store.read(),before);
  const id=store.save(null,companyPayload());const current=store.read();assert.throws(()=>store.save(id,companyPayload(0)),e=>e.status===409);assert.throws(()=>store.remove(id,0),e=>e.status===409);assert.deepEqual(store.read(),current);
});
test('editing company-only preserves contacts, history, opportunities and follow-ups',t=>{
  const store=memoryStore(t),before=store.read();const company={...before.organizations[0],name:'Changed example name'};
  store.save(1,{revision:0,company});const after=store.read();
  assert.equal(after.organizations[0].name,'Changed example name');
  for(const table of ['leads','opportunities','engagements','followups','notes','campaigns'])assert.deepEqual(after[table],before[table]);
  // An omitted contact is still considered when checking duplicate email addresses.
  const payload={revision:1,company,contacts:[{name:'Duplicate',email:before.leads[0].email.toUpperCase(),stage:'New',score:0}]};assert.throws(()=>store.save(1,payload),e=>e.status===400);assert.deepEqual(store.read(),after);
});
test('confirmed deletion removes only the selected company and linked records, preserving campaigns',t=>{
  const store=memoryStore(t),before=store.read(),leadIds=new Set(before.leads.filter(l=>l.organizationId===1).map(l=>l.id));
  store.remove(1,before.meta.revision);const after=store.read();
  assert.deepEqual(after.organizations,before.organizations.filter(o=>o.id!==1));
  for(const table of ['leads','opportunities','engagements','followups','notes'])assert.deepEqual(after[table],before[table].filter(r=>r.organizationId!==1));
  assert.deepEqual(after.campaigns,before.campaigns.map(c=>({...c,leadIds:c.leadIds.filter(id=>!leadIds.has(id))})));
  assert.throws(()=>store.remove(999,after.meta.revision),e=>e.status===404);assert.deepEqual(store.read(),after);
});
test('an intentionally emptied database stays empty after reopening, without reseeding',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-empty-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const filename=path.join(dir,'crm.sqlite');let store=openStore(filename);
  for(const company of store.read().organizations)store.remove(company.id,store.read().meta.revision);
  store.close();store=openStore(filename);assert.equal(store.read().organizations.length,0);assert.equal(store.read().leads.length,0);assert.equal(store.read().meta.revision,9);store.close();
});

test('category migration preserves a legacy database and backfills segments without inventing owners or sources',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-categories-migration-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const filename=path.join(dir,'existing.sqlite');let store=openStore(filename);store.close();
  const legacy=new DatabaseSync(filename);
  legacy.exec("DROP TABLE organization_segments; DROP TABLE customer_categories; ALTER TABLE organizations DROP COLUMN accountOwner; ALTER TABLE organizations DROP COLUMN leadSource; ALTER TABLE leads DROP COLUMN buyerRole; DELETE FROM metadata WHERE key='categoryMigration'; UPDATE metadata SET value='7' WHERE key='revision';");
  legacy.prepare('UPDATE organizations SET industry=?,segment=? WHERE id=1').run('Legacy custom industry','Legacy custom segment');
  const originals={};for(const table of ['organizations','leads','opportunities','engagements','followups','notes','campaigns'])originals[table]=legacy.prepare(`SELECT * FROM ${table} ORDER BY id`).all();legacy.close();
  store=openStore(filename);const migrated=store.read();store.close();
  assert.equal(migrated.meta.revision,7);assert.equal(migrated.organizations.length,9);assert.equal(migrated.leads.length,11);
  assert.ok(migrated.meta.choices.industries.includes('Legacy custom industry'));assert.ok(migrated.meta.choices.segments.includes('Legacy custom segment'));
  for(const o of migrated.organizations){assert.equal(o.accountOwner,'');assert.equal(o.leadSource,'');assert.deepEqual(o.segments,[o.segment]);}
  assert.ok(migrated.leads.every(l=>l.buyerRole===''));
  const db=new DatabaseSync(filename,{readOnly:true});for(const [table,rows] of Object.entries(originals)){const keys=Object.keys(rows[0]);assert.deepEqual(db.prepare(`SELECT ${keys.join(',')} FROM ${table} ORDER BY id`).all(),rows);}db.close();
  store=openStore(filename);assert.deepEqual(store.read(),migrated);store.close();
});
test('standard categories, multiple segments, account ownership, lead source and buyer roles persist',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-categories-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const filename=path.join(dir,'customer.sqlite');let store=openStore(filename);
  const payload=companyPayload();payload.company.accountOwner='Vanessa';payload.company.leadSource='Website inquiry';payload.company.segments=['Agricultural drone companies','Commercial drone manufacturers'];payload.contacts[0].buyerRole='Decision-maker';
  const id=store.save(null,payload);let result=store.read(),company=result.organizations.find(o=>o.id===id);
  assert.deepEqual(company.segments,payload.company.segments);assert.equal(company.segment,payload.company.segments[0]);assert.equal(company.accountOwner,'Vanessa');assert.equal(company.leadSource,'Website inquiry');assert.equal(result.leads.find(l=>l.organizationId===id).buyerRole,'Decision-maker');
  const update={revision:1,company:{...company,accountOwner:'Hannah',leadSource:'Referral',industry:'New aerospace niche',segments:['New buyer segment','Defense contractors']},newCategories:[{kind:'industry',name:'  New   aerospace niche  '},{kind:'segment',name:'New buyer segment'}]};store.save(id,update);result=store.read();company=result.organizations.find(o=>o.id===id);assert.equal(company.industry,'New aerospace niche');assert.equal(company.accountOwner,'Hannah');assert.deepEqual(company.segments,['New buyer segment','Defense contractors']);
  // Case and whitespace variants select the same reusable category.
  store.save(id,{revision:2,company:{...company,industry:' NEW   AEROSPACE NICHE ',segments:[' new buyer SEGMENT ','Defense contractors']},newCategories:[{kind:'industry',name:'NEW AEROSPACE NICHE'}]});
  result=store.read();assert.equal(result.meta.choices.industries.filter(n=>n.toLowerCase()==='new aerospace niche').length,1);assert.equal(result.organizations.find(o=>o.id===id).industry,'New aerospace niche');
  store.close();store=openStore(filename);assert.deepEqual(store.read(),result);store.close();
});
test('invalid categories, owners, sources and buyer roles cannot alter records or category lists',t=>{
  const store=memoryStore(t),before=store.read();
  for(const mutate of [p=>p.company.industry='Unregistered industry',p=>p.company.segments=['Unregistered segment'],p=>p.company.segments=[],p=>p.company.accountOwner='Someone else',p=>p.company.leadSource='Unknown',p=>p.contacts[0].buyerRole='Invalid buyer role']){
    const payload=companyPayload();payload.newCategories=[{kind:'industry',name:'Must roll back'}];mutate(payload);assert.throws(()=>store.save(null,payload),e=>e.status===400);assert.deepEqual(store.read(),before);
  }
  for(const owner of ['Vanessa','Janice','Sherry','Austin','Hannah']){const payload=companyPayload(store.read().meta.revision);payload.company.accountOwner=owner;const id=store.save(null,payload);assert.equal(store.read().organizations.find(o=>o.id===id).accountOwner,owner);}
});

test('qualification, nullable values, awarded amounts and outcome reasons persist without conflating unknown and zero',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-forecast-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const filename=path.join(dir,'crm.sqlite');let store=openStore(filename);
 const payload=companyPayload();Object.assign(payload.company,{qualificationStatus:'High Priority',budgetStatus:'Identified',decisionMakerContacted:'Yes',purchaseTimeline:'Within 3 months',interestLevel:'High'});payload.opportunities[0].value=null;payload.opportunities[0].probability=null;
 const id=store.save(null,payload);let data=store.read(),opportunity=data.opportunities.find(p=>p.organizationId===id);assert.equal(opportunity.value,null);assert.equal(opportunity.probability,null);assert.equal(data.organizations.find(o=>o.id===id).qualificationStatus,'High Priority');
 const update={revision:data.meta.revision,company:data.organizations.find(o=>o.id===id),opportunities:[{...opportunity,stage:'Awarded',awardedValue:0,outcomeReason:'Fictional no-cost evaluation accepted'}]};store.save(id,update);data=store.read();opportunity=data.opportunities.find(p=>p.organizationId===id);assert.equal(opportunity.awardedValue,0);assert.equal(opportunity.value,null);assert.equal(opportunity.outcomeReason,'Fictional no-cost evaluation accepted');
 store.close();store=openStore(filename);assert.deepEqual(store.read(),data);store.close();
});
test('new won/lost transitions require reasons and invalid qualification or amounts roll back',t=>{
 const store=memoryStore(t),before=store.read();
 for(const mutate of [p=>p.company.qualificationStatus='Imaginary',p=>p.company.budgetStatus='Maybe',p=>p.company.decisionMakerContacted=true,p=>p.company.interestLevel='Extreme',p=>p.company.purchaseTimeline='Yesterday',p=>p.opportunities[0].awardedValue=-1,p=>p.opportunities[0].probability=1.2,p=>p.opportunities[0].stage='Lost',p=>p.opportunities[0].stage='Awarded']){
  const payload=companyPayload();mutate(payload);assert.throws(()=>store.save(null,payload),e=>e.status===400);assert.deepEqual(store.read(),before);
 }
 const payload=companyPayload();payload.opportunities[0].stage='Lost';payload.opportunities[0].outcomeReason='Fictional budget unavailable';const id=store.save(null,payload);assert.equal(store.read().opportunities.find(p=>p.organizationId===id).outcomeReason,'Fictional budget unavailable');
});
test('legacy NOT NULL opportunity values migrate atomically with every original record preserved',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-nullable-migration-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const filename=path.join(dir,'existing.sqlite');let store=openStore(filename);store.close();
 const legacy=new DatabaseSync(filename);legacy.exec(`CREATE TABLE legacy_opportunities (id INTEGER PRIMARY KEY,organizationId INTEGER NOT NULL REFERENCES organizations(id),name TEXT NOT NULL,stage TEXT NOT NULL,value INTEGER NOT NULL CHECK(value >= 0),probability REAL CHECK(probability BETWEEN 0 AND 1),award TEXT,owner TEXT);
 INSERT INTO legacy_opportunities SELECT id,organizationId,name,stage,value,probability,award,owner FROM opportunities;
 DROP TABLE opportunities; ALTER TABLE legacy_opportunities RENAME TO opportunities; CREATE INDEX opportunities_company ON opportunities(organizationId);
 DELETE FROM metadata WHERE key='forecastMigration';`);
 for(const column of ['qualificationStatus','budgetStatus','decisionMakerContacted','purchaseTimeline','interestLevel'])legacy.exec(`ALTER TABLE organizations DROP COLUMN ${column}`);
 const originals={};for(const table of ['organizations','leads','opportunities','campaigns','engagements','followups','notes','customer_categories','organization_segments'])originals[table]=legacy.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();legacy.close();
 store=openStore(filename);const data=store.read();store.close();assert.equal(data.organizations.length,9);assert.ok(data.organizations.every(o=>o.qualificationStatus===''&&o.budgetStatus===''&&o.purchaseTimeline===''));assert.equal(data.opportunities.find(p=>p.stage==='Awarded').awardedValue,60000);
 const db=new DatabaseSync(filename,{readOnly:true});for(const [table,rows] of Object.entries(originals))assert.deepEqual(db.prepare(`SELECT ${Object.keys(rows[0]).join(',')} FROM ${table} ORDER BY rowid`).all(),rows);assert.equal(db.prepare('PRAGMA table_info(opportunities)').all().find(c=>c.name==='value').notnull,0);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='opportunities_company'").get());db.close();
 store=openStore(filename);assert.deepEqual(store.read(),data);store.close();
});
