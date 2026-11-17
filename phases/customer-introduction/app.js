(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const menu = document.getElementById('menu'), nav = document.getElementById('navigation');
  menu.hidden = false;
  function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
  menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); } });
  const sensorContent = {
    strain: ['01 / STRAIN', 'A closer look at arm strain.', 'Strain gauges measure local stretching or compression on two selected arms. They help a team investigate how those locations respond to loading.', 'Learn about strain measurements', 'strain-details'],
    vibration: ['02 / VIBRATION', 'Explore movement at the sensor.', 'Two accelerometers can summarize vibration at selected locations. The dashboard presents g RMS, a measure of vibration amplitude, rather than vibration frequency or a damage diagnosis.', 'Learn about vibration measurements', 'vibration-details'],
    temperature: ['03 / TEMPERATURE', 'Add temperature to the picture.', 'Two temperature sensors near motor mounts add thermal context. Sensor placement matters: these readings do not necessarily represent the temperature inside a motor.', 'Learn about temperature measurements', 'temperature-details']
  };
  document.querySelector('.sensor-hotspots').hidden = false;
  document.querySelector('.sensor-explorer').hidden = false;
  function selectSensor(button) {
    const content = sensorContent[button.dataset.sensor];
    document.querySelectorAll('[data-sensor]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    ['sensor-label', 'sensor-title', 'sensor-copy'].forEach((id, i) => { document.getElementById(id).textContent = content[i]; });
    const link = document.getElementById('sensor-learn'); link.textContent = content[3] + ' ↘'; link.href = '#' + content[4];
  }
  document.querySelectorAll('[data-sensor]').forEach(button => button.addEventListener('click', () => selectSensor(button)));
  document.getElementById('sensor-learn').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const button = document.querySelector('[data-sensor][aria-pressed="true"]');
    const target = document.getElementById(sensorContent[button.dataset.sensor][4]);
    target.open = true;
    target.scrollIntoView({block:'center', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    target.querySelector('summary').focus({preventScroll:true});
  });
  document.getElementById('sensor-learn').href = '#strain-details';
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
