// Local sales inbox. Website requests remain separate from assessed CRM prospects.
const WebsiteInquiries = (() => {
  'use strict';
  let inquiries = [], state = 'idle', query = '', buyerType = 'all', notify = () => {};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const buyerLabel = type => type === 'military' ? 'Government & military' : 'Direct sales';
  function timestamp(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', {dateStyle:'medium',timeStyle:'short'}) : 'Date unavailable';
  }
  function changed(focus) {
    const input = focus ? document.getElementById('inquiry-search') : null;
    const selection = input ? [input.selectionStart, input.selectionEnd] : null;
    notify();
    if (selection) {
      const next = document.getElementById('inquiry-search');
      if (next) { next.focus({preventScroll:true}); next.setSelectionRange(...selection); }
    }
  }
  async function load(force = false) {
    if (state === 'loading' || (!force && state !== 'idle')) return;
    state = 'loading'; changed();
    try {
      const response = await fetch('/api/inquiries', {headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Inbox unavailable');
      const data = await response.json();
      if (!data || !Array.isArray(data.inquiries)) throw new Error('Invalid inbox response');
      inquiries = data.inquiries; state = 'ready';
    } catch { state = 'error'; }
    changed();
  }
  function render() {
    const controls = `<section class="panel inquiry-inbox" aria-labelledby="inquiry-inbox-title"><div class="panel-header"><div><h2 id="inquiry-inbox-title">Website inquiry inbox</h2><p>Requests received through the company website. Review each request before adding a qualified prospect to the customer directory.</p></div><button type="button" class="secondary-action" data-inquiry-refresh ${state === 'loading' ? 'disabled' : ''}>${state === 'loading' ? 'Refreshing…' : 'Refresh requests'}</button></div><div class="inquiry-filters"><label for="inquiry-search">Search requests<input id="inquiry-search" type="search" placeholder="Organization, contact, email, or project…" value="${escape(query)}" autocomplete="off"></label><label for="inquiry-buyer">Buyer path<select id="inquiry-buyer"><option value="all" ${buyerType === 'all' ? 'selected' : ''}>All buyers</option><option value="direct" ${buyerType === 'direct' ? 'selected' : ''}>Direct sales</option><option value="military" ${buyerType === 'military' ? 'selected' : ''}>Government &amp; military</option></select></label><button type="button" class="quiet" data-inquiry-reset>Clear filters</button></div>`;
    if (state === 'loading' || state === 'idle') return controls + '<p class="inquiry-notice" role="status">Loading website requests…</p></section>';
    if (state === 'error') return controls + '<div class="inquiry-notice inquiry-error" role="alert"><h3>Website requests are unavailable</h3><p>Start the local Node server or check the connection, then select Refresh requests. No request count is available.</p></div></section>';
    const words = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
    const matches = inquiries.filter(item => {
      const text = [item.organization,item.name,item.email,item.message,item.useCase,item.reference,item.timeline,buyerLabel(item.buyerType)].join(' ').toLocaleLowerCase();
      return (buyerType === 'all' || item.buyerType === buyerType) && words.every(word => text.includes(word));
    });
    const count = `<p class="inquiry-count" role="status">${matches.length} of ${inquiries.length} website ${inquiries.length === 1 ? 'request' : 'requests'} · Newest first</p>`;
    if (!matches.length) return controls + count + `<div class="inquiry-notice"><h3>${inquiries.length ? 'No requests match these filters' : 'No website requests yet'}</h3><p>${inquiries.length ? 'Try another search or clear the filters.' : 'Direct sales and government inquiries will appear here after someone submits the website request form.'}</p>${inquiries.length ? '<button type="button" class="secondary-action" data-inquiry-reset>Clear filters</button>' : '<a href="index.html#contact">Open the website request form ↗</a>'}</div></section>`;
    return controls + count + `<div class="inquiry-list">${matches.map(item => `<article class="inquiry-card"><div class="inquiry-card-heading"><div><span class="inquiry-reference">${escape(item.reference)}</span><h3>${escape(item.organization)}</h3></div><span class="badge ${item.buyerType === 'military' ? 'amber' : 'green'}">${buyerLabel(item.buyerType)}</span></div><p class="inquiry-contact"><strong>${escape(item.name)}</strong> · <a href="mailto:${escape(encodeURIComponent(String(item.email ?? '')))}">${escape(item.email)}</a></p><dl class="inquiry-summary"><div><dt>Project</dt><dd>${escape(item.useCase)}</dd></div><div><dt>Timeline</dt><dd>${escape(item.timeline)}</dd></div><div><dt>Received</dt><dd><time datetime="${escape(item.createdAt)}">${escape(timestamp(item.createdAt))}</time></dd></div></dl><details><summary>View project overview</summary><p class="inquiry-message">${escape(item.message || 'No additional project overview was provided.')}</p></details></article>`).join('')}</div></section>`;
  }
  return {
    init(callback) { notify = callback; },
    ensureLoaded: () => load(),
    render,
    input(event) {
      if (event.target.id !== 'inquiry-search') return false;
      query = event.target.value; changed(true); return true;
    },
    change(event) {
      if (event.target.id !== 'inquiry-buyer') return false;
      buyerType = event.target.value; changed();
      document.getElementById('inquiry-buyer')?.focus({preventScroll:true});
      return true;
    },
    click(event) {
      if (event.target.closest('[data-inquiry-refresh]')) { load(true); return true; }
      if (!event.target.closest('[data-inquiry-reset]')) return false;
      query = ''; buyerType = 'all'; changed();
      document.getElementById('inquiry-search')?.focus({preventScroll:true});
      return true;
    }
  };
})();
