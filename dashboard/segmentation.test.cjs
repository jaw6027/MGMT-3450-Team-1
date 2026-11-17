const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./segment-strategy-model.js');
const prospects=[
  {key:'a',name:'Alpha',segments:['Defense','Commercial'],state:'CA',marketUse:'Both',qualification:'Qualified'},
  {key:'b',name:'Beta',segments:['Defense'],state:'TX',marketUse:'Military/defense',qualification:'Not assessed'},
  {key:'c',name:'Gamma',segments:['Commercial'],state:'',marketUse:'Not yet verified',qualification:'Qualified'},
  {key:'d',name:'Delta',segments:['Commercial'],state:'CA',marketUse:'Non-military',qualification:'Qualified'}
];
function review(key,compatibility='Compatible',rating=4,reviewer='Brandon'){
  return {prospect:{key},reviewer,compatibility,criteria:Object.fromEntries(M.criteria.map(c=>[c.key,{rating,evidence:'Test evidence',kind:'Public source'}]))};
}
test('segmentation counts unique prospects and multi-segment membership, preserving unknown locations',()=>{
  const result=M.segmentation(prospects,[],{reviewer:'Brandon'});
  assert.equal(result.rows.length,4);
  assert.deepEqual(result.groups.map(g=>[g.key,g.count,g.unassessed]),[['Commercial',3,3],['Defense',2,2]]);
  const states=M.segmentation(prospects,[],{groupBy:'state',group:'Unknown location'});
  assert.deepEqual(states.rows.map(r=>r.prospect.key),['c']);
  assert.equal(states.groups.find(g=>g.key==='CA').count,2);
});
test('readiness requires evidence and compatibility; either reviewer can block high scoring prospects',()=>{
  const reviews=[review('a'),review('b','Unknown',5),review('c'),review('c','Incompatible',1,'Josh')];
  const result=M.segmentation(prospects,reviews,{reviewer:'Brandon'});
  assert.deepEqual(result.rows.map(r=>[r.prospect.key,r.status,r.value]),[['a','Ready to compare',4],['b','Needs research',null],['d','Unassessed',null],['c','Blocked',null]]);
  const filtered=M.segmentation(prospects,reviews,{reviewer:'Brandon',minimum:4,qualification:'Qualified',group:'Commercial'});
  assert.deepEqual(filtered.rows.map(r=>r.prospect.key),['a']);
  assert.equal(M.segmentation(prospects,reviews,{reviewer:'Josh',minimum:3}).rows.length,0);
  reviews[0].criteria.fit.evidence='';
  assert.equal(M.outreach(prospects[0],reviews,'Brandon').status,'Needs research');
});
test('qualification, readiness, group, weights and empty matches combine without mutating input',()=>{
  const reviews=[review('a'),review('d','Compatible',5)];
  reviews[0].criteria.fit.rating=1;
  assert.equal(M.segmentation(prospects,reviews,{reviewer:'Brandon',weights:[100,0,0,0,0],minimum:3}).rows.length,1);
  const r=M.segmentation(prospects,reviews,{reviewer:'Brandon',qualification:'Qualified',readiness:'Ready to compare',groupBy:'market',group:'Non-military'});
  assert.deepEqual(r.rows.map(r=>r.prospect.key),['d']);
  assert.equal(r.groups.length,2);
  assert.deepEqual(M.segmentation(prospects,reviews,{minimum:5,qualification:'Missing'}),{groups:[],rows:[]});
  assert.equal(prospects[0].segments.length,2);
});

test('do-not-contact records are kept visible but placed after eligible prospects',()=>{
  const rows=M.segmentation([{...prospects[0],outreachStatus:'Do not contact'},prospects[1]],[review('a','Compatible',5)],{reviewer:'Brandon'}).rows;
  assert.equal(rows.at(-1).prospect.key,'a');assert.equal(rows.at(-1).outreachPaused,true);
});

