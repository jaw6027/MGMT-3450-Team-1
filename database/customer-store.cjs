// Local demonstration database. The PostgreSQL design remains in schema.sql.
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const {demoData}=require('./demo.cjs');
const tables={
  organizations:{id:'INTEGER PRIMARY KEY',name:'TEXT NOT NULL',sector:'TEXT NOT NULL',clearance:'TEXT',customerType:"TEXT NOT NULL CHECK(customerType IN ('Military','Civilian'))",industry:'TEXT NOT NULL',segment:'TEXT NOT NULL',relationship:"TEXT NOT NULL CHECK(relationship IN ('Customer','Prospect'))",interests:'TEXT NOT NULL',needs:'TEXT'},
  leads:{id:'INTEGER PRIMARY KEY',organizationId:'INTEGER NOT NULL REFERENCES organizations(id)',name:'TEXT NOT NULL',role:'TEXT',stage:'TEXT NOT NULL',score:'INTEGER CHECK(score BETWEEN 0 AND 100)',email:'TEXT',phone:'TEXT'},
  opportunities:{id:'INTEGER PRIMARY KEY',organizationId:'INTEGER NOT NULL REFERENCES organizations(id)',name:'TEXT NOT NULL',stage:'TEXT NOT NULL',value:'INTEGER NOT NULL CHECK(value >= 0)',probability:'REAL CHECK(probability BETWEEN 0 AND 1)',award:'TEXT',owner:'TEXT'},
  campaigns:{id:'INTEGER PRIMARY KEY',name:'TEXT NOT NULL',channel:'TEXT',status:'TEXT',sectors:'TEXT NOT NULL',budget:'INTEGER CHECK(budget >= 0)',leadIds:'TEXT NOT NULL'},
  engagements:{id:'INTEGER PRIMARY KEY',organizationId:'INTEGER NOT NULL REFERENCES organizations(id)',leadId:'INTEGER REFERENCES leads(id)',type:'TEXT',summary:'TEXT',date:'TEXT NOT NULL'},
  followups:{id:'INTEGER PRIMARY KEY',organizationId:'INTEGER NOT NULL REFERENCES organizations(id)',leadId:'INTEGER REFERENCES leads(id)',dueDate:'TEXT NOT NULL',action:'TEXT NOT NULL',owner:'TEXT NOT NULL',completed:'INTEGER NOT NULL CHECK(completed IN (0,1))'},
  notes:{id:'INTEGER PRIMARY KEY',organizationId:'INTEGER NOT NULL REFERENCES organizations(id)',date:'TEXT NOT NULL',author:'TEXT NOT NULL',text:'TEXT NOT NULL'}
};
const arrays=new Set(['interests','sectors','leadIds']);
function openStore(filename){
  if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  try{
    db.exec('BEGIN');
    db.exec('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    for(const [name,fields] of Object.entries(tables))db.exec(`CREATE TABLE IF NOT EXISTS ${name} (${Object.entries(fields).map(([key,type])=>key+' '+type).join(',')})`);
    db.exec('CREATE INDEX IF NOT EXISTS followups_due ON followups(completed,dueDate); CREATE INDEX IF NOT EXISTS contacts_company ON leads(organizationId); CREATE INDEX IF NOT EXISTS opportunities_company ON opportunities(organizationId);');
    if(!db.prepare("SELECT value FROM metadata WHERE key='seededOn'").get()){
      const data=demoData();
      for(const [name,fields] of Object.entries(tables)){
        const keys=Object.keys(fields),insert=db.prepare(`INSERT INTO ${name} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`);
        for(const row of data[name])insert.run(...keys.map(k=>arrays.has(k)?JSON.stringify(row[k]):typeof row[k]==='boolean'?Number(row[k]):row[k]??null));
      }
      db.prepare('INSERT INTO metadata VALUES (?,?)').run('seededOn',data.meta.seededOn);
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
  return {read(){
    const data={meta:{sampleData:true,currency:'USD',seededOn:db.prepare("SELECT value FROM metadata WHERE key='seededOn'").get().value}};
    for(const name of Object.keys(tables))data[name]=db.prepare(`SELECT * FROM ${name} ORDER BY id`).all().map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,arrays.has(key)?JSON.parse(value):key==='completed'?Boolean(value):value])));
    return data;
  },close(){db.close();}};
}
module.exports={openStore};
