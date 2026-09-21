(function () {
  'use strict';

  var FORM_ID = '261096398003054';
  var SUBMIT_ID = 'input_41';
  var submitting = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function getForm() {
    return byId(FORM_ID);
  }

  function isVisible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  function clearError(id) {
    var el = byId(id);
    if (el) el.remove();
  }

  function setStatus(message) {
    var host = byId('cid_41');
    if (!host) return;
    var el = byId('student-transfer-submit-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'student-transfer-submit-status';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.marginTop = '8px';
      el.style.fontSize = '0.95em';
      host.appendChild(el);
    }
    el.textContent = message || '';
  }

  function showError(container, id, message) {
    clearError(id);
    var host = container || getForm();
    if (!host) return;
    var el = document.createElement('div');
    el.id = id;
    el.className = 'form-error-message';
    el.setAttribute('role', 'alert');
    el.style.color = '#b00020';
    el.style.marginTop = '8px';
    el.style.fontSize = '0.95em';
    el.textContent = message;
    host.appendChild(el);
  }

  function focusField(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    try { el.focus(); } catch (e) {}
  }

  function value(id) {
    var el = byId(id);
    if (!el) return '';

    // Dynamic-dropdown fallbacks preserve the user's real selection here.
    // A legacy Jotform calculation can overwrite input_76 with optional
    // field 85, so prefer/restore the fallback selection when available.
    var saved = el.getAttribute && el.getAttribute('data-custom-fallback-value');
    if (saved) {
      if (el.value !== saved) el.value = saved;
      return String(saved).trim();
    }

    return String(el.value || '').trim();
  }

  function checked(name) {
    return !!document.querySelector('input[name="' + name + '"]:checked');
  }

  function reasonChecked() {
    return !!document.querySelector(
      'input[name="q79_reasonFor79[]"]:checked, #other_79:checked'
    );
  }

  function hasReason(v) {
    var checkedInputs = document.querySelectorAll('input[name="q79_reasonFor79[]"]:checked');
    for (var i = 0; i < checkedInputs.length; i++) {
      if (checkedInputs[i].value === v) return true;
    }
    return false;
  }

  function requireValue(id, label, errors) {
    var el = byId(id);
    if (!el || !value(id)) {
      errors.push({ el: el, label: label });
      return false;
    }
    return true;
  }

  function validateEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function validateRequiredFields() {
    var errors = [];

    requireValue('input_68', 'Type of Request', errors);
    requireValue('first_61', 'Student first name', errors);
    requireValue('last_61', 'Student last name', errors);
    requireValue('input_60', 'Grade Level', errors);

    var dob = byId('native_date_7');
    if (!dob || !String(dob.value || '').trim()) {
      errors.push({ el: dob || byId('lite_mode_7'), label: 'Date of Birth' });
    }

    requireValue('first_62', 'Parent/Guardian first name', errors);
    requireValue('last_62', 'Parent/Guardian last name', errors);
    requireValue('input_8_addr_line1', 'Home Address', errors);
    requireValue('input_8_city', 'City', errors);
    requireValue('input_8_state', 'State', errors);
    requireValue('input_8_postal', 'ZIP/Postal Code', errors);
    requireValue('input_8_country', 'Country', errors);
    requireValue('input_10_full', 'Phone Number', errors);

    var email = value('input_11');
    if (!email || !validateEmail(email)) {
      errors.push({ el: byId('input_11'), label: 'Valid Email Address' });
    }

    requireValue('input_76', "Child's school of residence", errors);
    requireValue('input_87', 'Requested district/school', errors);

    if (!checked('q65_individualizedEducation')) {
      errors.push({ el: byId('input_65_0'), label: 'Individualized Education Plan (IEP)' });
    }
    if (!checked('q66_hasAn66')) {
      errors.push({ el: byId('input_66_0'), label: '504 Plan' });
    }
    if (!reasonChecked()) {
      errors.push({ el: byId('input_79_0'), label: 'Reason for request' });
    }
    if (!checked('q96_isYour')) {
      errors.push({ el: byId('input_96_0'), label: 'Expulsion question' });
    }

    if (isVisible(byId('id_77'))) requireValue('input_77', 'School of residence', errors);
    if (isVisible(byId('id_86'))) requireValue('input_86', 'Current School of Enrollment', errors);
    if (isVisible(byId('id_88'))) requireValue('input_88', 'Requested School', errors);

    if (hasReason('Sibling attends the school I am requesting')) {
      requireValue('first_80', 'Sibling first name', errors);
      requireValue('last_80', 'Sibling last name', errors);
    }

    if (hasReason('Permanent MUSD employee (District verification required)')) {
      requireValue('input_106', 'Parent Employee Number', errors);
      requireValue('input_107', "Parent's Work Location", errors);
    }

    var expulsionYes = document.querySelector('input[name="q96_isYour"]:checked');
    if (expulsionYes && expulsionYes.value === 'Yes') {
      var f97 = byId('input_97');
      if (!f97 || !f97.files || !f97.files.length) {
        errors.push({ el: f97, label: 'Expulsion documents' });
      }
    }

    clearError('student-transfer-submit-error');

    if (errors.length) {
      var names = errors.map(function (x) { return x.label; });
      showError(
        byId('cid_41'),
        'student-transfer-submit-error',
        'Please complete: ' + names.join(', ') + '.'
      );
      focusField(errors[0].el);
      return false;
    }

    return true;
  }

  function employeeIsValid() {
    if (typeof window.validateStudentTransferEmployee !== 'function') return true;
    return window.validateStudentTransferEmployee();
  }

  function prepareHiddenSubmitFields() {
    // Restore the exact visible dropdown selections immediately before POST.
    [76, 85, 87].forEach(function (id) {
      var el = byId('input_' + id);
      if (!el) return;
      var saved = el.getAttribute('data-custom-fallback-value');
      if (saved) el.value = saved;
    });

    var submitDate = byId('submitDate');
    if (submitDate) submitDate.value = new Date().toISOString();

    var submitSource = byId('submitSource');
    if (submitSource && (!submitSource.value || submitSource.value === 'unknown')) {
      submitSource.value = 'website';
    }

    ['input_111', 'input_112', 'input_113', 'input_114', 'input_115'].forEach(function (id) {
      var el = byId(id);
      if (el) el.disabled = false;
    });

    var transferRadios = document.querySelectorAll('input[name="q89_typeOf89"]');
    for (var i = 0; i < transferRadios.length; i++) {
      transferRadios[i].disabled = false;
    }
  }

  function attemptSubmit() {
    if (submitting) return;

    try {
      setStatus('Checking form...');

      if (!validateRequiredFields()) {
        setStatus('Submission stopped because a required field is missing.');
        return;
      }

      if (!employeeIsValid()) {
        setStatus('Submission stopped by employee validation.');
        return;
      }

      var f = getForm();
      if (!f) {
        throw new Error('Form element was not found.');
      }

      prepareHiddenSubmitFields();
      submitting = true;

      var button = byId(SUBMIT_ID);
      if (button) {
        button.disabled = true;
        button.textContent = 'Submitting...';
      }
      setStatus('Submitting to Jotform...');

      // We already validated the actual user-facing required fields above.
      // Disable browser/Jotform client validation for the final transport so
      // stale hidden controls cannot silently block the POST.
      f.noValidate = true;
      f.removeAttribute('onsubmit');
      HTMLFormElement.prototype.submit.call(f);
    } catch (e) {
      submitting = false;
      var button = byId(SUBMIT_ID);
      if (button) {
        button.disabled = false;
        button.textContent = 'Submit';
      }
      var detail = e && e.message ? e.message : String(e);
      showError(
        byId('cid_41'),
        'student-transfer-submit-error',
        'Submission script error: ' + detail
      );
      setStatus('Submission did not start.');
      try { console.error('Student Transfer submit rescue failed:', e); } catch (ignore) {}
    }
  }

  function bind() {
    var f = getForm();
    var button = byId(SUBMIT_ID);
    if (!f || !button || f.dataset.submitRescueBound === '1') return;

    f.dataset.submitRescueBound = '1';

    // Neutralize the generated inline hook in the standalone copy.
    f.removeAttribute('onsubmit');

    button.addEventListener('click', function (event) {
      if (submitting) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      attemptSubmit();
    }, true);

    f.addEventListener('submit', function (event) {
      if (submitting) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      attemptSubmit();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  document.addEventListener('JotformReady', bind);
})();