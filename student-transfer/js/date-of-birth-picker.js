(function () {
  'use strict';

  var FIELD_ID = 7;

  function byId(id) {
    return document.getElementById(id);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function syncToJotform(nativeInput) {
    if (!nativeInput || !nativeInput.value) {
      var liteEmpty = byId('lite_mode_' + FIELD_ID);
      if (liteEmpty) liteEmpty.value = '';
      ['month_', 'day_', 'year_'].forEach(function (prefix) {
        var el = byId(prefix + FIELD_ID);
        if (el) el.value = '';
      });
      return;
    }

    var parts = nativeInput.value.split('-');
    if (parts.length !== 3) return;

    var year = parts[0];
    var month = parts[1];
    var day = parts[2];

    var lite = byId('lite_mode_' + FIELD_ID);
    var monthInput = byId('month_' + FIELD_ID);
    var dayInput = byId('day_' + FIELD_ID);
    var yearInput = byId('year_' + FIELD_ID);

    if (lite) lite.value = month + '-' + day + '-' + year;
    if (monthInput) monthInput.value = month;
    if (dayInput) dayInput.value = day;
    if (yearInput) yearInput.value = year;

    [lite, monthInput, dayInput, yearInput].forEach(function (el) {
      if (!el) return;
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    });
  }

  function existingIsoDate() {
    var year = byId('year_' + FIELD_ID);
    var month = byId('month_' + FIELD_ID);
    var day = byId('day_' + FIELD_ID);

    if (year && month && day && year.value && month.value && day.value) {
      return String(year.value).padStart(4, '0') + '-' + pad2(month.value) + '-' + pad2(day.value);
    }

    var lite = byId('lite_mode_' + FIELD_ID);
    if (lite && lite.value) {
      var m = lite.value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) return m[3] + '-' + pad2(m[1]) + '-' + pad2(m[2]);
    }

    return '';
  }

  function init() {
    var lite = byId('lite_mode_' + FIELD_ID);
    var pick = byId('input_' + FIELD_ID + '_pick');
    if (!lite || !lite.parentNode) return;
    if (byId('native_date_' + FIELD_ID)) return;

    var nativeInput = document.createElement('input');
    nativeInput.type = 'date';
    nativeInput.id = 'native_date_' + FIELD_ID;
    nativeInput.className = 'form-textbox validate[required]';
    nativeInput.required = true;
    nativeInput.setAttribute('aria-label', 'Date of Birth');
    nativeInput.style.width = '100%';
    nativeInput.style.maxWidth = '310px';
    nativeInput.style.height = '36px';

    var existing = existingIsoDate();
    if (existing) nativeInput.value = existing;

    lite.style.display = 'none';
    lite.removeAttribute('required');
    if (pick) pick.style.display = 'none';

    lite.parentNode.insertBefore(nativeInput, lite);

    nativeInput.addEventListener('change', function () {
      syncToJotform(nativeInput);
    });

    nativeInput.addEventListener('input', function () {
      syncToJotform(nativeInput);
    });

    var label = byId('sublabel_' + FIELD_ID + '_litemode');
    if (label) {
      label.setAttribute('for', nativeInput.id);
      label.textContent = 'Date';
    }

    var form = byId('261096398003054');
    if (form) {
      form.addEventListener('submit', function () {
        syncToJotform(nativeInput);
      }, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('JotformReady', init);
})();