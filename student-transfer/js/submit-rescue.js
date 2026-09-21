(function () {
  'use strict';

  var FORM_ID = '261096398003054';
  var SUBMIT_ID = 'input_41';
  var submitting = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function form() {
    return byId(FORM_ID);
  }

  function clearError(id) {
    var el = byId(id);
    if (el) el.remove();
  }

  function showError(container, id, message) {
    clearError(id);
    var host = container || form();
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

  function reasonIsValid() {
    var checked = document.querySelectorAll(
      'input[name="q79_reasonFor79[]"]:checked, #other_79:checked'
    );
    var ok = checked.length > 0;
    var host = byId('cid_79');

    if (ok) {
      clearError('student-transfer-reason-error');
      return true;
    }

    showError(
      host,
      'student-transfer-reason-error',
      'Please select at least one reason for the request.'
    );

    var first = byId('input_79_0') || byId('other_79');
    if (first) {
      try { first.focus(); } catch (e) {}
      try { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    }
    return false;
  }

  function browserFieldsAreValid() {
    var f = form();
    if (!f) return false;

    if (typeof f.checkValidity === 'function' && !f.checkValidity()) {
      if (typeof f.reportValidity === 'function') f.reportValidity();

      var invalid = f.querySelector(':invalid');
      if (invalid) {
        try { invalid.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
        try { invalid.focus(); } catch (e) {}
      }
      return false;
    }

    return true;
  }

  function employeeIsValid() {
    if (typeof window.validateStudentTransferEmployee !== 'function') return true;
    return window.validateStudentTransferEmployee();
  }

  function prepareHiddenSubmitFields() {
    var submitDate = byId('submitDate');
    if (submitDate) submitDate.value = new Date().toISOString();

    var submitSource = byId('submitSource');
    if (submitSource && (!submitSource.value || submitSource.value === 'unknown')) {
      submitSource.value = 'website';
    }

    // Make sure helper/calculated values are included in the native POST.
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

    clearError('student-transfer-submit-error');

    // Give the fallback scripts a moment to finish their synchronous change handlers.
    if (!reasonIsValid()) return;
    if (!browserFieldsAreValid()) return;
    if (!employeeIsValid()) return;

    var f = form();
    if (!f) return;

    prepareHiddenSubmitFields();
    submitting = true;

    var button = byId(SUBMIT_ID);
    if (button) {
      button.disabled = true;
      button.textContent = 'Submitting...';
    }

    try {
      // Bypass Jotform's client-side submit event chain, which is not reliable
      // in the standalone GitHub Pages copy. This still performs the normal
      // multipart/form-data POST to the form's existing Jotform action URL.
      HTMLFormElement.prototype.submit.call(f);
    } catch (e) {
      submitting = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Submit';
      }
      showError(
        byId('cid_41'),
        'student-transfer-submit-error',
        'The form could not be submitted. Please try again.'
      );
      try { console.error('Student Transfer submit rescue failed:', e); } catch (ignore) {}
    }
  }

  function bind() {
    var f = form();
    var button = byId(SUBMIT_ID);
    if (!f || !button || f.dataset.submitRescueBound === '1') return;

    f.dataset.submitRescueBound = '1';

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