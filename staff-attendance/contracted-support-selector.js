(function () {
  'use strict';

  const DATA_URL = 'https://script.google.com/macros/s/AKfycbz5uehocca1-EULXm2iD-w6pItAdlQuaPTYWUEiKphMusGeI3h3movpjET1v1ieTUM82Q/exec';
  const INPUT_ID = 'input_8';
  const MENU_ID = 'contracted-support-menu';
  const STATUS_ID = 'contracted-support-status';
  const MAX_RESULTS = 20;

  let employees = [];
  let exactLabels = new Set();
  let activeIndex = -1;
  let visibleEmployees = [];
  let dataLoaded = false;

  function normalize(value) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function input() {
    return document.getElementById(INPUT_ID);
  }

  function fieldLine() {
    const el = input();
    return el ? el.closest('.form-line') : null;
  }

  function statusElement() {
    let el = document.getElementById(STATUS_ID);
    if (el) return el;

    const target = fieldLine();
    if (!target) return null;

    el = document.createElement('div');
    el.id = STATUS_ID;
    el.className = 'contracted-support-status';
    el.setAttribute('aria-live', 'polite');
    target.appendChild(el);
    return el;
  }

  function setStatus(message, isError) {
    const el = statusElement();
    if (!el) return;
    el.textContent = message || '';
    el.className = 'contracted-support-status' + (isError ? ' is-error' : '');
  }

  function menu() {
    let el = document.getElementById(MENU_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = MENU_ID;
    el.className = 'contracted-support-menu';
    el.setAttribute('role', 'listbox');
    document.body.appendChild(el);
    return el;
  }

  function positionMenu() {
    const el = input();
    const list = menu();
    if (!el || !list) return;

    const rect = el.getBoundingClientRect();
    list.style.left = (window.scrollX + rect.left) + 'px';
    list.style.top = (window.scrollY + rect.bottom + 3) + 'px';
    list.style.width = rect.width + 'px';
  }

  function closeMenu() {
    const list = menu();
    list.style.display = 'none';
    list.innerHTML = '';
    activeIndex = -1;
    visibleEmployees = [];
  }

  function searchEmployees(query) {
    const q = normalize(query);
    if (!q) return employees.slice(0, MAX_RESULTS);

    const tokens = q.split(' ').filter(Boolean);
    return employees.filter(function (employee) {
      const haystack = normalize([
        employee.id,
        employee.firstName,
        employee.lastName,
        employee.fullName,
        employee.agency,
        employee.position,
        employee.label
      ].join(' '));
      return tokens.every(function (token) {
        return haystack.indexOf(token) !== -1;
      });
    }).slice(0, MAX_RESULTS);
  }

  function setActive(index) {
    const list = menu();
    const options = Array.from(list.querySelectorAll('.contracted-support-option'));
    if (!options.length) {
      activeIndex = -1;
      return;
    }

    activeIndex = Math.max(0, Math.min(index, options.length - 1));
    options.forEach(function (option, i) {
      option.classList.toggle('is-active', i === activeIndex);
      option.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
    });
    options[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function choose(employee) {
    const el = input();
    if (!el || !employee) return;

    el.value = employee.label;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setStatus('Selected: ' + employee.label, false);
    closeMenu();
  }

  function renderMenu(query) {
    if (!dataLoaded) return;

    const list = menu();
    visibleEmployees = searchEmployees(query);
    list.innerHTML = '';
    activeIndex = -1;

    if (!visibleEmployees.length) {
      const empty = document.createElement('div');
      empty.className = 'contracted-support-option';
      empty.textContent = 'No matching contracted employee';
      list.appendChild(empty);
      positionMenu();
      list.style.display = 'block';
      return;
    }

    visibleEmployees.forEach(function (employee, index) {
      const option = document.createElement('div');
      option.className = 'contracted-support-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');

      const main = document.createElement('div');
      main.className = 'contracted-support-option-main';
      main.textContent = employee.label;
      option.appendChild(main);

      const metaParts = [employee.agency, employee.position].filter(Boolean);
      if (metaParts.length) {
        const meta = document.createElement('div');
        meta.className = 'contracted-support-option-meta';
        meta.textContent = metaParts.join(' • ');
        option.appendChild(meta);
      }

      option.addEventListener('mousedown', function (event) {
        event.preventDefault();
        choose(employee);
      });

      option.addEventListener('mousemove', function () {
        setActive(index);
      });

      list.appendChild(option);
    });

    positionMenu();
    list.style.display = 'block';
  }

  function selectionIsValid() {
    const el = input();
    if (!el) return true;
    const value = normalize(el.value);
    if (!value) return false;
    return exactLabels.has(value);
  }

  function validateSelection(showMessage) {
    if (!dataLoaded) {
      if (showMessage) setStatus('Employee list is still loading. Please try again.', true);
      return false;
    }

    if (selectionIsValid()) {
      if (showMessage && normalize(input().value)) setStatus('Employee selection verified.', false);
      return true;
    }

    if (showMessage) setStatus('Please select a contracted employee from the search results.', true);
    return false;
  }

  function attachEvents() {
    const el = input();
    const form = document.getElementById('261966694349072');
    if (!el || !form) return;

    el.setAttribute('autocomplete', 'off');
    el.setAttribute('placeholder', 'Start typing a name or ID');
    el.setAttribute('aria-autocomplete', 'list');
    el.setAttribute('aria-controls', MENU_ID);

    el.addEventListener('focus', function () {
      if (dataLoaded) renderMenu(el.value);
    });

    el.addEventListener('input', function () {
      setStatus('', false);
      renderMenu(el.value);
    });

    el.addEventListener('keydown', function (event) {
      const list = menu();
      if (list.style.display !== 'block') return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(activeIndex <= 0 ? visibleEmployees.length - 1 : activeIndex - 1);
      } else if (event.key === 'Enter' && activeIndex >= 0 && visibleEmployees[activeIndex]) {
        event.preventDefault();
        choose(visibleEmployees[activeIndex]);
      } else if (event.key === 'Escape') {
        closeMenu();
      }
    });

    el.addEventListener('blur', function () {
      setTimeout(function () {
        closeMenu();
        if (el.value) validateSelection(true);
      }, 120);
    });

    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);

    document.addEventListener('mousedown', function (event) {
      if (event.target !== el && !menu().contains(event.target)) closeMenu();
    });

    form.addEventListener('submit', function (event) {
      if (!validateSelection(true)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        el.focus();
        renderMenu(el.value);
      }
    }, true);
  }

  function applyData() {
    const payload = window.CONTRACTED_SUPPORT_DATA || {};
    employees = Array.isArray(payload.employees) ? payload.employees.filter(function (employee) {
      return employee && employee.label && employee.id;
    }) : [];

    exactLabels = new Set(employees.map(function (employee) {
      return normalize(employee.label);
    }));

    dataLoaded = employees.length > 0;
    if (dataLoaded) {
      setStatus('Employee list loaded. Start typing a name or ID.', false);
    } else {
      setStatus('Employee list could not be loaded.', true);
    }
  }

  function loadData() {
    setStatus('Loading employee list…', false);

    const script = document.createElement('script');
    script.src = DATA_URL + (DATA_URL.indexOf('?') >= 0 ? '&' : '?') + 'ts=' + Date.now();
    script.async = true;
    script.onload = applyData;
    script.onerror = function () {
      dataLoaded = false;
      setStatus('Employee list could not be loaded. Please refresh the page.', true);
    };
    document.head.appendChild(script);
  }

  function start() {
    if (!input()) {
      setTimeout(start, 100);
      return;
    }
    attachEvents();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
