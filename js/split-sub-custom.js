(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    function normalize(value) {
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function parseMoney(value) {
      const cleaned = String(value || '').replace(/[^0-9.\-]/g, '');
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function roundMoney(value) {
      return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    function formatMoney(value) {
      if (!Number.isFinite(value)) return '';
      return roundMoney(value).toFixed(2);
    }

    function buildLabelInputMap() {
      const map = new Map();
      document.querySelectorAll('label[for]').forEach((label) => {
        const text = normalize(label.textContent);
        const inputId = label.getAttribute('for');
        const input = inputId ? document.getElementById(inputId) : null;
        if (text && input) {
          map.set(text, input);
        }
      });
      return map;
    }

    const inputByLabel = buildLabelInputMap();

    function findInput(labelText) {
      return inputByLabel.get(normalize(labelText)) || null;
    }

    function buildPeriodGroup(periodNumber) {
      const fields = [];
      for (let slot = 1; slot <= 5; slot += 1) {
        const field = findInput(`P${periodNumber} Employee Name ${slot}`);
        if (field) fields.push(field);
      }
      return {
        periodNumber,
        countField: findInput(`Period ${periodNumber} teachers`),
        fields
      };
    }

    const periodGroups = [1, 2, 3, 4, 5, 6].map(buildPeriodGroup);
    const sourceFields = periodGroups.flatMap((group) => group.fields);
    const sourceFieldIds = new Set(sourceFields.map((field) => field.id));

    const outputPairs = Array.from({ length: 10 }, (_, index) => {
      const n = index + 1;
      return {
        nameField: findInput(`Employee ${n}`),
        totalField: findInput(`Employee ${n} Total`),
        compensationField: findInput(`Employee ${n} Compensation`)
      };
    });

    const totalSplitField = findInput('Total that can Be split');

    function getFieldValue(field) {
      return field ? normalize(field.value) : '';
    }

    function setFieldValue(field, value) {
      if (!field) return;
      const nextValue = value == null ? '' : String(value);
      if (field.value === nextValue) return;
      field.value = nextValue;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function collectData() {
      const counts = new Map();
      const compensationByName = new Map();
      const totalSplit = parseMoney(getFieldValue(totalSplitField));
      const periodShare = totalSplit / 6;

      periodGroups.forEach((group) => {
        const names = group.fields
          .map((field) => getFieldValue(field))
          .filter(Boolean);

        names.forEach((name) => {
          counts.set(name, (counts.get(name) || 0) + 1);
        });

        const periodCount = names.length;
        const perPersonAmount = periodCount > 0 ? periodShare / periodCount : 0;

        names.forEach((name) => {
          compensationByName.set(name, (compensationByName.get(name) || 0) + perPersonAmount);
        });

        setFieldValue(group.countField, periodCount);
      });

      return {
        counts,
        compensationByName
      };
    }

    function recomputeAll() {
      const { counts, compensationByName } = collectData();

      const rows = Array.from(counts.entries())
        .map(([name, count]) => ({
          name,
          count,
          compensation: compensationByName.get(name) || 0
        }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          if (b.compensation !== a.compensation) return b.compensation - a.compensation;
          return a.name.localeCompare(b.name);
        })
        .slice(0, outputPairs.length);

      outputPairs.forEach((pair, index) => {
        const row = rows[index];
        setFieldValue(pair.nameField, row ? row.name : '');
        setFieldValue(pair.totalField, row ? row.count : '');
        setFieldValue(pair.compensationField, row ? formatMoney(row.compensation) : '');
      });

      // Leave Number of Staff Splitting and Amount Per Employee to Jotform conditional logic.
    }

    function isWatchedField(target) {
      return !!(target && target.id && (sourceFieldIds.has(target.id) || target.id === (totalSplitField && totalSplitField.id)));
    }

    ['input', 'change', 'blur'].forEach((eventName) => {
      document.addEventListener(eventName, function (event) {
        if (isWatchedField(event.target)) {
          window.setTimeout(recomputeAll, 0);
        }
      }, true);
    });

    window.setTimeout(recomputeAll, 0);
    window.setInterval(recomputeAll, 750);
  });
})();
