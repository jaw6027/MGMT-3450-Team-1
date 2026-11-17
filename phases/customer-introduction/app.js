(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const menu = document.getElementById('menu'), nav = document.getElementById('navigation');
  menu.hidden = false;
  function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
  menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); } });
  const audiences = {
    fleet: ['FLEET & INSPECTION TEAMS', 'Bring structural context to your evaluation.', 'Explore whether measurements from selected airframe locations could complement your existing inspection records and operating history.', 'Which measurements would be useful to review alongside a scheduled inspection?', 'Fleet & inspection evaluation'],
    engineering: ['MANUFACTURERS & ENGINEERS', 'Frame a more focused engineering question.', 'Explore strain, vibration, and temperature as complementary inputs to controlled airframe tests. Define what needs to be measured before selecting a sensor configuration.', 'How do measurements at selected locations change between controlled test conditions?', 'Aircraft engineering & testing'],
    research: ['RESEARCH & PROGRAM TEAMS', 'Make the evaluation question explicit.', 'Use the prototype to discuss an instrumented research setup, data requirements, and the evidence a pilot would need to produce.', 'What would a useful dataset and a repeatable test plan look like for this program?', 'Research & program evaluation']
  };
  document.querySelectorAll('[data-audience]').forEach(button => button.addEventListener('click', () => {
    const content = audiences[button.dataset.audience];
    document.querySelectorAll('[data-audience]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    ['audience-label', 'audience-title', 'audience-copy', 'audience-question'].forEach((id, i) => { document.getElementById(id).textContent = content[i]; });
  }));
  document.getElementById('audience-cta').addEventListener('click', () => {
    const selected = document.querySelector('[data-audience][aria-pressed="true"]');
    document.getElementById('application').value = audiences[selected.dataset.audience][4];
  });
  document.getElementById('brief-form').addEventListener('submit', event => {
    event.preventDefault();
    for (const id of ['full-name', 'organization']) {
      const field = document.getElementById(id);
      field.setCustomValidity(field.value.trim() ? '' : 'Please enter ' + (id === 'full-name' ? 'your name.' : 'your organization.'));
      if (!field.reportValidity()) return;
    }
    const value = id => document.getElementById(id).value.trim();
    const text = [
      'DRONE SHM — EVALUATION DISCUSSION BRIEF', '',
      'Full name: ' + value('full-name'),
      'Business email: ' + value('business-email'),
      'Organization: ' + value('organization'),
      'Interest: ' + value('interest'), 'Primary application: ' + value('application'), 'Expected timeline: ' + value('timeline'), '',
      'Project overview:', value('question') || 'Not provided — discuss with the team.', '',
      'Suggested discussion points:',
      '- Aircraft type and current inspection or testing workflow',
      '- Sensor placement, power, calibration, and communications',
      '- Data access, measurement context, and pilot success criteria', '',
      'Prototype: https://cs.csub.edu/~bdarghali/drone-shm/',
      'Research concept; no validated flightworthiness decision is provided.',
      'This brief was created locally. It has not been sent to the project team.'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'drone-shm-inquiry-details.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById('brief-status').textContent = 'Your inquiry details are ready to download. Share the file with your project contact to start the conversation. Nothing has been sent from this page.';
  });
  for (const id of ['full-name', 'organization']) document.getElementById(id).addEventListener('input', event => event.target.setCustomValidity(''));
})();
