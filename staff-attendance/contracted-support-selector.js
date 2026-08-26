(function () {
  const DATA_URL = 'https://script.google.com/macros/s/AKfycbz5uehocca1-EULXm2iD-w6pItAdlQuaPTYWUEiKphMusGeI3h3movpjET1v1ieTUM82Q/exec';
  const QUESTION_LABEL = 'Enter name or ID number';
  const DATALIST_ID = 'contracted-support-employee-options';
  const ERROR_CLASS = 'contracted-support-selection-error';

  let employees = [];
  let validLabels = new Set();
  let dataLoaded = false;

  function normalizeText(value) {
    return String(value || '')
      .replace(/\*/g, '')
      .replace(/:\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findQuestionLine() {
    const lines = Array.from(document.querySelectorAll('.form-line'));
    return lines.find(function (line) {
      const label = line.querySelector('.form-label');
      return label && normalizeText(label.textContent) === QUESTION_LABEL;
    }) || null;
  }

  function findInput() {
    const line = findQuestionLine();
    if (!line) return null;

    return (
      line.querySelector('input[type="text"]') ||
      line.querySelector('input:not([type])') ||
      line.querySelector('input')
    );
  }

  function ensureDatalist() {
    let datalist = document.getElementById(DATALIST_ID);

    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = DATALIST_ID;
      document.body.appendChild(datalist);
    }

    return datalist;
  }

  function setError(message) {
    const line = findQuestionLine();
    if (!line) return;

    let error = line.querySelector('.' + ERROR_CLASS);

    if (!message) {
      if (error) error.remove();
      return;
    }

    if (!error) {
      error = document.createElement('div');
      error.className = ERROR_CLASS;
      error.style.color = '#d9534f';
      error.style.marginTop = '6px';
      error.style.fontSize = '0.95em';
      error.setAttribute('aria-live', 'polite');
      line.appendChild(error);
    }

    error.textContent = message;
  }

  function populateOptions() {
    const payload = window.CONTRACTED_SUPPORT_DATA || {};
    employees = Array.isArray(payload.employees) ? payload.employees : [];
    validLabels = new Set();

    const datalist = ensureDatalist();
    datalist.innerHTML = '';

    employees.forEach(function (employee) {
      if (!employee || !employee.label) return;

      const label = normalizeText(employee.label);
      if (!label) return;

      validLabels.add(label);

      const option = document.createElement('option');
      option.value = label;

      const details = [employee.agency, employee.position]
        .map(normalizeText)
        .filter(Boolean)
        .join(' • ');

      if (details) option.label = details;
      datalist.appendChild(option);
    });

    const input = findInput();
    if (input) {
      input.setAttribute('list', DATALIST_ID);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('placeholder', 'Start typing a name or ID');
    }

    dataLoaded = true;
  }

  function isValidSelection(showError) {
    const input = findInput();
    if (!input) return true;

    const value = normalizeText(input.value);

    if (!value) {
      if (showError) setError('');
      return true;
    }

    if (!dataLoaded) {
      if (showError) setError('Employee list is still loading. Please try again.');
      return false;
    }

    if (validLabels.has(value)) {
      if (showError) setError('');
      return true;
    }

    if (showError) {
      setError('Please select a contracted employee from the list.');
    }
    return false;
  }

  function attachValidation() {
    const input = findInput();
    const form = document.querySelector('form');
    if (!input || !form) return;

    input.addEventListener('input', function () {
      setError('');
    });

    input.addEventListener('blur', function () {
      if (input.value) isValidSelection(true);
    });

    form.addEventListener('submit', function (event) {
      if (!isValidSelection(true)) {
        event.preventDefault();
        event.stopPropagation();
        input.focus();
      }
    }, true);
  }

  function loadData() {
    const script = document.createElement('script');
    const separator = DATA_URL.indexOf('?') >= 0 ? '&' : '?';
    script.src = DATA_URL + separator + 'ts=' + Date.now();
    script.async = true;
    script.onload = function () {
      populateOptions();
      attachValidation();
    };
    script.onerror = function () {
      dataLoaded = false;
      console.error('Could not load contracted support employee data.');
    };
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
  } else {
    loadData();
  }
})();
