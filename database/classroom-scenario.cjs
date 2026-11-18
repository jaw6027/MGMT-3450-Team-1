const {organizationName,opportunityName}=require('../dashboard/classroom.js');
function classroomScenario(today=new Date().toISOString().slice(0,10)){
 return {
  company:{name:organizationName,sector:'Civilian Commercial',customerType:'Civilian',industry:'Infrastructure inspection',segment:'Infrastructure inspection companies',segments:['Infrastructure inspection companies'],relationship:'Prospect',interests:[],needs:'Fictional demonstration scenario only: Reduce drone downtime and interruptions to scheduled bridge and utility inspections.',useCase:'Fictional use case: routine bridge and utility inspection flights using a small drone fleet.',potentialValue:'Fictional buyer-value hypothesis: Fewer interruptions to scheduled inspections through better maintenance planning. Validate this benefit in a pilot.',clearance:'Not assessed — fictional scenario',accountOwner:'Janice',leadSource:'Networking',qualificationStatus:'Interested',budgetStatus:'Not identified',decisionMakerContacted:'No',purchaseTimeline:'',interestLevel:''},
  contacts:[{name:'Demo Contact CLASS-01',role:'Fictional inspection operations manager',buyerRole:'Technical evaluator',email:'demo-class-01@example.invalid',phone:'',stage:'Marketing qualified',score:35}],
  opportunities:[{name:opportunityName,stage:'Contacted',value:18000,probability:.25,award:null,owner:'Brandon',nextAction:'Ask which monitoring information would help plan inspection fleet maintenance.',followupDate:null}],
  followups:[],
  communication:{type:'Call',date:today,summary:'Fictional classroom discovery call: the operations manager described inspection delays caused by drone downtime. Monitoring interest has not yet been recorded.'},
  note:{author:'Demo scenario pack',text:'FICTIONAL DEMONSTRATION DATA for Brandon and Josh. This organization, contact and opportunity are invented. Practice recording buyer interest, scheduling a demo and planning a follow-up. No real buyer, customer relationship, procurement or contract is represented.'}
 };
}
module.exports={classroomScenario};
