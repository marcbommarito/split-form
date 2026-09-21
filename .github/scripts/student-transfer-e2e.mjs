import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = 'https://marcbommarito.github.io/split-form/student-transfer/';
const FORM_ID = '261096398003054';
const results = {
  startedAt: new Date().toISOString(),
  url: URL,
  console: [],
  pageErrors: [],
  requestFailures: [],
  submitResponses: [],
  beforeSubmit: null,
  afterSubmit: null,
  success: false
};

const executablePath =
  process.env.CHROME_PATH ||
  '/usr/bin/google-chrome';

const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
page.setDefaultTimeout(30000);

page.on('console', msg => {
  results.console.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', err => {
  results.pageErrors.push(String(err && err.stack || err));
});
page.on('requestfailed', req => {
  results.requestFailures.push({
    url: req.url(),
    method: req.method(),
    failure: req.failure()
  });
});
page.on('response', async res => {
  if (res.url().includes('submit.jotform.com/submit/' + FORM_ID)) {
    results.submitResponses.push({
      url: res.url(),
      status: res.status(),
      headers: res.headers()
    });
  }
});

function logStep(name) {
  console.log('\n=== ' + name + ' ===');
}

async function setValue(selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(selector, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function selectByValue(selector, value) {
  await page.waitForSelector(selector, { visible: true });
  const selected = await page.select(selector, value);
  if (!selected.length) throw new Error('Could not select ' + value + ' in ' + selector);
}

async function check(selector) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
}

async function selectFallback(fieldId, countyIndex, districtIndex, schoolIndex) {
  const base = '.dynamic-dropdown-fallback[data-field-id="' + fieldId + '"] select';
  await page.waitForSelector(base, { visible: true });
  const sels = await page.$$(base);
  if (sels.length !== 3) throw new Error('Expected 3 fallback selects for field ' + fieldId + ', got ' + sels.length);
  await sels[0].select(String(countyIndex));
  await page.waitForFunction((id) => {
    const s = document.querySelectorAll('.dynamic-dropdown-fallback[data-field-id="' + id + '"] select');
    return s.length === 3 && s[1].options.length > 1;
  }, {}, fieldId);
  await sels[1].select(String(districtIndex));
  await page.waitForFunction((id) => {
    const s = document.querySelectorAll('.dynamic-dropdown-fallback[data-field-id="' + id + '"] select');
    return s.length === 3 && s[2].options.length > 1;
  }, {}, fieldId);
  await sels[2].select(String(schoolIndex));
}

try {
  logStep('Open live form');
  const resp = await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  console.log('Page HTTP:', resp && resp.status(), page.url());

  await page.waitForSelector('#' + FORM_ID, { visible: true });
  await page.waitForSelector('.dynamic-dropdown-fallback[data-field-id="76"]', { visible: true });
  await page.waitForSelector('#native_date_7', { visible: true });
  await page.waitForFunction(() => !!document.querySelector('script[src*="submit-rescue.js?v=2026-09-21-1"]'));

  logStep('Fill required fields');
  await selectByValue('#input_68', 'Transfer Request NEW');
  await setValue('#first_61', 'TEST-DO-NOT-PROCESS');
  await setValue('#last_61', 'ChatGPT');
  await selectByValue('#input_60', '5');
  await setValue('#native_date_7', '2015-01-01');

  await setValue('#first_62', 'TEST-DO-NOT-PROCESS');
  await setValue('#last_62', 'Parent');
  await setValue('#input_8_addr_line1', '123 Test Street');
  await setValue('#input_8_city', 'Menifee');
  await setValue('#input_8_state', 'CA');
  await setValue('#input_8_postal', '92584');
  await selectByValue('#input_8_country', 'United States');
  await setValue('#input_10_full', '(951) 555-0100');
  await setValue('#input_11', 'test@example.com');

  // Riverside County > Menifee Union School District
  // School indexes: 0 Preschool, 1 Callie, 2 Chester, 3 Evans.
  await selectFallback(76, 0, 0, 1);
  await selectFallback(85, 0, 0, 1);
  await selectFallback(87, 0, 0, 3);

  await check('#input_65_1'); // IEP No
  await check('#input_66_1'); // 504 No
  await check('#input_79_0'); // continuing at current school
  await check('#input_96_1'); // expulsion No

  await page.waitForTimeout(500);

  results.beforeSubmit = await page.evaluate(() => {
    const form = document.getElementById('261096398003054');
    const invalid = Array.from(form.querySelectorAll(':invalid')).map(el => ({
      id: el.id,
      name: el.name,
      type: el.type,
      value: el.value,
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    }));
    const fv = id => (document.getElementById(id) || {}).value || '';
    return {
      url: location.href,
      checkValidity: form.checkValidity(),
      invalid,
      q76: fv('input_76'),
      q85: fv('input_85'),
      q87: fv('input_87'),
      dob: {
        native: fv('native_date_7'),
        lite: fv('lite_mode_7'),
        month: fv('month_7'),
        day: fv('day_7'),
        year: fv('year_7')
      },
      reasonChecked: Array.from(document.querySelectorAll('input[name="q79_reasonFor79[]"]:checked')).map(x => x.value),
      rescueLoaded: !!document.querySelector('script[src*="submit-rescue.js"]'),
      rescueBound: form.dataset.submitRescueBound || '',
      buttonDisabled: document.getElementById('input_41').disabled,
      buttonText: document.getElementById('input_41').textContent
    };
  });
  console.log('Before submit:', JSON.stringify(results.beforeSubmit, null, 2));

  await page.screenshot({ path: 'before-submit.png', fullPage: true });

  if (!results.beforeSubmit.checkValidity) {
    throw new Error('Browser reports invalid controls before submit: ' + JSON.stringify(results.beforeSubmit.invalid));
  }

  logStep('Click actual Submit button');
  const oldUrl = page.url();
  await page.click('#input_41');

  try {
    await page.waitForFunction(
      (old) => location.href !== old || document.body.innerText.match(/thank you|submission|success/i),
      { timeout: 30000 },
      oldUrl
    );
  } catch (e) {
    console.log('No navigation/success text within 30 seconds.');
  }

  await page.waitForTimeout(2000);

  results.afterSubmit = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    bodyText: document.body ? document.body.innerText.slice(0, 2500) : '',
    button: document.getElementById('input_41') ? {
      disabled: document.getElementById('input_41').disabled,
      text: document.getElementById('input_41').textContent
    } : null,
    submitError: (document.getElementById('student-transfer-submit-error') || {}).textContent || '',
    reasonError: (document.getElementById('student-transfer-reason-error') || {}).textContent || ''
  }));

  await page.screenshot({ path: 'after-submit.png', fullPage: true });

  const submitOk = results.submitResponses.some(r => r.status >= 200 && r.status < 400);
  const movedOffPage = results.afterSubmit.url !== URL;
  const successText = /thank you|submitted|submission received|successfully/i.test(results.afterSubmit.bodyText || '');
  results.success = submitOk || movedOffPage || successText;

  console.log('Submit responses:', JSON.stringify(results.submitResponses, null, 2));
  console.log('After submit:', JSON.stringify(results.afterSubmit, null, 2));
  console.log('SUCCESS=', results.success);

  if (!results.success) {
    throw new Error('Submit did not produce a successful POST/navigation.');
  }
} catch (err) {
  results.error = String(err && err.stack || err);
  console.error(results.error);
  try { await page.screenshot({ path: 'failure.png', fullPage: true }); } catch {}
  process.exitCode = 1;
} finally {
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync('e2e-result.json', JSON.stringify(results, null, 2));
  await browser.close();
}
