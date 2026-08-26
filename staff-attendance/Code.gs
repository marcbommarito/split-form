const CONTRACTED_SUPPORT_CONFIG = {
  spreadsheetId: '1kVyG7PObhpg4GgprhOOKoxVDsRVYZLZCdsXxt0o7EX0',
  allowedSheets: [
    'AMERGIS ',
    'BAT',
    'BRIGHT BEE',
    'SOLIANT',
    'STEPPING STONES',
    'RO HEALTH'
  ],
  cacheSeconds: 300
};

function doGet() {
  const data = getContractedSupportData_();
  const javascript = 'window.CONTRACTED_SUPPORT_DATA = ' + JSON.stringify(data) + ';';

  return ContentService
    .createTextOutput(javascript)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getContractedSupportData_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'contracted-support-v1';
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Ignore a bad cache entry and rebuild from the spreadsheet.
    }
  }

  const spreadsheet = SpreadsheetApp.openById(CONTRACTED_SUPPORT_CONFIG.spreadsheetId);
  const employees = [];
  const seenIds = new Set();

  CONTRACTED_SUPPORT_CONFIG.allowedSheets.forEach(function (sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // Read only the four public fields used by the attendance selector:
    // Position, Last Name, First Name, and ID#. Do not expose Phone/PIN.
    const values = sheet.getRange(1, 1, lastRow, 4).getDisplayValues();
    const headers = values[0].map(normalizeHeader_);

    const positionIndex = headers.indexOf('POSITION');
    const lastNameIndex = headers.indexOf('LAST NAME');
    const firstNameIndex = headers.indexOf('FIRST NAME');
    const idIndex = headers.indexOf('ID#');

    if (lastNameIndex < 0 || firstNameIndex < 0 || idIndex < 0) return;

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      const id = clean_(row[idIndex]);
      const firstName = clean_(row[firstNameIndex]);
      const lastName = clean_(row[lastNameIndex]);
      const position = positionIndex >= 0 ? clean_(row[positionIndex]) : '';

      if (!id || (!firstName && !lastName)) continue;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      employees.push({
        id: id,
        firstName: firstName,
        lastName: lastName,
        fullName: fullName,
        agency: clean_(sheetName),
        position: position,
        label: id + ' — ' + fullName
      });
    }
  });

  employees.sort(function (a, b) {
    return (
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName) ||
      a.id.localeCompare(b.id)
    );
  });

  const result = {
    version: 1,
    generatedAt: new Date().toISOString(),
    employeeCount: employees.length,
    employees: employees,
    choices: employees.map(function (employee) {
      return employee.label;
    })
  };

  cache.put(cacheKey, JSON.stringify(result), CONTRACTED_SUPPORT_CONFIG.cacheSeconds);
  return result;
}

function normalizeHeader_(value) {
  return clean_(value).toUpperCase();
}

function clean_(value) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}
