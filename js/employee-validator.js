(function () {
  const DATA_URL = 'https://script.google.com/macros/s/AKfycby-L3TTZqqw4WkB_u2JoK4hIJbgkXkXZ280SFEFHdJWkhzB0dPH2vCw__891aJg2ybO/exec';
  const FORM_ID = '261096398003054';
  const EMPLOYEE_INPUT_ID = 'input_106';
  const FIRST_INPUT_ID = 'first_62';
  const LAST_INPUT_ID = 'last_62';
  const ERROR_CONTAINER_ID = 'cid_62';

  let employeeMap = {};
  let dataLoaded = false;

  function normalize(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .trim();
  }

  function getForm() {
    return document.getElementById(FORM_ID) || document.querySelector('form');
  }

  function getEmployeeInput() {
    return document.getElementById(EMPLOYEE_INPUT_ID);
  }

  function getFirstInput() {
    return document.getElementById(FIRST_INPUT_ID);
  }

  function getLastInput() {
    return document.getElementById(LAST_INPUT_ID);
  }

  function getErrorContainer() {
    return document.getElementById(ERROR_CONTAINER_ID);
  }

  function setError(message) {
    const container = getErrorContainer();
    if (!container) return;

    let el = container.querySelector('.custom-employee-error');

    if (!message) {
      if (el) el.remove();
      return;
    }

    if (!el) {
      el = document.createElement('div');
      el.className = 'custom-employee-error';
      el.style.color = '#d9534f';
      el.style.marginTop = '6px';
      el.style.fontSize = '0.95em';
      el.setAttribute('aria-live', 'polite');
      container.appendChild(el);
    }

    el.textContent = message;
  }

  function parseEmployeeData() {
    const map = {};
    const teachers = window.SPLIT_SUB_DATA && Array.isArray(window.SPLIT_SUB_DATA.teachers)
      ? window.SPLIT_SUB_DATA.teachers
      : [];

    teachers.forEach(function (item) {
      if (typeof item !== 'string') return;

      const match = item.match(/^(.+?)\s*-\s*(.+)$/);
      if (!match) return;

      const empNum = String(match[1] || '').trim();
      const rawName = String(match[2] || '').trim();
      const nameParts = rawName.split(',');

      if (!empNum || nameParts.length < 2) return;

      const lastName = normalize(nameParts[0]);
      const firstSide = String(nameParts.slice(1).join(',') || '').trim();

      map[empNum] = {
        firstToken: normalize(firstSide.split(/\s+/)[0] || ''),
        fullFirst: normalize(firstSide),
        lastName: lastName
      };
    });

    return map;
  }

  function validate(showMessages) {
    const empInput = getEmployeeInput();
    const firstInput = getFirstInput();
    const lastInput = getLastInput();

    if (!empInput || !firstInput || !lastInput) return true;

    const empNum = String(empInput.value || '').trim();
    const firstName = normalize(firstInput.value);
    const lastName = normalize(lastInput.value);

    if (!empNum) {
      if (showMessages) setError('');
      return true;
    }

    if (!dataLoaded) {
      if (showMessages) setError('Employee validation data is still loading. Please wait a moment and try again.');
      return false;
    }

    if (!Object.prototype.hasOwnProperty.call(employeeMap, empNum)) {
      if (showMessages) setError('Employee number was not found.');
      return false;
    }

    if (!firstName || !lastName) {
      if (showMessages) setError('');
      return true;
    }

    const record = employeeMap[empNum];
    const firstMatches = firstName === record.firstToken || firstName === record.fullFirst;
    const lastMatches = lastName === record.lastName;

    if (firstMatches && lastMatches) {
      if (showMessages) setError('');
      return true;
    }

    if (showMessages) setError('Employee number does not match the first and last name entered.');
    return false;
  }

  function loadEmployeeData(callback) {
    if (window.SPLIT_SUB_DATA && Array.isArray(window.SPLIT_SUB_DATA.teachers)) {
      employeeMap = parseEmployeeData();
      dataLoaded = true;
      callback();
      return;
    }

    const script = document.createElement('script');
    const sep = DATA_URL.indexOf('?') >= 0 ? '&' : '?';
    script.src = DATA_URL + sep + 'ts=' + Date.now();
    script.async = true;

    script.onload = function () {
      employeeMap = parseEmployeeData();
      dataLoaded = true;
      callback();
    };

    script.onerror = function () {
      dataLoaded = false;
      callback();
    };

    document.head.appendChild(script);
  }

  function attachListeners() {
    const empInput = getEmployeeInput();
    const firstInput = getFirstInput();
    const lastInput = getLastInput();
    const form = getForm();

    if (!empInput || !firstInput || !lastInput || !form) return;

    [empInput, firstInput, lastInput].forEach(function (el) {
      el.addEventListener('input', function () {
        if (!empInput.value) {
          setError('');
          return;
        }
        validate(false);
      });

      el.addEventListener('blur', function () {
        validate(true);
      });
    });

    form.addEventListener('submit', function (event) {
      if (!validate(true)) {
        event.preventDefault();
        event.stopPropagation();
        if (empInput && empInput.value) {
          (getFirstInput() || empInput).focus();
        }
      }
    }, true);
  }

  function init() {
    loadEmployeeData(function () {
      attachListeners();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
