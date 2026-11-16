const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const {fail}=require('./customer-input.cjs');
const M=require('../dashboard/prospect-model.js');
function openProspectStore(filename,catalog){
  if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS public_prospects (key TEXT PRIMARY KEY,research TEXT NOT NULL,outreach TEXT NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS prospect_outreach_history (id INTEGER PRIMARY KEY,prospectKey TEXT NOT NULL,payload TEXT NOT NULL,savedAt TEXT NOT NULL);`);
  // Refresh only sourced research. Team outreach survives catalog updates and restarts.
  db.exec('BEGIN IMMEDIATE');
  try{
    for(const p of catalog)db.prepare(`INSERT INTO public_prospects(key,research) VALUES (?,?)
      ON CONFLICT(key) DO UPDATE SET research=excluded.research,revision=public_prospects.revision+1
      WHERE public_prospects.research<>excluded.research`).run(p.key,JSON.stringify(p));
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');db.close();throw e;}
  const defaults={outreachStatus:'Not contacted',owner:'',lastContact:'',nextActionDate:'',notes:'',dataIssue:false,updatedAt:''};
  const unpack=r=>({...JSON.parse(r.research),...defaults,...JSON.parse(r.outreach),revision:r.revision});
  const read=()=>({prospects:db.prepare('SELECT * FROM public_prospects ORDER BY key').all().map(unpack)});
  function save(key,input){
    if(!input||typeof input!=='object'||Array.isArray(input))fail('Send an outreach record.');
    const allowed=['revision','outreachStatus','owner','lastContact','nextActionDate','notes','dataIssue'];
    if(Object.keys(input).some(k=>!allowed.includes(k)))fail('Only outreach fields can be edited here; research evidence is maintained in the source catalog.');
    if(!Number.isSafeInteger(input.revision)||input.revision<0)fail('A current record revision is required.');
    if(!M.statuses.includes(input.outreachStatus))fail('Choose a valid outreach status.');
    if(typeof input.dataIssue!=='boolean')fail('Data issue must be true or false.');
    const text=(value,label,max)=>{if(typeof value!=='string'||value.length>max)fail(label+' is too long or invalid.');return value.trim();};
    const date=(value,label)=>{const s=text(value,label,10);if(s&&(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T12:00:00Z'))||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s))fail('Enter a valid '+label+'.');return s;};
    const record={outreachStatus:input.outreachStatus,owner:text(input.owner,'Owner',100),notes:text(input.notes,'Notes',2000),lastContact:date(input.lastContact,'last-contact date'),nextActionDate:date(input.nextActionDate,'next-action date'),dataIssue:input.dataIssue,updatedAt:new Date().toISOString()};
    if(record.lastContact>M.today())fail('Last contact cannot be in the future.');
    if(['Contacted','In discussion'].includes(record.outreachStatus)&&!record.lastContact)fail('Record the last-contact date for contacted prospects.');
    if(record.dataIssue&&!record.notes)fail('Explain the data issue in your notes.');
    db.exec('BEGIN IMMEDIATE');
    try{
      const row=db.prepare('SELECT * FROM public_prospects WHERE key=?').get(key);
      if(!row)fail('Prospect not found.',404);
      if(row.revision!==input.revision)fail('This prospect changed. Refresh the directory before saving again; your form is preserved.',409);
      db.prepare('UPDATE public_prospects SET outreach=?,revision=revision+1 WHERE key=?').run(JSON.stringify(record),key);
      db.prepare('INSERT INTO prospect_outreach_history(prospectKey,payload,savedAt) VALUES (?,?,?)').run(key,JSON.stringify(record),record.updatedAt);
      db.exec('COMMIT');return read();
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  return {read,save,close:()=>db.close()};
}
module.exports={openProspectStore};
