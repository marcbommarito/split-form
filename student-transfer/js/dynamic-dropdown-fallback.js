(function () {
  'use strict';

  var FIELD_IDS = [76, 85, 87];
  var REQUIRED_IDS = {76: true, 87: true};

  function decodeSettings(input) {
    if (!input || !input.value) return null;
    try {
      var parsed = JSON.parse(decodeURIComponent(input.value));
      for (var i = 0; i < parsed.length; i++) {
        if (parsed[i] && parsed[i].name === 'list') return parsed[i].value || '';
      }
    } catch (e) {
      try {
        var parsed2 = JSON.parse(input.value);
        for (var j = 0; j < parsed2.length; j++) {
          if (parsed2[j] && parsed2[j].name === 'list') return parsed2[j].value || '';
        }
      } catch (ignore) {}
    }
    return null;
  }

  function parseHierarchy(text) {
    var counties = [];
    var county = null;
    var district = null;

    String(text || '').split(/\r?\n/).forEach(function (raw) {
      if (!raw.trim()) return;

      var leading = (raw.match(/^ */) || [''])[0].length;
      var label = raw.trim();

      if (leading === 0) {
        county = { name: label, districts: [] };
        counties.push(county);
        district = null;
      } else if (leading === 1 && county) {
        district = { name: label, schools: [] };
        county.districts.push(district);
      } else if (leading >= 2 && district) {
        district.schools.push(label);
      }
    });

    return counties;
  }

  function dispatchFieldEvents(input) {
    if (!input) return;
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    try {
      if (window.JotForm && typeof JotForm.triggerCondition === 'function') {
        JotForm.triggerCondition(input);
      }
    } catch (e) {}
  }

  function option(select, value, label) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  }

  function styleSelect(select) {
    select.className = 'form-dropdown dynamic-dropdown-fallback-select';
    select.style.width = '100%';
    select.style.maxWidth = '400px';
    select.style.height = '40px';
    select.style.marginBottom = '8px';
  }

  function buildField(id) {
    var hidden = document.getElementById('input_' + id);
    var settings = document.getElementById('widget_settings_' + id);
    var frame = document.getElementById('customFieldFrame_' + id);
    var container = document.getElementById('cid_' + id);
    if (!hidden || !settings || !container) return false;

    var listText = decodeSettings(settings);
    var counties = parseHierarchy(listText);
    if (!counties.length) return false;

    var widget = frame ? frame.parentNode : container.querySelector('[data-widget-name="Dynamic Dropdowns"]');
    if (!widget) return false;

    if (widget.querySelector('.dynamic-dropdown-fallback')) return true;

    if (frame) {
      frame.style.display = 'none';
      frame.src = 'about:blank';
    }

    var wrap = document.createElement('div');
    wrap.className = 'dynamic-dropdown-fallback';
    wrap.setAttribute('data-field-id', String(id));

    var countySelect = document.createElement('select');
    var districtSelect = document.createElement('select');
    var schoolSelect = document.createElement('select');

    styleSelect(countySelect);
    styleSelect(districtSelect);
    styleSelect(schoolSelect);

    countySelect.setAttribute('aria-label', 'County');
    districtSelect.setAttribute('aria-label', 'District');
    schoolSelect.setAttribute('aria-label', 'School');

    option(countySelect, '', 'Select County');
    option(districtSelect, '', 'Select District');
    option(schoolSelect, '', 'Select School');

    if (REQUIRED_IDS[id]) {
      countySelect.required = true;
      districtSelect.required = true;
      schoolSelect.required = true;
    }

    counties.forEach(function (c, idx) {
      option(countySelect, String(idx), c.name);
    });

    function resetDistricts() {
      districtSelect.innerHTML = '';
      option(districtSelect, '', 'Select District');
      schoolSelect.innerHTML = '';
      option(schoolSelect, '', 'Select School');
    }

    function resetSchools() {
      schoolSelect.innerHTML = '';
      option(schoolSelect, '', 'Select School');
    }

    function syncValue() {
      var ci = countySelect.value;
      var di = districtSelect.value;
      var si = schoolSelect.value;

      if (ci === '' || di === '' || si === '') {
        hidden.value = '';
      } else {
        var c = counties[Number(ci)];
        var d = c && c.districts[Number(di)];
        var school = d && d.schools[Number(si)];
        hidden.value = c && d && school ? (c.name + d.name + school) : '';
      }

      hidden.setAttribute('data-custom-fallback-value', hidden.value);
      dispatchFieldEvents(hidden);
    }

    countySelect.addEventListener('change', function () {
      resetDistricts();
      var c = counties[Number(countySelect.value)];
      if (c) {
        c.districts.forEach(function (d, idx) {
          option(districtSelect, String(idx), d.name);
        });
      }
      syncValue();
    });

    districtSelect.addEventListener('change', function () {
      resetSchools();
      var c = counties[Number(countySelect.value)];
      var d = c && c.districts[Number(districtSelect.value)];
      if (d) {
        d.schools.forEach(function (school, idx) {
          option(schoolSelect, String(idx), school);
        });
      }
      syncValue();
    });

    schoolSelect.addEventListener('change', syncValue);

    wrap.appendChild(countySelect);
    wrap.appendChild(districtSelect);
    wrap.appendChild(schoolSelect);

    widget.insertBefore(wrap, widget.firstChild);
    return true;
  }

  function init() {
    FIELD_IDS.forEach(buildField);

    var form = document.getElementById('261096398003054');
    if (form && !form.getAttribute('data-dynamic-fallback-bound')) {
      form.setAttribute('data-dynamic-fallback-bound', '1');
      form.addEventListener('submit', function (event) {
        var firstInvalid = null;
        FIELD_IDS.forEach(function (id) {
          if (!REQUIRED_IDS[id]) return;
          var wrap = document.querySelector('.dynamic-dropdown-fallback[data-field-id="' + id + '"]');
          if (!wrap) return;
          var selects = wrap.querySelectorAll('select');
          for (var i = 0; i < selects.length; i++) {
            if (!selects[i].value && !firstInvalid) firstInvalid = selects[i];
          }
        });

        if (firstInvalid) {
          event.preventDefault();
          event.stopPropagation();
          firstInvalid.reportValidity();
          firstInvalid.focus();
        }
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