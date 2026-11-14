const test=require('node:test');const assert=require('node:assert/strict');const model=require('./customer-model.js');
function fixture(){return {organizations:[{id:1,name:'Fictional Priority',relationship:'Prospect',qualificationStatus:'High Priority',budgetStatus:'Identified',purchaseTimeline:'Within 3 months'},{id:2,name:'Fictional Qualified',relationship:'Prospect',qualificationStatus:'Qualified',budgetStatus:'Not identified',purchaseTimeline:''},{id:3,name:'Fictional Customer',relationship:'Customer',qualificationStatus:'',budgetStatus:'',purchaseTimeline:''}],leads:[],engagements:[],notes:[],followups:[],opportunities:[
 {id:1,organizationId:1,stage:'Proposal submitted',value:10000,probability:.5,award:'2026-11-20'},
 {id:2,organizationId:1,stage:'Qualification',value:null,probability:.7,award:'2026-12-10'},
 {id:3,organizationId:2,stage:'Evaluation',value:20000,probability:null,award:'2027-01-15'},
 {id:4,organizationId:3,stage:'Awarded',value:5000,awardedValue:4500,probability:1,award:'2026-11-20'},
 {id:5,organizationId:3,stage:'Delivery',value:3000,awardedValue:3000,probability:1,award:'2026-11-20'},
 {id:6,organizationId:2,stage:'Lost',value:9000,probability:0,award:'2026-11-20'},
 {id:7,organizationId:2,stage:'Cancelled',value:8000,probability:0,award:'2026-11-20'},
 {id:8,organizationId:1,stage:'Negotiation',value:4000,probability:.5,award:'2026-11-01'},
 {id:9,organizationId:1,stage:'Research',value:6000,probability:.25,award:null},
 {id:10,organizationId:2,stage:'Qualification',value:7000,probability:.5,award:'2027-12-01'},
 {id:11,organizationId:2,stage:'Qualification',value:0,probability:0,award:'2027-02-01'},
 {id:12,organizationId:2,stage:'Qualification',value:1000,probability:0,award:'2027-03-01'}
]};}
test('potential and awarded totals remain separate with unknown inputs explicitly counted',()=>{
 const result=model.summary(fixture());assert.equal(result.active,8);assert.equal(result.pipeline,48000);assert.equal(result.weighted,12000);assert.equal(result.unknownValues,1);assert.equal(result.unknownProbabilities,1);assert.equal(result.weightedCount,6);assert.equal(result.awarded,7500);assert.equal(result.awardedCount,2);assert.equal(result.unknownAwards,0);
});
test('monthly and quarterly forecasts honor close dates, year boundaries and explicit horizons',()=>{
 const result=model.forecast(fixture(),'2026-11-13');assert.equal(result.monthly.length,12);assert.equal(result.quarterly.length,4);assert.equal(result.monthly[0].key,'2026-11');assert.equal(result.monthly.at(-1).key,'2027-10');assert.equal(result.quarterly[0].key,'2026-Q4');assert.equal(result.quarterly.at(-1).key,'2027-Q3');
 assert.equal(result.monthly[0].value,10000);assert.equal(result.monthly[0].weighted,5000);assert.equal(result.monthly[1].value,null);assert.equal(result.monthly[1].unknownValues,1);assert.equal(result.monthly[2].value,20000);assert.equal(result.monthly[2].weighted,null);assert.equal(result.monthly[3].value,0);assert.equal(result.monthly[3].weighted,0);
 assert.equal(result.quarterly[0].value,10000);assert.equal(result.quarterly[0].weighted,5000);assert.equal(result.quarterly[1].value,21000);assert.equal(result.quarterly[1].weighted,0);assert.equal(result.quarterly[1].unweighted,1);
 assert.equal(result.overdue,1);assert.equal(result.undated,1);assert.equal(result.beyondMonthly,1);assert.equal(result.beyondQuarterly,1);assert.equal(result.closingSoon[0].id,8);assert.ok(result.closingSoon.every(model.open));
});
test('unknown, zero, empty and partial amounts have distinct meanings',()=>{
 assert.equal(model.total([{value:null}]),null);assert.equal(model.total([]),0);assert.equal(model.total([{value:0},{value:null}]),0);assert.equal(model.weighted([{value:100,probability:null}]),null);assert.equal(model.weighted([{value:100,probability:0}]),0);
 const empty=fixture();empty.opportunities=[];const summary=model.summary(empty);assert.equal(summary.pipeline,0);assert.equal(summary.awarded,0);assert.equal(summary.weighted,0);assert.ok(model.forecast(empty,'2026-11-13').monthly.every(b=>b.value===0&&b.weighted===0));
 const unknown=fixture();unknown.opportunities=[{stage:'Qualification',value:null,probability:null},{stage:'Awarded',awardedValue:null}];const result=model.summary(unknown);assert.equal(result.pipeline,null);assert.equal(result.weighted,null);assert.equal(result.awarded,null);assert.equal(result.unknownAwards,1);
});
test('qualification summary distinguishes prospects, contacts, explicit no-budget and missing information',()=>{
 const data=fixture(),result=model.qualification(data);assert.deepEqual(result.highPriority.map(o=>o.id),[1]);assert.deepEqual(result.missingBudget.map(o=>o.id),[3]);assert.deepEqual(result.missingTimeline.map(o=>o.id),[2,3]);assert.equal(result.statuses.find(s=>s.status==='Not assessed').count,1);assert.equal(result.statuses.find(s=>s.status==='Qualified').count,1);
 data.organizations[2].qualificationStatus='High Priority';assert.deepEqual(model.qualification(data).highPriority.map(o=>o.id),[1]);
});
test('closing today is forecasted and closed deals never enter forecast charts',()=>{
 const data=fixture();data.opportunities.push({id:99,organizationId:1,stage:'Evaluation',value:100,probability:1,award:'2026-11-13'});const result=model.forecast(data,'2026-11-13');assert.equal(result.monthly[0].value,10100);assert.equal(result.overdue,1);assert.equal(result.quarterly[0].count,3);
});
