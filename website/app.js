(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const $ = id => document.getElementById(id);
  const form = $('inquiry-form');
  const menu = $('menu-toggle');
  const nav = $('site-nav');
  const tabs = [...document.querySelectorAll('[data-buyer]')];
  const buyerContent = {
    direct: {
      title: 'A direct line to your next capability.',
      description: 'Tell us what your operation needs. Explore a platform configuration, plan a demonstration, and discuss a quote directly with the team.',
      points: ['Your application and operating environment', 'Platform, payload, and support requirements', 'Demonstration and quote planning']
    },
    military: {
      title: 'Start with the requirement. Plan the evaluation.',
      description: 'For government teams, military buyers, and procurement partners: share your evaluation goals and the purchasing process you need to follow.',
      points: ['General program and integration requirements', 'Evaluation and documentation requests', 'Procurement timeline and next steps']
    }
  };

  function closeMenu() {
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menu.focus();
    }
  });
  window.matchMedia('(min-width: 801px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  function setBuyer(value) {
    if (!Object.hasOwn(buyerContent, value)) return;
    const content = buyerContent[value];
    tabs.forEach(tab => {
      const active = tab.dataset.buyer === value;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $('buyer-panel').setAttribute('aria-labelledby', 'buyer-tab-' + value);
    $('buyer-title').textContent = content.title;
    $('buyer-description').textContent = content.description;
    $('buyer-points').replaceChildren(...content.points.map(text => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }));
    form.elements.namedItem('buyerType').value = value;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setBuyer(tab.dataset.buyer));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      setBuyer(tabs[next].dataset.buyer);
      tabs[next].focus();
    });
  });
  form.elements.namedItem('buyerType').addEventListener('change', event => setBuyer(event.target.value));

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-request], [data-use-case]');
    if (!trigger) return;
    event.preventDefault();
    if (trigger.dataset.request) setBuyer(trigger.dataset.request);
    if (trigger.dataset.useCase) {
      form.elements.namedItem('useCase').value = trigger.dataset.useCase;
      if (trigger.dataset.useCase === 'Government evaluation') setBuyer('military');
    }
    closeMenu();
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    $('contact').scrollIntoView({ behavior, block: 'start' });
    form.elements.namedItem('name').focus({ preventScroll: true });
  });

  const submit = $('inquiry-submit');
  const status = $('inquiry-status');
  const error = $('inquiry-error');
  const fields = ['name', 'email', 'organization', 'buyerType', 'useCase', 'timeline', 'message', 'website'];
  let pending = null;
  let sending = false;
  const readFields = () => Object.fromEntries(fields.map(name => [name, form.elements.namedItem(name).value.trim()]));
  submit.disabled = false;
  setBuyer(form.elements.namedItem('buyerType').value || 'direct');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    error.hidden = true;
    error.textContent = '';
    status.textContent = '';
    if (location.protocol === 'file:') {
      error.textContent = 'Request saving is unavailable when opening this file directly. Open the website through the project server to send an inquiry. Your details are still here.';
      error.hidden = false;
      return;
    }

    const payload = readFields();
    const signature = JSON.stringify(payload);
    if (!pending || pending.signature !== signature) {
      pending = { signature, requestId: crypto.randomUUID() };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    sending = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    const originalContents = [...submit.childNodes].map(node => node.cloneNode(true));
    submit.textContent = 'Saving your inquiry…';
    status.textContent = 'Saving your inquiry…';
    try {
      const response = await fetch('api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Website-Inquiry': '1' },
        body: JSON.stringify({ ...payload, requestId: pending.requestId }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Requests are unavailable right now. Please try again.');
      if (result?.ok !== true || !/^FP-[A-F0-9]{12}$/.test(result.reference)) {
        throw new Error('The request could not be confirmed. Please try again; retrying the same details will not create a duplicate.');
      }
      // Preserve anything the visitor changed while the request was in flight.
      if (JSON.stringify(readFields()) === signature) {
        const buyerType = payload.buyerType;
        form.reset();
        setBuyer(buyerType);
      }
      pending = null;
      status.textContent = 'Request ' + result.reference + ' saved in the Flightpath sales workspace. No email has been sent.';
    } catch (failure) {
      status.textContent = '';
      error.textContent = failure.name === 'AbortError'
        ? 'Saving took longer than expected. Your details are still here. Please try again; retrying the same details will not create a duplicate.'
        : failure.message === 'Failed to fetch'
          ? 'We could not reach the request service. Your details are still here. Please check your connection and try again.'
          : failure.message;
      error.hidden = false;
    } finally {
      clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      submit.replaceChildren(...originalContents);
      form.removeAttribute('aria-busy');
    }
  });
})();
