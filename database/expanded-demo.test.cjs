const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {DatabaseSync}=require('node:sqlite');
const {openStore}=require('./customer-store.cjs');const {expandedProspects,expandDemo,marker}=require('./expanded-demo.cjs');const {choices}=require('./customer-input.cjs');
test('expanded pack gives every major segment 4–6 fictional prospects without changing existing records',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-expanded-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const filename=path.join(dir,'existing.sqlite');let store=openStore(filename),before=store.read();store.close();
 store=openStore(filename,{expandDemo:true});const result=store.read();assert.equal(result.organizations.length,38);assert.equal(result.leads.length,40);assert.equal(result.opportunities.length,37);assert.equal(result.meta.revision,before.meta.revision+1);
 for(const segment of choices.segments){const all=result.organizations.filter(o=>o.segments.includes(segment)),prospects=all.filter(o=>o.relationship==='Prospect');assert.ok(all.length>=4&&all.length<=6,segment);assert.ok(prospects.length>=4&&prospects.length<=6,segment);}
 for(const table of ['organizations','leads','opportunities','campaigns','engagements','followups','notes']){const ids=new Set(before[table].map(r=>r.id));assert.deepEqual(result[table].filter(r=>ids.has(r.id)),before[table]);}
 const newCompanies=result.organizations.filter(o=>!before.organizations.some(old=>old.id===o.id));for(const o of newCompanies){assert.match(o.name,/^Fictional — /);assert.equal(o.relationship,'Prospect');assert.match(o.needs,/Fictional demonstration/);assert.match(result.notes.find(n=>n.organizationId===o.id).text,/No real buyer/);}
 const newContacts=result.leads.filter(l=>newCompanies.some(o=>o.id===l.organizationId));assert.ok(newContacts.every(l=>l.name.startsWith('Demo Contact ')&&l.email.endsWith('@example.invalid')&&l.phone===''));
 store.close();store=openStore(filename,{expandDemo:true});assert.deepEqual(store.read(),result);
 // Editing or deleting a demo prospect never makes startup recreate or overwrite it.
 const company=store.read().organizations.find(o=>o.name.startsWith('Fictional — '));store.save(company.id,{revision:store.read().meta.revision,company:{...company,name:'Edited fictional classroom prospect'}});store.remove(company.id,store.read().meta.revision);const after=store.read();store.close();store=openStore(filename,{expandDemo:true});assert.deepEqual(store.read(),after);store.close();
});
test('expansion is atomic on failure and does not leave partially inserted prospects',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flightpath-expand-rollback-')),filename=path.join(dir,'crm.sqlite');
 try{const s=openStore(filename);const before=s.read();s.close();const db=new DatabaseSync(filename);db.exec("CREATE TRIGGER simulate_demo_failure BEFORE INSERT ON notes WHEN NEW.author='Demo scenario pack' BEGIN SELECT RAISE(ABORT, 'simulated demo write failure'); END");
 assert.throws(()=>expandDemo(db,'2026-11-15'),/simulated demo write failure/);assert.equal(db.prepare('SELECT count(*) AS count FROM organizations').get().count,before.organizations.length);for(const table of ['leads','opportunities','followups','notes'])assert.equal(db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count,before[table].length);assert.equal(db.prepare('SELECT value FROM metadata WHERE key=?').get(marker),undefined);assert.equal(Number(db.prepare("SELECT value FROM metadata WHERE key='revision'").get().value),before.meta.revision);db.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('fictional scenarios span searchable stages, owners, sources and qualifications',()=>{
 const rows=expandedProspects('2026-11-15');assert.equal(rows.length,29);assert.equal(new Set(rows.map(r=>r.company.name)).size,29);assert.equal(new Set(rows.map(r=>r.company.accountOwner)).size,5);assert.equal(new Set(rows.map(r=>r.company.leadSource)).size,5);assert.equal(new Set(rows.map(r=>r.opportunities[0].stage)).size,5);assert.ok(rows.every(r=>r.company.relationship==='Prospect'));
});
