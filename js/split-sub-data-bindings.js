(function () {
  const DATA_URL = 'https://script.google.com/macros/s/AKfycby-L3TTZqqw4WkB_u2JoK4hIJbgkXkXZ280SFEFHdJWkhzB0dPH2vCw__891aJg2ybO/exec';

  function normalizeText_(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getLabelText_(line) {
    const label = line ? line.querySelector('.form-label') : null;
    return label ? normalizeText_(label.textContent) : '';
  }

  function getPrimaryInput_(line) {
    if (!line) return null;

    return (
      line.querySelector('select') ||
      line.querySelector('input[type="text"]') ||
      line.querySelector('input:not([type])') ||
      line.querySelector('textarea')
    );
  }

  function findLineByExactLabel_(labelText) {
    const lines = Array.from(document.querySelectorAll('.form-line'));
    return lines.find(line => getLabelText_(line) === labelText) || null;
  }

  function findTeacherInputs_() {
    const lines = Array.from(document.querySelectorAll('.form-line'));

    return lines
      .filter(line => /^P[1-6] Employee Name [1-5]$/i.test(getLabelText_(line)))
      .map(getPrimaryInput_)
      .filter(Boolean);
  }

  function ensureDatalist_(id, items) {
    let datalist = document.getElementById(id);

    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = id;
      document.body.appendChild(datalist);
    }

    datalist.innerHTML = '';
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item;
      datalist.appendChild(option);
    });

    return datalist;
  }

  function populateSchoolSite_(schools) {
    const line = findLineByExactLabel_('School Site');
    const input = getPrimaryInput_(line);

    if (!input || !schools || !schools.length) return;

    if (input.tagName === 'SELECT') {
      const currentValue = input.value;

      input.innerHTML = '';

      const blankOption = document.createElement('option');
      blankOption.value = '';
      blankOption.textContent = 'Please Select';
      input.appendChild(blankOption);

      schools.forEach(school => {
        const option = document.createElement('option');
        option.value = school;
        option.textContent = school;
        input.appendChild(option);
      });

      if (schools.includes(currentValue)) {
        input.value = currentValue;
      }

      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const datalist = ensureDatalist_('split-sub-school-options', schools);
    input.setAttribute('list', datalist.id);
    input.setAttribute('autocomplete', 'on');
  }

  function populateTeacherFields_(teachers) {
    if (!teachers || !teachers.length) return;

    const inputs = findTeacherInputs_();
    if (!inputs.length) return;

    const datalist = ensureDatalist_('split-sub-teacher-options', teachers);

    inputs.forEach(input => {
      input.setAttribute('list', datalist.id);
      input.setAttribute('autocomplete', 'on');
    });
  }

  function applyRemoteData_() {
    const data = window.SPLIT_SUB_DATA || {};
    populateSchoolSite_(data.schools || []);
    populateTeacherFields_(data.teachers || []);
  }

  function loadRemoteData_() {
    const script = document.createElement('script');
    const sep = DATA_URL.includes('?') ? '&' : '?';
    script.src = DATA_URL + sep + 'ts=' + Date.now();
    script.onload = applyRemoteData_;
    script.onerror = function () {
      console.error('Could not load split-sub remote data.');
    };
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadRemoteData_);
  } else {
    loadRemoteData_();
  }
})();
