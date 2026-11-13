const FlightpathModel = (() => {
  const open = opportunity => !['Awarded','Lost','Cancelled'].includes(opportunity.stage);
  function select(data, sector = 'all', query = '') {
    const q = query.trim().toLowerCase();
    const matches = value => String(value).toLowerCase().includes(q);
    const sectorOrgs = data.organizations.filter(o => sector === 'all' || o.sector === sector);
    const sectorIds = new Set(sectorOrgs.map(o => o.id));
    const orgById = new Map(data.organizations.map(o => [o.id,o]));
    const orgMatches = id => matches(orgById.get(id).name);
    const leads = data.leads.filter(l => sectorIds.has(l.organizationId) && (orgMatches(l.organizationId) || matches(l.name) || matches(l.role)));
    const leadOrgIds = new Set(leads.map(l => l.organizationId));
    const opportunities = data.opportunities.filter(p => sectorIds.has(p.organizationId) && (orgMatches(p.organizationId) || matches(p.name) || matches(p.owner) || leadOrgIds.has(p.organizationId)));
    const relevantIds = new Set(opportunities.map(p => p.organizationId));
    const organizations = sectorOrgs.filter(o => matches(o.name) || leadOrgIds.has(o.id) || relevantIds.has(o.id));
    const selectedLeadIds = new Set(leads.map(l => l.id));
    const campaigns = data.campaigns.filter(c => (sector === 'all' || c.sectors.includes(sector)) && (matches(c.name) || c.leadIds.some(id => selectedLeadIds.has(id))));
    const engagements = data.engagements.filter(e => sectorIds.has(e.organizationId) && (orgMatches(e.organizationId) || matches(e.summary) || selectedLeadIds.has(e.leadId)));
    return {organizations,leads,opportunities,campaigns,engagements,orgById};
  }
  function metrics(selection) {
    const pipeline = selection.opportunities.filter(open);
    return {pipeline:pipeline.reduce((sum,p)=>sum+p.value,0),weighted:pipeline.reduce((sum,p)=>sum+p.value*p.probability,0),openCount:pipeline.length,qualified:selection.leads.filter(l=>l.stage==='Sales qualified').length,activeCampaigns:selection.campaigns.filter(c=>c.status==='Active').length};
  }
  function csv(rows) {
    const cell = value => '"' + String(/^[=+@\-\t\r]/.test(String(value)) ? "'"+value : value).replaceAll('"','""') + '"';
    return '\uFEFF' + rows.map(row=>row.map(cell).join(',')).join('\r\n');
  }
  return {open,select,metrics,csv};
})();
if (typeof module !== 'undefined') module.exports = FlightpathModel;
