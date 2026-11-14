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
  update.opportunities=opportunities.map(o=>({...o,stage:'Awarded',value:25000,probability:1}));
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
