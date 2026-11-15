const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('./customer-store.cjs');
const catalog=require('./us-prospects.json');

test('public directory persists separately, without inventing CRM accounts or revenue',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-prospects-')),file=path.join(dir,'test.sqlite');let store;
  try{
    store=openStore(file);const before=store.read();
    assert.equal(before.prospectDirectory.length,catalog.entries.length);assert.equal(before.organizations.length,9);
    assert.equal(before.prospectDirectory.filter(p=>p.state==='CA').length,19);
    assert.ok(before.prospectDirectory.every(p=>p.country==='United States'&&p.organizationId===null));
    store.close();store=openStore(file);assert.deepEqual(store.read(),before);
    const p=before.prospectDirectory.find(p=>p.key==='skydio');
    const id=store.trackProspect(p.key,before.meta.revision),after=store.read(),org=after.organizations.find(o=>o.id===id);
    assert.equal(org.publicProspect.marketUse,'Both');assert.equal(org.customerType,'Civilian');assert.equal(org.relationship,'Prospect');
    assert.equal(org.qualificationStatus,'New Lead');assert.equal(org.budgetStatus,'');assert.equal(org.needs,'');assert.deepEqual(org.interests,[]);
    for(const field of ['leads','opportunities','followups','engagements','campaigns'])assert.deepEqual(after[field],before[field]);
    const note=after.notes.find(n=>n.organizationId===id);assert.ok(note.text.includes(p.sourceUrl));assert.ok(note.text.includes(p.locationSourceUrl));
    assert.equal(store.trackProspect(p.key,after.meta.revision),id);assert.equal(store.read().organizations.length,10);
    const company={...org,name:'Skydio account under evaluation',needs:'Team-entered customer discovery'};
    store.save(id,{revision:store.read().meta.revision,company});
    const edited=store.read();store.close();store=openStore(file);assert.deepEqual(store.read(),edited);
    assert.equal(store.read().organizations.find(o=>o.id===id).needs,'Team-entered customer discovery');
    assert.equal(store.read().organizations.find(o=>o.id===id).publicProspect.key,p.key);
    store.remove(id,store.read().meta.revision);assert.equal(store.read().prospectDirectory.find(q=>q.key===p.key).organizationId,null);
    store.close();store=openStore(file);assert.equal(store.read().organizations.length,9); // no automatic re-import after deletion
  }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('stale tracking requests and unknown keys cannot change the database; manual account names are deduplicated',()=>{
  const store=openStore(':memory:');
  try{
    const before=store.read();assert.throws(()=>store.trackProspect('skydio',99),e=>e.status===409);assert.deepEqual(store.read(),before);
    assert.throws(()=>store.trackProspect('does-not-exist',0),e=>e.status===404);assert.deepEqual(store.read(),before);
    const id=store.save(null,{revision:0,company:{...before.organizations[0],name:'  SKYDIO  ',customerType:'Civilian',relationship:'Prospect'}});
    const saved=store.read();assert.equal(store.trackProspect('skydio',saved.meta.revision),id);
    assert.equal(store.read().organizations.length,10);assert.deepEqual(store.read().notes,saved.notes);
    assert.equal(store.read().prospectDirectory.find(p=>p.key==='skydio').organizationId,id);
  }finally{store.close();}
});
