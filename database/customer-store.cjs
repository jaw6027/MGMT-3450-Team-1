// Local demonstration database. The PostgreSQL design remains in schema.sql.
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const {demoData}=require('./demo.cjs');
const {choices,fail,revision,validateCustomer,categoryName,categoryKey}=require('./customer-input.cjs');
const tables={
  organizations:{id:'INTEGER PRIMARY KEY',name:'TEXT NOT NULL',sector:'TEXT NOT NULL',clearance:'TEXT',customerType:"TEXT NOT NULL CHECK(customerType IN ('Military','Civilian'))",industry:'TEXT NOT NULL',segment:'TEXT NOT NULL',relationship:"TEXT NOT NULL CHECK(relationship IN ('Customer','Prospect'))",interests:'TEXT NOT NULL',needs:'TEXT'},
  leads:{id:'INTEGER PRIMARY KEY',organizationId:'INTEGER NOT NULL REFERENCES organizations(id)',name:'TEXT NOT NULL',role:'TEXT',stage:'TEXT NOT NULL',score:'INTEGER CHECK(score BETWEEN 0 AND 100)',email:'TEXT',phone:'TEXT'},
  opportunities:{id:'INTEGER PRIMARY KEY',organizationId:'INTEGER NOT NULL REFERENCES organizations(id)',name:'TEXT NOT NULL',stage:'TEXT NOT NULL',value:'INTEGER CHECK(value >= 0)',probability:'REAL CHECK(probability BETWEEN 0 AND 1)',award:'TEXT',owner:'TEXT'},
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
    db.prepare("INSERT OR IGNORE INTO metadata (key,value) VALUES ('revision','0')").run();
    // Additive migration: leave every existing field and linked record intact.
    for(const [table,column] of [['organizations','accountOwner'],['organizations','leadSource'],['leads','buyerRole']]){
      if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
    }
    db.exec(`CREATE TABLE IF NOT EXISTS customer_categories (
      id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('industry','segment')),
      name TEXT NOT NULL, normalizedName TEXT NOT NULL, UNIQUE(kind,normalizedName)
    );
    CREATE TABLE IF NOT EXISTS organization_segments (
      organizationId INTEGER NOT NULL REFERENCES organizations(id),
      categoryId INTEGER NOT NULL REFERENCES customer_categories(id),
      position INTEGER NOT NULL, PRIMARY KEY(organizationId,categoryId)
    );`);
    if(!db.prepare("SELECT value FROM metadata WHERE key='categoryMigration'").get()){
      for(const name of choices.industries)addCategory('industry',name);
      for(const name of choices.segments)addCategory('segment',name);
      for(const company of db.prepare('SELECT id,industry,segment FROM organizations').all()){
        addCategory('industry',company.industry);
        const categoryId=addCategory('segment',company.segment);
        db.prepare('INSERT OR IGNORE INTO organization_segments VALUES (?,?,0)').run(company.id,categoryId);
      }
      db.prepare("INSERT INTO metadata VALUES ('categoryMigration','1')").run();
    }
    // SQLite cannot remove NOT NULL in place. Rebuild only this table atomically,
    // preserving its IDs, data, indexes, and original database file.
    if(db.prepare('PRAGMA table_info(opportunities)').all().find(c=>c.name==='value').notnull){
      const fields=tables.opportunities,columns=Object.keys(fields).join(',');
      db.exec(`CREATE TABLE opportunities_nullable (${Object.entries(fields).map(([key,type])=>key+' '+type).join(',')});
        INSERT INTO opportunities_nullable (${columns}) SELECT ${columns} FROM opportunities;
        DROP TABLE opportunities;
        ALTER TABLE opportunities_nullable RENAME TO opportunities;
        CREATE INDEX opportunities_company ON opportunities(organizationId);`);
    }
    for(const column of ['qualificationStatus','budgetStatus','decisionMakerContacted','purchaseTimeline','interestLevel']){
      if(!db.prepare('PRAGMA table_info(organizations)').all().some(c=>c.name===column))db.exec(`ALTER TABLE organizations ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
    }
    for(const [column,type] of [['outcomeReason',"TEXT NOT NULL DEFAULT ''"],['awardedValue','INTEGER CHECK(awardedValue >= 0)']]){
      if(!db.prepare('PRAGMA table_info(opportunities)').all().some(c=>c.name===column))db.exec(`ALTER TABLE opportunities ADD COLUMN ${column} ${type}`);
    }
    if(!db.prepare("SELECT value FROM metadata WHERE key='forecastMigration'").get()){
      // Existing awarded/delivery values were already recorded as contract values.
      db.exec("UPDATE opportunities SET awardedValue=value WHERE stage IN ('Awarded','Delivery') AND awardedValue IS NULL");
      db.prepare("INSERT INTO metadata VALUES ('forecastMigration','1')").run();
    }
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Database migration failed its relationship check.');
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
  function addCategory(kind,name){
    const normalized=categoryName(name,'Category name'),key=categoryKey(normalized);
    db.prepare('INSERT OR IGNORE INTO customer_categories (kind,name,normalizedName) VALUES (?,?,?)').run(kind,normalized,key);
    return db.prepare('SELECT id FROM customer_categories WHERE kind=? AND normalizedName=?').get(kind,key).id;
  }
  function category(kind,name){
    const result=db.prepare('SELECT id,name FROM customer_categories WHERE kind=? AND normalizedName=?').get(kind,categoryKey(name));
    if(!result)fail('Choose a saved '+kind+' or add it as a new category.');return result;
  }
  function currentRevision(){return Number(db.prepare("SELECT value FROM metadata WHERE key='revision'").get().value);}
  function transaction(expected,operation){
    db.exec('BEGIN IMMEDIATE');
    try{
      if(revision(expected)!==currentRevision())fail('Records changed in another window. Close this form, refresh the dashboard, and reopen the customer before saving.',409);
      const result=operation();
      db.prepare("UPDATE metadata SET value=? WHERE key='revision'").run(String(currentRevision()+1));
      db.exec('COMMIT');return result;
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  function companyExists(id){if(!Number.isSafeInteger(id)||!db.prepare('SELECT id FROM organizations WHERE id=?').get(id))fail('Customer not found.',404);}
  function saveRows(table,companyId,rows){
    for(const row of rows){
      const {id,...fields}=row;
      if(id!==null){
        if(!db.prepare(`SELECT id FROM ${table} WHERE id=? AND organizationId=?`).get(id,companyId))fail('A linked record does not belong to this customer.',400);
        db.prepare(`UPDATE ${table} SET ${Object.keys(fields).map(k=>k+'=?').join(',')} WHERE id=?`).run(...Object.values(fields).map(v=>typeof v==='boolean'?Number(v):v),id);
      }else{
        const keys=['organizationId',...Object.keys(fields)];
        db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(companyId,...Object.values(fields).map(v=>typeof v==='boolean'?Number(v):v));
      }
    }
  }
  return {save(id,payload){
    const input=validateCustomer(payload);
    return transaction(input.revision,()=>{
      for(const c of input.newCategories)addCategory(c.kind,c.name);
      const selectedSegments=input.segments.map(name=>category('segment',name));
      const company={...input.company,industry:category('industry',input.company.industry).name,segment:selectedSegments[0].name,interests:JSON.stringify(input.company.interests)};
      if(id===null){
        const keys=Object.keys(company);
        id=Number(db.prepare(`INSERT INTO organizations (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(company)).lastInsertRowid);
      }else{
        companyExists(id);
        db.prepare(`UPDATE organizations SET ${Object.keys(company).map(k=>k+'=?').join(',')} WHERE id=?`).run(...Object.values(company),id);
      }
      db.prepare('DELETE FROM organization_segments WHERE organizationId=?').run(id);
      selectedSegments.forEach((segment,index)=>db.prepare('INSERT INTO organization_segments VALUES (?,?,?)').run(id,segment.id,index));
      // Omitted related records are preserved; only explicitly submitted rows are updated.
      saveRows('leads',id,input.contacts);
      const emails=db.prepare("SELECT lower(trim(email)) AS email FROM leads WHERE organizationId=? AND email IS NOT NULL AND trim(email)<>'' GROUP BY lower(trim(email)) HAVING count(*)>1").all(id);
      if(emails.length)fail('This company already has a contact with that email address.');
      for(const opportunity of input.opportunities){
        const previous=opportunity.id===null?null:db.prepare('SELECT stage FROM opportunities WHERE id=? AND organizationId=?').get(opportunity.id,id);
        if(['Awarded','Delivery','Lost'].includes(opportunity.stage)&&opportunity.stage!==previous?.stage&&!opportunity.outcomeReason?.trim())fail('Record a reason when marking an opportunity as won, delivered, or lost.');
      }
      saveRows('opportunities',id,input.opportunities);
      saveRows('followups',id,input.followups);
      if(input.note)db.prepare('INSERT INTO notes (organizationId,date,author,text) VALUES (?,?,?,?)').run(id,new Date().toISOString().slice(0,10),input.note.author,input.note.text);
      if(input.communication)db.prepare('INSERT INTO engagements (organizationId,type,date,summary) VALUES (?,?,?,?)').run(id,input.communication.type,input.communication.date,input.communication.summary);
      return id;
    });
  },remove(id,expectedRevision){
    return transaction(expectedRevision,()=>{
      companyExists(id);
      const leadIds=new Set(db.prepare('SELECT id FROM leads WHERE organizationId=?').all(id).map(l=>l.id));
      for(const campaign of db.prepare('SELECT id,leadIds FROM campaigns').all()){
        const before=JSON.parse(campaign.leadIds),after=before.filter(leadId=>!leadIds.has(leadId));
        if(after.length!==before.length)db.prepare('UPDATE campaigns SET leadIds=? WHERE id=?').run(JSON.stringify(after),campaign.id);
      }
      for(const table of ['organization_segments','engagements','followups','notes','opportunities','leads'])db.prepare(`DELETE FROM ${table} WHERE organizationId=?`).run(id);
      db.prepare('DELETE FROM organizations WHERE id=?').run(id);
    });
  },read(){
    const data={meta:{sampleData:true,currency:'USD',revision:currentRevision(),choices,seededOn:db.prepare("SELECT value FROM metadata WHERE key='seededOn'").get().value}};
    for(const name of Object.keys(tables))data[name]=db.prepare(`SELECT * FROM ${name} ORDER BY id`).all().map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,arrays.has(key)?JSON.parse(value):key==='completed'?Boolean(value):value])));
    const categories=db.prepare('SELECT * FROM customer_categories ORDER BY name COLLATE NOCASE').all();
    data.meta.choices={...choices,industries:categories.filter(c=>c.kind==='industry').map(c=>c.name),segments:categories.filter(c=>c.kind==='segment').map(c=>c.name)};
    const memberships=db.prepare('SELECT s.organizationId,c.name FROM organization_segments s JOIN customer_categories c ON c.id=s.categoryId ORDER BY s.position,c.name').all();
    data.organizations=data.organizations.map(o=>({...o,industry:category('industry',o.industry).name,segments:memberships.filter(s=>s.organizationId===o.id).map(s=>s.name)}));
    return data;
  },close(){db.close();}};
}
module.exports={openStore};
