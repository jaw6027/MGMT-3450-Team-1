// Customer forms write through the local API; SQLite is never accessed by the browser.
const CustomerEditor=(()=>{
  let dialog,context,busy=false;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options=(values,current)=>values.map(value=>`<option ${value===current?'selected':''}>${escape(value)}</option>`).join('');
  const input=(name,label,value='',extra='')=>`<label>${label}<input name="${name}" value="${escape(value)}" ${extra}></label>`;
  const select=(name,label,values,value)=>`<label>${label}<select name="${name}">${options(values,value)}</select></label>`;
  function contact(row={}){
    return `<fieldset data-edit-contact data-id="${row.id||''}" data-score="${row.score||0}"><legend>${row.id?'Contact':'New contact'}</legend><div class="customer-form-grid">${input('contact-name','Contact name *',row.name,'required maxlength="150" autocomplete="name"')}${input('contact-role','Role / job title',row.role,'maxlength="150"')}${input('contact-email','Email address',row.email,'type="email" maxlength="254" autocomplete="email"')}${input('contact-phone','Phone number',row.phone,'type="tel" maxlength="60" autocomplete="tel"')}${select('contact-stage','Lead qualification',context.data.meta.choices.leadStages,row.stage||'New')}</div>${row.id?'':'<button type="button" class="quiet" data-remove-draft>Remove new contact</button>'}</fieldset>`;
  }
  function opportunity(row={}){
    return `<fieldset data-edit-opportunity data-id="${row.id||''}"><legend>${row.id?'Opportunity':'New opportunity'}</legend><div class="customer-form-grid">${input('opportunity-name','Opportunity name *',row.name,'required maxlength="200"')}${select('opportunity-stage','Sales pipeline stage',context.data.meta.choices.opportunityStages,row.stage||'Qualification')}${input('opportunity-value','Potential contract value (whole USD) *',row.value??0,'required type="number" min="0" max="1000000000000" step="1"')}${input('opportunity-probability','Estimated win probability (%) *',row.probability===undefined?50:Number((row.probability*100).toFixed(4)),'required type="number" min="0" max="100" step="any"')}${input('opportunity-award','Expected decision date',row.award,'type="date"')}${input('opportunity-owner','Opportunity owner',row.owner,'maxlength="150"')}</div>${row.id?'':'<button type="button" class="quiet" data-remove-draft>Remove new opportunity</button>'}</fieldset>`;
  }
  function followup(row={}){
    return `<fieldset data-edit-followup data-id="${row.id||''}"><legend>${row.id?'Follow-up':'New follow-up'}</legend><div class="customer-form-grid">${input('followup-date','Follow-up date *',row.dueDate,'required type="date"')}${input('followup-action','Next action *',row.action,'required maxlength="1000"')}${input('followup-owner','Assigned to *',row.owner,'required maxlength="150"')}<label class="customer-check"><input name="followup-completed" type="checkbox" ${row.completed?'checked':''}>Completed</label></div>${row.id?'':'<button type="button" class="quiet" data-remove-draft>Remove new follow-up</button>'}</fieldset>`;
  }
  function collect(form){
    const value=(root,name)=>root.querySelector(`[name="${name}"]`).value;
    const fields=['name','customerType','relationship','sector','industry','segment','needs'];
    const existing=context.data.organizations.find(o=>o.id===context.id);
    const company=Object.fromEntries(fields.map(name=>[name,value(form,name)]));
    company.clearance=existing?.clearance||'None specified';company.interests=[...form.querySelectorAll('[name="interest"]:checked')].map(i=>i.value);
    const rowId=row=>row.dataset.id?Number(row.dataset.id):null;
    const contacts=[...form.querySelectorAll('[data-edit-contact]')].map(row=>({id:rowId(row),name:value(row,'contact-name'),role:value(row,'contact-role'),email:value(row,'contact-email'),phone:value(row,'contact-phone'),stage:value(row,'contact-stage'),score:Number(row.dataset.score)}));
    const opportunities=[...form.querySelectorAll('[data-edit-opportunity]')].map(row=>({id:rowId(row),name:value(row,'opportunity-name'),stage:value(row,'opportunity-stage'),value:Number(value(row,'opportunity-value')),probability:Number(value(row,'opportunity-probability'))/100,award:value(row,'opportunity-award'),owner:value(row,'opportunity-owner')}));
    const followups=[...form.querySelectorAll('[data-edit-followup]')].map(row=>({id:rowId(row),dueDate:value(row,'followup-date'),action:value(row,'followup-action'),owner:value(row,'followup-owner'),completed:row.querySelector('[name="followup-completed"]').checked}));
    const payload={revision:context.data.meta.revision,company,contacts,opportunities,followups};
    const note=value(form,'note-text').trim();if(note)payload.note={text:note,author:value(form,'note-author')};
    const summary=value(form,'communication-summary').trim();if(summary)payload.communication={summary,type:value(form,'communication-type'),date:value(form,'communication-date')};
    return payload;
  }
  function close(){if(busy)return;dialog.close();context.cancel?.();}
  function init(){
    dialog=document.getElementById('customer-editor');
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{
      if(event.target.closest('[data-editor-cancel]')){close();return;}
      if(event.target.closest('[data-remove-draft]')){event.target.closest('fieldset').remove();return;}
      for(const [attribute,container,render] of [['data-add-contact','contact-fields',contact],['data-add-opportunity','opportunity-fields',opportunity],['data-add-followup','followup-fields',followup]]){
        if(event.target.closest(`[${attribute}]`)){const target=dialog.querySelector('#'+container);target.insertAdjacentHTML('beforeend',render());target.lastElementChild.querySelector('input,select').focus();return;}
      }
    });
    dialog.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      const form=event.target,error=dialog.querySelector('#customer-form-error');error.textContent='';
      const payload=collect(form);
      if(payload.note&&!payload.note.author.trim()){error.textContent='Enter an author for the new note.';error.focus();return;}
      if(payload.communication&&!payload.communication.date){error.textContent='Choose a date for the communication.';error.focus();return;}
      busy=true;form.setAttribute('aria-busy','true');form.querySelectorAll('button').forEach(b=>b.disabled=true);
      const save=form.querySelector('[type="submit"]');save.textContent='Saving…';
      try{
        const response=await fetch('/api/customers'+(context.id?'/'+context.id:''),{method:context.id?'PUT':'POST',headers:{'Content-Type':'application/json','X-Customer-Write':'1'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Customer could not be saved.');
        busy=false;dialog.close();context.saved(result,context.id?'Customer updated.':'Customer added.');
      }catch(e){error.textContent=e.name==='TypeError'||e.name==='TimeoutError'?'Connection lost while saving. Your form is retained. Refresh the dashboard to check whether the change was saved before retrying.':e.message;error.focus();}
      finally{busy=false;form.removeAttribute('aria-busy');form.querySelectorAll('button').forEach(b=>b.disabled=false);save.textContent='Save customer';}
    });
  }
  function open(settings){
    context=settings;const {data,id}=context,company=data.organizations.find(o=>o.id===id)||{customerType:'Civilian',relationship:'Prospect',sector:'Civilian Commercial',segment:'Civilian drone operators',interests:[]};
    const choices=data.meta.choices,linked=table=>data[table].filter(row=>row.organizationId===id);
    dialog.innerHTML=`<form id="customer-form"><div class="customer-editor-heading"><div><p class="eyebrow">CUSTOMER WORKSPACE / SAMPLE DATA</p><h2 id="customer-editor-title">${id?'Edit customer':'Add customer or company'}</h2></div><button type="button" data-editor-cancel class="quiet" aria-label="Close customer form">✕</button></div><p class="customer-form-help">Fields marked * are required. Contacts, opportunities, notes and follow-ups are optional. Changes save to the existing local database.</p><div id="customer-form-error" class="customer-form-error" role="alert" tabindex="-1"></div><fieldset><legend>Company information</legend><div class="customer-form-grid">${input('name','Company name *',company.name,'required maxlength="200" autocomplete="organization"')}${select('relationship','Relationship',choices.relationships,company.relationship)}${select('customerType','Customer type',choices.customerTypes,company.customerType)}${select('sector','Target market sector',choices.sectors,company.sector)}${input('industry','Industry *',company.industry,'required maxlength="100" list="customer-industries"')}${input('segment','Customer segment *',company.segment,'required maxlength="150" list="customer-segments"')}</div><datalist id="customer-industries">${[...new Set(data.organizations.map(o=>o.industry))].map(i=>`<option value="${escape(i)}">`).join('')}</datalist><datalist id="customer-segments">${choices.segments.map(s=>`<option value="${escape(s)}">`).join('')}</datalist><p class="customer-form-help">Private defense contractors are civilian companies, even when their target market is military.</p><div class="customer-interest-options">${choices.interests.map(i=>`<label class="customer-check"><input name="interest" type="checkbox" value="${escape(i)}" ${company.interests.includes(i)?'checked':''}>${escape(i)}</label>`).join('')}</div><label>Customer needs<textarea name="needs" rows="3" maxlength="5000">${escape(company.needs)}</textarea></label></fieldset><section aria-labelledby="contact-editor-title"><div class="customer-section-heading"><h3 id="contact-editor-title">Contacts</h3><button type="button" class="secondary-action" data-add-contact>+ Add contact</button></div><div id="contact-fields">${linked('leads').map(contact).join('')}</div></section><section aria-labelledby="opportunity-editor-title"><div class="customer-section-heading"><h3 id="opportunity-editor-title">Sales opportunities</h3><button type="button" class="secondary-action" data-add-opportunity>+ Add opportunity</button></div><p class="customer-form-help">Update each deal independently. Awarded, delivery, lost and cancelled deals are excluded from potential revenue.</p><div id="opportunity-fields">${linked('opportunities').map(opportunity).join('')}</div></section><section aria-labelledby="followup-editor-title"><div class="customer-section-heading"><h3 id="followup-editor-title">Follow-ups</h3><button type="button" class="secondary-action" data-add-followup>+ Add follow-up</button></div><div id="followup-fields">${linked('followups').map(followup).join('')}</div></section><fieldset><legend>Add a relationship note</legend><label>New note<textarea name="note-text" rows="3" maxlength="10000"></textarea></label>${input('note-author','Note author (required when adding a note)','','maxlength="150"')}<p class="customer-form-help">Existing notes remain in the customer history.</p></fieldset><fieldset><legend>Log a communication</legend><div class="customer-form-grid">${select('communication-type','Communication type',choices.communicationTypes,'Call')}${input('communication-date','Contact date',new Date().toISOString().slice(0,10),'type="date"')}</div><label>Communication summary<textarea name="communication-summary" rows="2" maxlength="5000"></textarea></label><p class="customer-form-help">Optional. Recording communication updates the last-contact date.</p></fieldset><div class="customer-form-actions"><button type="button" class="secondary-action" data-editor-cancel>Cancel</button><button type="submit" class="primary">Save customer</button></div></form>`;
    dialog.showModal();dialog.scrollTop=0;dialog.querySelector('[name="name"]').focus();
  }
  return {init,open};
})();
