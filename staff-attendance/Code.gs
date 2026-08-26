const CONTRACTED_SUPPORT_CONFIG = {
  spreadsheetId: '1kVyG7PObhpg4GgprhOOKoxVDsRVYZLZCdsXxt0o7EX0',
  excludedSheets: ['TIMEENTERED'],
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
  const cacheKey = 'contracted-support-v2-all-agency-tabs';
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Rebuild if a cache entry cannot be parsed.
    }
  }

  const spreadsheet = SpreadsheetApp.openById(CONTRACTED_SUPPORT_CONFIG.spreadsheetId);
  const employees = [];
  const seenIds = new Set();
  const agencyCounts = {};

  spreadsheet.getSheets().forEach(function (sheet) {
    const sheetName = clean_(sheet.getName());

    // TimeEntered is an operational tab, not an agency roster.
    if (CONTRACTED_SUPPORT_CONFIG.excludedSheets.indexOf(sheetName.toUpperCase()) !== -1) {
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 1) return;

    // Only inspect A:D. This intentionally prevents fields such as PHONE/PIN
    // from ever being exposed by the public web feed.
    const values = sheet.getRange(1, 1, Math.max(lastRow, 1), 4).getDisplayValues();
    if (!values.length) return;

    const headers = values[0].map(normalizeHeader_);
    const positionIndex = findHeaderIndex_(headers, ['POSITION']);
    const lastNameIndex = findHeaderIndex_(headers, ['LAST NAME', 'LASTNAME']);
    const firstNameIndex = findHeaderIndex_(headers, ['FIRST NAME', 'FIRSTNAME']);
    const idIndex = findHeaderIndex_(headers, ['ID#', 'ID #', 'ID']);

    // A tab is treated as an agency roster only when it has the roster headers.
    if (lastNameIndex < 0 || firstNameIndex < 0 || idIndex < 0) return;

    agencyCounts[sheetName] = 0;

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      const id = clean_(row[idIndex]);
      const firstName = clean_(row[firstNameIndex]);
      const lastName = clean_(row[lastNameIndex]);
      const position = positionIndex >= 0 ? clean_(row[positionIndex]) : '';

      if (!id || (!firstName && !lastName)) continue;

      // IDs are the unique key. If an accidental duplicate exists, keep the first.
      const normalizedId = id.toUpperCase();
      if (seenIds.has(normalizedId)) continue;
      seenIds.add(normalizedId);

      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      employees.push({
        id: id,
        firstName: firstName,
        lastName: lastName,
        fullName: fullName,
        agency: sheetName,
        position: position,
        label: id + ' — ' + fullName
      });

      agencyCounts[sheetName] += 1;
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
    version: 2,
    generatedAt: new Date().toISOString(),
    employeeCount: employees.length,
    agencyCounts: agencyCounts,
    employees: employees,
    choices: employees.map(function (employee) {
      return employee.label;
    })
  };

  cache.put(cacheKey, JSON.stringify(result), CONTRACTED_SUPPORT_CONFIG.cacheSeconds);
  return result;
}

function findHeaderIndex_(headers, acceptedNames) {
  for (let i = 0; i < headers.length; i += 1) {
    if (acceptedNames.indexOf(headers[i]) !== -1) return i;
  }
  return -1;
}

function normalizeHeader_(value) {
  return clean_(value).toUpperCase();
}

function clean_(value) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}
