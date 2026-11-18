// Fictional classroom hypotheses, never claims about a real buyer or proven benefit.
const scenarios={
  'U.S. Air Force':['Training and evaluation flights with unmanned aircraft.','Explore whether airframe condition trends could help plan maintenance between training flights.'],
  'U.S. Navy':['Maritime drone evaluation and port inspection flights.','Explore whether structural and environmental measurements could inform maintenance planning between maritime missions.'],
  'Defense contractors':['Integrating monitoring sensors into a proposed drone platform.','Evaluate whether structural condition evidence could support integration reviews and customer maintenance discussions.'],
  'Commercial drone manufacturers':['Designing and supporting commercial drone airframes.','Better maintenance data for its customers, subject to compatibility testing and validation.'],
  'Agricultural drone companies':['Repeated crop-spraying and mapping flights with changing payloads.','Explore whether payload-cycle measurements could help schedule maintenance around agricultural work.'],
  'Infrastructure inspection companies':['Scheduled bridge, utility and infrastructure inspections using drones.','Fewer interruptions to scheduled inspections by using condition trends to inform maintenance planning; a benefit to validate in a pilot.'],
  'Civilian drone operators':['Operating a mixed civilian mapping and inspection fleet.','Explore whether comparable condition measurements could make fleet maintenance decisions easier.']
};
function buyerContext(segment){const [useCase,potentialValue]=scenarios[segment]||['',''];return {useCase:useCase?'Fictional use case: '+useCase:'',potentialValue:potentialValue?'Fictional buyer-value hypothesis: '+potentialValue:''};}
module.exports={buyerContext};
