/* Entirely fictional demonstration records. No real contacts or procurements. */
const FlightpathData = {
  organizations: [
    {id:1,name:'Falcon Air Systems Office',sector:'Air Force',clearance:'Requirement to be confirmed'},
    {id:2,name:'Bluewater Maritime Lab',sector:'Navy',clearance:'Requirement to be confirmed'},
    {id:3,name:'Meridian Infrastructure',sector:'Civilian Commercial',clearance:'None specified'},
    {id:4,name:'Horizon Flight Research',sector:'Air Force',clearance:'Requirement to be confirmed'},
    {id:5,name:'Northstar Energy',sector:'Civilian Commercial',clearance:'None specified'},
    {id:6,name:'Coastal Innovation Office',sector:'Navy',clearance:'Requirement to be confirmed'}
  ],
  opportunities: [
    {id:1,organizationId:1,name:'Fleet inspection pilot',stage:'Proposal submitted',value:840000,probability:.6,award:'2027-02-15',owner:'Alex Morgan'},
    {id:2,organizationId:2,name:'Maritime structure assessment',stage:'Evaluation',value:1250000,probability:.7,award:'2027-03-20',owner:'Jordan Lee'},
    {id:3,organizationId:3,name:'Bridge monitoring program',stage:'Negotiation',value:420000,probability:.85,award:'2026-12-18',owner:'Taylor Chen'},
    {id:4,organizationId:4,name:'Airframe telemetry study',stage:'Qualification',value:650000,probability:.25,award:'2027-06-10',owner:'Alex Morgan'},
    {id:5,organizationId:5,name:'Wind asset inspection',stage:'Proposal submitted',value:280000,probability:.55,award:'2027-01-22',owner:'Taylor Chen'},
    {id:6,organizationId:6,name:'Port infrastructure trial',stage:'RFI / market research',value:960000,probability:.2,award:'2027-08-12',owner:'Jordan Lee'},
    {id:7,organizationId:3,name:'Sensor validation workshop',stage:'Awarded',value:60000,probability:1,award:'2026-10-28',owner:'Taylor Chen'},
    {id:8,organizationId:5,name:'Initial site survey',stage:'Lost',value:90000,probability:0,award:'2026-10-12',owner:'Taylor Chen'}
  ],
  leads: [
    {id:1,organizationId:1,name:'Casey Brooks',role:'Program manager',stage:'Sales qualified',score:86},
    {id:2,organizationId:2,name:'Avery Patel',role:'Technical evaluator',stage:'Sales qualified',score:91},
    {id:3,organizationId:3,name:'Riley Torres',role:'Director of asset management',stage:'Sales qualified',score:94},
    {id:4,organizationId:4,name:'Morgan Ellis',role:'Research lead',stage:'Marketing qualified',score:64},
    {id:5,organizationId:5,name:'Jamie Park',role:'Operations manager',stage:'Sales qualified',score:78},
    {id:6,organizationId:6,name:'Drew Bennett',role:'Procurement analyst',stage:'Nurture',score:48},
    {id:7,organizationId:1,name:'Sam Rivera',role:'Technical evaluator',stage:'Marketing qualified',score:70},
    {id:8,organizationId:3,name:'Quinn Davis',role:'Procurement manager',stage:'New',score:35}
  ],
  campaigns: [
    {id:1,name:'Mission-ready telemetry',channel:'Webinar',status:'Active',sectors:['Air Force','Navy'],budget:12000,leadIds:[1,2,4,6,7]},
    {id:2,name:'Infrastructure, in focus',channel:'Industry event',status:'Active',sectors:['Civilian Commercial'],budget:8500,leadIds:[3,5,8]},
    {id:3,name:'A new perspective on SHM',channel:'Email',status:'Completed',sectors:['Air Force','Navy','Civilian Commercial'],budget:3500,leadIds:[1,3,5,7]},
    {id:4,name:'Coastal innovation briefing',channel:'Roundtable',status:'Scheduled',sectors:['Navy'],budget:6000,leadIds:[2,6]}
  ],
  engagements: [
    {id:1,organizationId:3,leadId:3,type:'Meeting',summary:'Reviewed pilot scope and deployment timeline',date:'2026-11-12'},
    {id:2,organizationId:1,leadId:1,type:'Proposal',summary:'Submitted fleet inspection pilot proposal',date:'2026-11-11'},
    {id:3,organizationId:2,leadId:2,type:'Demo',summary:'Completed structural telemetry demonstration',date:'2026-11-10'},
    {id:4,organizationId:5,leadId:5,type:'Call',summary:'Discussed sensor placement and reporting needs',date:'2026-11-09'},
    {id:5,organizationId:6,leadId:6,type:'RFI response',summary:'Shared technical capability overview',date:'2026-11-08'}
  ]
};
if (typeof module !== 'undefined') module.exports = FlightpathData;
