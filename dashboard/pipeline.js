const SalesPipeline=(()=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>value===null||value===undefined?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
  let busy=false;
  function stageCounts(rows){return `<div class="pipeline-stages" aria-label="Opportunity counts by sales stage">${PipelineModel.counts(rows).map(s=>`<article class="panel pipeline-stage"><h2>${s.stage}</h2><strong data-stage-count="${s.stage}">${s.count}</strong><span>${s.count===1?'opportunity':'opportunities'}</span></article>`).join('')}</div>`;}
  function render(data,filters,ready){
    if(!ready)return '<section class="panel customer-message" role="status">Customer database unavailable or loading. Open Customers to refresh the connection.</section>';
    const rows=PipelineModel.select(data,filters),overdue=rows.filter(p=>PipelineModel.overdue(p)).length;
    return `${stageCounts(rows)}<section class="panel"><div class="panel-header"><div><h2>Sales opportunities</h2><p role="status">${rows.length} opportunities · ${rows.filter(PipelineModel.open).length} open · ${overdue} overdue follow-ups</p><p>Follow-up dates use UTC. Select an opportunity to update its record.</p></div><button class="quiet" data-customer-refresh>Refresh records</button></div><p class="pipeline-help">Existing procurement stages are grouped into these seven stages; their saved values remain until edited. Follow-ups below belong to individual opportunities.</p>${rows.length?`<div class="table-wrap"><table class="pipeline-table"><caption class="sr-only">Sales pipeline opportunities</caption><thead><tr>${['Opportunity / organization','Market segment','Assigned team member','Stage','Next action','Follow-up date'].map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${rows.map(p=>{
      const o=data.organizations.find(o=>o.id===p.organizationId);
      return `<tr><td><button class="link-button" data-pipeline-record="${p.id}">${esc(p.name)}</button><small>${esc(o.name)}</small><small>Buyer interests: ${esc(o.interests.join(', ')||'Not recorded')}</small></td><td>${esc((o.segments||[o.segment]).join(' · '))}</td><td>${esc(p.owner||'Unassigned')}</td><td><span class="badge ${PipelineModel.open(p)?'':'gray'}">${esc(PipelineModel.stage(p))}</span>${p.stage!==PipelineModel.stage(p)?`<small>Recorded: ${esc(p.stage)}</small>`:''}</td><td>${esc(p.nextAction||'Not recorded')}</td><td>${esc(p.followupDate||'Not scheduled')}${PipelineModel.overdue(p)?'<strong class="pipeline-overdue">Overdue follow-up</strong>':''}</td></tr>`;
    }).join('')}</tbody></table></div>`:'<div class="empty">No opportunities match. Clear search and filters to see all deals.</div>'}</section>`;
  }
  function open(id){
    const data=CustomerDashboard.getData(),p=data?.opportunities.find(p=>p.id===id);
    if(!p)return;
    const o=data.organizations.find(o=>o.id===p.organizationId),dialog=document.getElementById('detail');
    // Replace a customer profile dialog with the selected deal's editable record.
    dialog.classList.add('customer-dialog');dialog.setAttribute('aria-labelledby','pipeline-record-title');
    document.getElementById('detail-content').innerHTML=`<h2 id="pipeline-record-title">${esc(p.name)}</h2><p class="subtitle">${esc(o.name)} · ${esc((o.segments||[o.segment]).join(' · '))}</p>${p.stage!==PipelineModel.stage(p)?`<p>Previously recorded procurement stage: ${esc(p.stage)}</p>`:''}<dl>${[['Potential contract value',money(p.value)],['Awarded contract value',money(p.awardedValue)],['Win probability',p.probability===null||p.probability===undefined?'Unknown':Math.round(p.probability*100)+'%'],['Expected closing',p.award||'Not scheduled'],['Clearance requirements',o.clearance||'Not recorded']].map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><form id="pipeline-record-form"><div class="customer-form-grid"><label>Sales stage<select name="stage">${PipelineModel.stages.map(s=>`<option ${s===PipelineModel.stage(p)?'selected':''}>${s}</option>`).join('')}</select></label><label>Assigned team member<input name="owner" maxlength="150" value="${esc(p.owner)}" list="pipeline-team"></label><datalist id="pipeline-team">${data.meta.choices.accountOwners.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist><label>Next action<input name="nextAction" maxlength="1000" value="${esc(p.nextAction)}"></label><label>Follow-up date<input type="date" name="followupDate" value="${esc(p.followupDate)}"></label></div><label>Won / lost reason<textarea name="outcomeReason" maxlength="2000" rows="2">${esc(p.outcomeReason)}</textarea></label><p class="customer-form-help">A reason is required when newly closing a deal. Closing it removes it from open pipeline counts and overdue flags. Contract values and win probabilities stay as recorded.</p><p id="pipeline-save-status" role="status" aria-live="polite"></p><div class="customer-form-actions"><button type="submit" class="primary">Save opportunity</button></div></form>`;
    const form=document.getElementById('pipeline-record-form');
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      const fields=Object.fromEntries(new FormData(form)),status=document.getElementById('pipeline-save-status');
      if(['Closed Won','Closed Lost'].includes(fields.stage)&&p.stage!==fields.stage&&!fields.outcomeReason.trim()){status.textContent='Record a reason for closing this opportunity.';return;}
      busy=true;form.querySelector('button').disabled=true;status.textContent='Saving opportunity…';
      try{
        const response=await fetch('/api/customers/'+o.id,{method:'PUT',headers:{'Content-Type':'application/json','X-Customer-Write':'1'},body:JSON.stringify({revision:data.meta.revision,company:o,opportunities:[{...p,...fields}]})});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to save opportunity.');
        CustomerDashboard.acceptSaved(result,'Opportunity saved.');
        status.textContent='Opportunity saved. Dashboard counts updated.';
        // Keep the saved record visible and use the new revision on the next edit.
        open(id);document.getElementById('pipeline-save-status').textContent='Opportunity saved. Dashboard counts updated.';
      }catch(error){status.textContent=error.message+' Your form is preserved. Close and refresh records before retrying a conflict.';}
      finally{busy=false;form.querySelector('button').disabled=false;}
    });
    if(!dialog.open)dialog.showModal();
  }
  function init(){
    document.getElementById('detail').addEventListener('click',event=>{const button=event.target.closest('[data-pipeline-record]');if(button)open(Number(button.dataset.pipelineRecord));});
    document.getElementById('detail').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    document.getElementById('close-detail').addEventListener('click',event=>{if(busy){event.stopImmediatePropagation();event.preventDefault();}},true);
  }
  return {render,open,init,stageCounts};
})();
