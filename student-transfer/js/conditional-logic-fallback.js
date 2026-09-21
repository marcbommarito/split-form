(function () {
  'use strict';

  var FORM_ID = '261096398003054';

  function byId(id) {
    return document.getElementById(id);
  }

  function row(id) {
    return byId('id_' + id);
  }

  function rememberInitialState(el) {
    if (!el || el.dataset.conditionalFallbackInit === '1') return;
    el.dataset.conditionalFallbackInit = '1';
    el.dataset.conditionalFallbackAlwaysHidden = el.classList.contains('always-hidden') ? '1' : '0';
  }

  function setVisible(id, visible) {
    var li = row(id);
    var cid = byId('cid_' + id);
    if (!li) return;

    rememberInitialState(li);
    rememberInitialState(cid);

    if (visible) {
      li.style.display = '';
      li.classList.remove('form-field-hidden');
      li.classList.remove('always-hidden');
      if (cid) cid.classList.remove('always-hidden');
    } else {
      li.style.display = 'none';
      li.classList.add('form-field-hidden');
      if (li.dataset.conditionalFallbackAlwaysHidden === '1') li.classList.add('always-hidden');
      if (cid && cid.dataset.conditionalFallbackAlwaysHidden === '1') cid.classList.add('always-hidden');
    }
  }

  function setRequired(id, required) {
    var li = row(id);
    if (!li) return;

    var inputs = li.querySelectorAll('input, select, textarea');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if (input.type === 'hidden') continue;
      if (required) {
        input.setAttribute('required', '');
        input.setAttribute('aria-required', 'true');
      } else {
        input.removeAttribute('required');
        input.removeAttribute('aria-required');
      }
    }

    var label = li.querySelector('.form-label, label');
    if (label) {
      var star = label.querySelector('.conditional-fallback-required');
      if (required && !star) {
        star = document.createElement('span');
        star.className = 'form-required conditional-fallback-required';
        star.setAttribute('aria-hidden', 'true');
        star.textContent = '*';
        label.appendChild(star);
      } else if (!required && star) {
        star.remove();
      }
    }

    li.classList.toggle('jf-required', !!required);
    var cid = byId('cid_' + id);
    if (cid) cid.classList.toggle('jf-required', !!required);
  }

  function checkedValues(name) {
    var values = [];
    var inputs = document.querySelectorAll('input[name="' + name + '"]:checked');
    for (var i = 0; i < inputs.length; i++) values.push(inputs[i].value);
    return values;
  }

  function hasReason(value) {
    return checkedValues('q79_reasonFor79[]').indexOf(value) >= 0;
  }

  function hiddenValue(id) {
    var input = byId('input_' + id);
    if (!input) return '';

    // The native dropdown fallback stores the user's actual selection here.
    // Prefer it because a legacy Jotform calculation can overwrite input_76
    // with optional field 85 after field 76 changes.
    var saved = input.getAttribute && input.getAttribute('data-custom-fallback-value');
    if (saved) {
      if (input.value !== saved) input.value = saved;
      return String(saved);
    }

    return String(input.value || '');
  }

  function setInputValue(input, value) {
    if (!input) return;
    var next = value == null ? '' : String(value);
    if (input.value === next) return;
    input.value = next;
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  function setRadioValue(fieldId, value) {
    var radios = document.querySelectorAll('input[name="q' + fieldId + '_typeOf' + fieldId + '"], input[name="q' + fieldId + '_typeOf89"]');
    if (!radios.length && fieldId === 89) radios = document.querySelectorAll('input[name="q89_typeOf89"]');

    for (var i = 0; i < radios.length; i++) {
      radios[i].disabled = false;
      radios[i].checked = radios[i].value === value;
    }
  }

  function updateTransferAndLookup() {
    var residence = hiddenValue(76);
    var requested = hiddenValue(87);
    var type = '';

    if (residence && requested) {
      var residenceMenifee = residence.indexOf('Menifee') >= 0;
      var requestedMenifee = requested.indexOf('Menifee') >= 0;

      if (!residenceMenifee && requestedMenifee) type = 'Inter In';
      else if (residenceMenifee && requestedMenifee) type = 'Intra';
      else if (residenceMenifee && !requestedMenifee) type = 'Inter Out';
    }

    setRadioValue(89, type);

    var key = '';
    if (type === 'Inter Out') key = requested;
    else if (type === 'Inter In') key = residence;

    var keyInput = byId('input_111');
    if (keyInput) {
      keyInput.disabled = false;
      setInputValue(keyInput, key);
    }

    var contactSelect = byId('input_112');
    var emailSelect = byId('input_113');

    function setLookup(select, lookupKey) {
      if (!select) return '';
      select.disabled = false;
      var found = false;
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === lookupKey && lookupKey) {
          select.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found) select.selectedIndex = 0;
      var option = select.options[select.selectedIndex];
      return found && option ? String(option.getAttribute('data-calcvalue') || '') : '';
    }

    var contact = setLookup(contactSelect, key);
    var email = setLookup(emailSelect, key);

    setInputValue(byId('input_114'), contact);
    setInputValue(byId('input_115'), email);
    setInputValue(byId('input_105'), email);
  }

  function updateSchoolOtherFields() {
    setVisible(77, hiddenValue(76).indexOf('Select and Enter School Below') >= 0);
    setVisible(86, hiddenValue(85).indexOf('Select and Enter School Below') >= 0);
    setVisible(88, hiddenValue(87).indexOf('Select and Enter School Below') >= 0);
  }

  function updateReasonFields() {
    var sibling = hasReason('Sibling attends the school I am requesting');
    var employee = hasReason('Permanent MUSD employee (District verification required)');
    var childcare = hasReason('Child care (Verfication required)');
    var employment = hasReason('Employment based request (Employer verification required)');

    setVisible(80, sibling);
    setRequired(80, sibling);

    setVisible(106, employee);
    setVisible(107, employee);
    setRequired(106, employee);
    setRequired(107, employee);

    setVisible(84, childcare);
    setVisible(81, childcare);
    setVisible(82, childcare);

    setVisible(108, employment);
    setVisible(109, employment);
    setVisible(110, employment);
  }

  function updateExpulsionField() {
    var yes = document.querySelector('input[name="q96_isYour"]:checked');
    var show = !!(yes && yes.value === 'Yes');
    setVisible(97, show);
    setRequired(97, show);
  }

  function updateReviewStage() {
    var isEdit = window.location.href.toLowerCase().indexOf('edit') >= 0;
    var review = byId('input_100_0');
    if (review && isEdit) review.checked = true;

    var active = !!(review && review.checked);
    [105, 114, 103, 102].forEach(function (id) {
      setVisible(id, active);
    });
  }

  function refresh() {
    updateSchoolOtherFields();
    updateReasonFields();
    updateExpulsionField();
    updateTransferAndLookup();
    updateReviewStage();
  }

  function scheduleRefresh() {
    setTimeout(refresh, 0);
    setTimeout(refresh, 25);
  }

  function bind() {
    var form = byId(FORM_ID);
    if (!form || form.dataset.conditionalFallbackBound === '1') {
      scheduleRefresh();
      return;
    }

    form.dataset.conditionalFallbackBound = '1';

    [76, 85, 87].forEach(function (id) {
      var input = byId('input_' + id);
      if (input) {
        input.addEventListener('input', scheduleRefresh);
        input.addEventListener('change', scheduleRefresh);
      }
    });

    var reasons = form.querySelectorAll('input[name="q79_reasonFor79[]"], #other_79');
    for (var i = 0; i < reasons.length; i++) {
      reasons[i].addEventListener('change', scheduleRefresh);
    }

    var expulsion = form.querySelectorAll('input[name="q96_isYour"]');
    for (var j = 0; j < expulsion.length; j++) {
      expulsion[j].addEventListener('change', scheduleRefresh);
    }

    scheduleRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  document.addEventListener('JotformReady', bind);
})();