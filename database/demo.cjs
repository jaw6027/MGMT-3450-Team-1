// Fictional sample data only. No real buyers, contacts, or procurements.
const original = require('../dashboard/data.js');
function demoData(today = new Date().toISOString().slice(0,10)) {
  const data = structuredClone(original);
  const profiles = [
    ['Military','Aerospace & defense','U.S. Air Force','Prospect',['Vibration','Structural bending'],'Evaluate airframe fatigue indicators during training flights.'],
    ['Military','Maritime defense','U.S. Navy','Prospect',['Temperature','Vibration'],'Evaluate monitoring during maritime drone operations.'],
    ['Civilian','Infrastructure inspection','Infrastructure inspection companies','Customer',['Structural bending','Vibration'],'Assess drone airframe loads during bridge inspection missions.'],
    ['Civilian','Aerospace & defense','Defense contractors','Prospect',['Vibration','Temperature'],'Explore integration with an experimental drone platform.'],
    ['Civilian','Energy inspection','Civilian drone operators','Prospect',['Vibration','Temperature'],'Track aircraft condition across wind-farm inspection routes.'],
    ['Military','Maritime defense','U.S. Navy','Prospect',['Structural bending','Temperature'],'Evaluate environmental effects on port inspection drones.']
  ];
  data.organizations.forEach((o,i)=>Object.assign(o,Object.fromEntries(['customerType','industry','segment','relationship','interests','needs'].map((k,j)=>[k,profiles[i][j]]))));
  data.organizations.push(
    {id:7,name:'Prairie Aero Agriculture',sector:'Civilian Commercial',customerType:'Civilian',industry:'Agriculture',segment:'Agricultural drone companies',relationship:'Prospect',interests:['Structural bending','Vibration'],needs:'Understand repeated payload-cycle effects on spraying drones.',clearance:'None specified'},
    {id:8,name:'Atlas Drone Manufacturing',sector:'Civilian Commercial',customerType:'Civilian',industry:'Drone manufacturing',segment:'Commercial drone manufacturers',relationship:'Prospect',interests:['Vibration','Structural bending','Temperature'],needs:'Explore lightweight monitoring for a new commercial drone model.',clearance:'None specified'},
    {id:9,name:'Vista Flight Services',sector:'Civilian Commercial',customerType:'Civilian',industry:'Drone operations',segment:'Civilian drone operators',relationship:'Prospect',interests:['Temperature'],needs:'Review condition trends across a mixed inspection fleet.',clearance:'None specified'}
  );
  data.leads.push(
    {id:9,organizationId:7,name:'Robin Ellis',role:'Fleet manager',stage:'Marketing qualified',score:62},
    {id:10,organizationId:8,name:'Devon Reed',role:'Product engineer',stage:'New',score:38},
    {id:11,organizationId:9,name:'Skyler Lane',role:'Operations director',stage:'New',score:32}
  );
  data.leads.forEach(l=>Object.assign(l,{email:l.name.toLowerCase().replaceAll(' ','.')+'@example.com',phone:'+1 202-555-'+String(100+l.id).padStart(4,'0')}));
  const shift=days=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  data.followups=[
    {id:1,organizationId:1,leadId:1,dueDate:shift(0),action:'Confirm evaluation goals and decision process',owner:'Alex Morgan',completed:false},
    {id:2,organizationId:2,leadId:2,dueDate:shift(2),action:'Schedule a sensor integration discussion',owner:'Jordan Lee',completed:false},
    {id:3,organizationId:7,leadId:9,dueDate:shift(4),action:'Review aircraft payload and monitoring needs',owner:'Taylor Chen',completed:false},
    {id:4,organizationId:8,leadId:10,dueDate:shift(7),action:'Share the product evaluation brief',owner:'Alex Morgan',completed:false},
    {id:5,organizationId:5,leadId:5,dueDate:shift(-2),action:'Follow up on fleet assessment questions',owner:'Taylor Chen',completed:false},
    {id:6,organizationId:3,leadId:3,dueDate:shift(-3),action:'Record workshop outcome',owner:'Taylor Chen',completed:true}
  ];
  data.notes=[
    {id:1,organizationId:1,date:shift(-3),author:'Alex Morgan',text:'Sample discovery note: interested in a limited evaluation before discussing a larger deployment.'},
    {id:2,organizationId:3,date:shift(-1),author:'Taylor Chen',text:'Sample relationship note: completed a sensor validation workshop; future deployment remains a separate opportunity.'},
    {id:3,organizationId:7,date:shift(-2),author:'Taylor Chen',text:'Sample qualification note: needs aircraft compatibility and sensor weight information.'}
  ];
  data.meta={sampleData:true,seededOn:today};
  return data;
}
module.exports={demoData};
