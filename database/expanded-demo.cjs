// One-time, additive fictional scenario pack. Never represents real buying intent.
const {choices,validateCustomer,categoryKey}=require('./customer-input.cjs');
const marker='expandedDemoProspectsV1';
function expandedProspects(today=new Date().toISOString().slice(0,10)){
  const markets=[
    ['af','U.S. Air Force','Air Force','Military','Aerospace & defense',['Cobalt Wing Evaluation Office','Silver Mesa Flight Research Unit','Amber Ridge Maintenance Lab','Juniper Airframe Trials Office'],'Evaluate condition trends on training drone airframes.'],
    ['nv','U.S. Navy','Navy','Military','Maritime defense',['Seaglass Aviation Trials Unit','Tidal Arc Drone Research Office','Coral Reach Fleet Evaluation Lab','Harbor Lantern Uncrewed Systems Unit'],'Explore vibration and temperature monitoring during maritime drone missions.'],
    ['df','Defense contractors','Civilian Commercial','Civilian','Aerospace & defense',['Copper Kite Defense Integration','Aster Shield Airframe Systems','Birch Sentinel Sensor Works','Indigo Crest Mission Engineering'],'Assess lightweight sensor integration for a proposed defense drone platform.'],
    ['mf','Commercial drone manufacturers','Civilian Commercial','Civilian','Drone manufacturing',['Cloud Orchard Drone Works','Granite Finch Airframe Manufacturing','Solstice Rotor Design Studio','Cedar Arc Drone Engineering'],'Review sensor interfaces and structural monitoring for a future drone model.'],
    ['ag','Agricultural drone companies','Civilian Commercial','Civilian','Agriculture',['Meadow Lantern Crop Flights','Saffron Field Drone Services','Harvest Kite Fleet Operations','Orchard Beacon Aero Services'],'Understand payload-cycle effects on crop-spraying and mapping drones.'],
    ['in','Infrastructure inspection companies','Civilian Commercial','Civilian','Infrastructure inspection',['Stonebridge Kite Inspection','Viaduct Lantern Drone Surveys','Copper Span Airframe Services','Canyon Beacon Inspection Flights'],'Evaluate aircraft condition during bridge, utility and asset inspection missions.'],
    ['cv','Civilian drone operators','Civilian Commercial','Civilian','Drone operations',['Lumen Trail Aerial Services','Pine Compass Mapping Flights','Dune Lantern Survey Operations','River Kite Flight Services'],'Explore maintenance planning for a mixed civilian drone fleet.']
  ];
  const shift=offset=>{const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
  return markets.flatMap(([key,segment,sector,customerType,industry,names,needs],market)=>names.map((name,index)=>{
    const code=key+'-'+String(index+1).padStart(2,'0'),owner=choices.accountOwners[(market+index)%choices.accountOwners.length];
    return {company:{...require('./buyer-demo.cjs').buyerContext(segment),name:'Fictional — '+name,sector,customerType,industry,segment,segments:[segment],relationship:'Prospect',interests:index%2?['Vibration','Temperature']:['Vibration','Structural bending'],needs:'Fictional demonstration scenario only: '+needs,clearance:'Not assessed — fictional scenario',accountOwner:owner,leadSource:choices.leadSources[(market+index)%5],qualificationStatus:['New Lead','Interested','Qualified','High Priority'][index],budgetStatus:['','Not identified','Identified','Identified'][index],decisionMakerContacted:['','No','Yes','Yes'][index],purchaseTimeline:['','6–12 months','3–6 months','Within 3 months'][index],interestLevel:['','Moderate','High','High'][index]},
      contacts:[{name:'Demo Contact '+code.toUpperCase(),role:'Fictional evaluation contact',email:'demo-'+code+'@example.invalid',phone:'',stage:['New','Marketing qualified','Sales qualified','Sales qualified'][index],score:[0,35,65,80][index],buyerRole:choices.buyerRoles[index]}],
      opportunities:[{name:'Fictional sensor evaluation '+code.toUpperCase(),stage:['Research','Qualification','Evaluation','Proposal submitted'][index],value:index===0?null:[0,15000,45000,90000][index]+market*1000,probability:[null,.2,.4,.6][index],award:shift(30+index*30+market),owner}],
      followups:[{dueDate:shift([0,2,7,14][index]),action:'Fictional next step: review demonstration monitoring requirements',owner,completed:false}],
      note:{author:'Demo scenario pack',text:'FICTIONAL DEMONSTRATION DATA. This organization, contact, qualification, budget, timeline and opportunity are invented for classroom search/filter exercises. No real buyer, customer relationship, procurement or contract is represented.'}};
  })).concat([require('./classroom-scenario.cjs').classroomScenario(today)]);
}
function expandDemo(db,today){
  db.exec('BEGIN IMMEDIATE');
  try{
    const expanded=Boolean(db.prepare('SELECT value FROM metadata WHERE key=?').get(marker));
    const classroom=Boolean(db.prepare("SELECT value FROM metadata WHERE key='classroomInspectionV1'").get());
    if(expanded&&classroom){db.exec('COMMIT');return 0;}
    function insert(table,fields){const keys=Object.keys(fields);return Number(db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(fields).map(v=>typeof v==='boolean'?Number(v):v)).lastInsertRowid);}
    const prospects=expanded?(!classroom?[require('./classroom-scenario.cjs').classroomScenario(today)]:[]):expandedProspects(today);
    for(const payload of prospects){
      const row=validateCustomer({...payload,revision:0}),organizationId=insert('organizations',{...row.company,interests:JSON.stringify(row.company.interests)});
      const categoryId=db.prepare("SELECT id FROM customer_categories WHERE kind='segment' AND normalizedName=?").get(categoryKey(row.company.segment))?.id;
      if(!categoryId)throw new Error('Demo segment category is missing.');
      insert('organization_segments',{organizationId,categoryId,position:0});
      for(const contact of row.contacts){const {id,...fields}=contact;insert('leads',{organizationId,...fields});}
      for(const opportunity of row.opportunities){const {id,...fields}=opportunity;insert('opportunities',{organizationId,...fields});}
      for(const task of row.followups){const {id,...fields}=task;insert('followups',{organizationId,...fields});}
      if(row.communication)insert('engagements',{organizationId,...row.communication});
      insert('notes',{organizationId,date:today||new Date().toISOString().slice(0,10),...row.note});
    }
    if(!expanded)db.prepare('INSERT INTO metadata (key,value) VALUES (?,?)').run(marker,String(prospects.length));
    db.prepare("INSERT OR IGNORE INTO metadata VALUES ('classroomInspectionV1','1')").run();
    db.exec("UPDATE metadata SET value=CAST(value AS INTEGER)+1 WHERE key='revision'");
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Expanded demo relationship check failed.');
    db.exec('COMMIT');return prospects.length;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
module.exports={expandedProspects,expandDemo,marker};
