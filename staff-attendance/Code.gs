const CONTRACTED_SUPPORT_CONFIG = {
  spreadsheetId: '1kVyG7PObhpg4GgprhOOKoxVDsRVYZLZCdsXxt0o7EX0',
  attendanceSpreadsheetId: '1FxTrczEQlUoGUQJJTszgazKFotIAfBmvFa4yoCoQqqs',
  attendanceSheetName: 'TimeEntry',
  reconciliationSheetName: 'TimeEntered',
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Attendance')
    .addItem('Refresh billing reconciliation', 'syncAttendanceReconciliation')
    .addItem('Install hourly refresh', 'installAttendanceSyncTrigger')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONTRACTED_SUPPORT_CONFIG.reconciliationSheetName) return;

  const a1 = e.range.getA1Notation();
  if (['B2', 'D2', 'F2', 'H2'].indexOf(a1) === -1) return;

  SpreadsheetApp.flush();
  refreshAttendanceFilter_();
}

function installAttendanceSyncTrigger() {
  const handler = 'syncAttendanceReconciliation';

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyHours(1)
    .create();

  syncAttendanceReconciliation();
}

function syncAttendanceReconciliation() {
  const targetSpreadsheet = SpreadsheetApp.openById(CONTRACTED_SUPPORT_CONFIG.spreadsheetId);
  const attendanceSpreadsheet = SpreadsheetApp.openById(CONTRACTED_SUPPORT_CONFIG.attendanceSpreadsheetId);
  const sourceSheet = attendanceSpreadsheet.getSheetByName(CONTRACTED_SUPPORT_CONFIG.attendanceSheetName);

  if (!sourceSheet) {
    throw new Error('Attendance source tab not found: ' + CONTRACTED_SUPPORT_CONFIG.attendanceSheetName);
  }

  let targetSheet = targetSpreadsheet.getSheetByName(CONTRACTED_SUPPORT_CONFIG.reconciliationSheetName);
  if (!targetSheet) {
    targetSheet = targetSpreadsheet.insertSheet(CONTRACTED_SUPPORT_CONFIG.reconciliationSheetName);
  }

  const roster = buildRosterIndex_(targetSpreadsheet);
  const lastSourceRow = sourceSheet.getLastRow();

  if (lastSourceRow < 2) {
    setupAttendanceReconciliationLayout_(targetSheet, roster.agencies, []);
    clearAttendanceDataRows_(targetSheet);
    refreshAttendanceFilter_();
    return;
  }

  const sourceValues = sourceSheet.getRange(1, 1, lastSourceRow, 10).getDisplayValues();
  const headers = sourceValues[0].map(normalizeHeader_);

  const nameIndex = findHeaderIndex_(headers, ['ENTER NAME OR ID NUMBER']);
  const dateIndex = findHeaderIndex_(headers, ['DATE']);
  const timeIndex = findHeaderIndex_(headers, ['TIME']);
  const locationIndex = findHeaderIndex_(headers, ['GEOLOCATION']);
  const actionIndex = findHeaderIndex_(headers, ['SIGN IN/OUT', 'SIGN IN / OUT']);
  const submissionIdIndex = findHeaderIndex_(headers, ['SUBMISSION ID']);

  if (nameIndex < 0 || dateIndex < 0 || timeIndex < 0 || actionIndex < 0) {
    throw new Error('Attendance source does not contain the expected name/date/time/sign-in-out headers.');
  }

  const groups = {};

  for (let rowIndex = 1; rowIndex < sourceValues.length; rowIndex += 1) {
    const row = sourceValues[rowIndex];
    const rawName = clean_(row[nameIndex]);
    const dateParts = parseAttendanceDate_(row[dateIndex]);
    const minutes = parseAttendanceTimeMinutes_(row[timeIndex]);
    const action = normalizeHeader_(row[actionIndex]);

    if (!dateParts || minutes == null || (action !== 'SIGN IN' && action !== 'SIGN OUT')) {
      continue;
    }

    const match = matchAttendanceEmployee_(rawName, roster);
    const dateKey = dateParts.key;
    const identityKey = match.employee ? match.employee.id.toUpperCase() : 'RAW:' + normalizePersonName_(rawName);
    const groupKey = identityKey + '|' + dateKey;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        dateParts: dateParts,
        employee: match.employee,
        rawNames: {},
        locations: {},
        signIns: [],
        signOuts: [],
        submissionCount: 0,
        submissionIds: {}
      };
    }

    const group = groups[groupKey];

    if (rawName) group.rawNames[rawName] = true;

    const location = locationIndex >= 0 ? clean_(row[locationIndex]) : '';
    if (location) group.locations[location] = true;

    if (action === 'SIGN IN') {
      group.signIns.push(minutes);
    } else {
      group.signOuts.push(minutes);
    }

    const submissionId = submissionIdIndex >= 0 ? clean_(row[submissionIdIndex]) : '';
    if (submissionId) {
      if (!group.submissionIds[submissionId]) {
        group.submissionIds[submissionId] = true;
        group.submissionCount += 1;
      }
    } else {
      group.submissionCount += 1;
    }
  }

  const records = Object.keys(groups).map(function (key) {
    return buildAttendanceRecord_(groups[key]);
  });

  records.sort(function (a, b) {
    return (
      a.dateValue.getTime() - b.dateValue.getTime() ||
      a.agency.localeCompare(b.agency) ||
      a.employeeName.localeCompare(b.employeeName) ||
      a.employeeId.localeCompare(b.employeeId)
    );
  });

  setupAttendanceReconciliationLayout_(targetSheet, roster.agencies, records);
  writeAttendanceRecords_(targetSheet, records);
  refreshAttendanceFilter_();
}

function buildAttendanceRecord_(group) {
  const signIns = group.signIns.slice().sort(function (a, b) { return a - b; });
  const signOuts = group.signOuts.slice().sort(function (a, b) { return a - b; });
  const signIn = signIns.length ? signIns[0] : null;
  const signOut = signOuts.length ? signOuts[signOuts.length - 1] : null;
  const employee = group.employee;

  const flags = [];
  if (!employee) flags.push('Unmatched roster');
  if (!signIns.length) flags.push('Missing Sign In');
  if (!signOuts.length) flags.push('Missing Sign Out');
  if (signIns.length > 1) flags.push('Multiple Sign Ins');
  if (signOuts.length > 1) flags.push('Multiple Sign Outs');
  if (signIn != null && signOut != null && signOut < signIn) flags.push('Sign Out before Sign In');

  const status = flags.length ? flags.join('; ') : 'Complete';
  const rawNames = Object.keys(group.rawNames).sort();

  return {
    dateValue: new Date(group.dateParts.year, group.dateParts.month - 1, group.dateParts.day, 12, 0, 0),
    agency: employee ? employee.agency : 'UNMATCHED',
    employeeId: employee ? employee.id : '',
    employeeName: employee ? employee.fullName : (rawNames[0] || ''),
    position: employee ? employee.position : '',
    signInMinutes: signIn,
    signOutMinutes: signOut,
    hours: signIn != null && signOut != null && signOut >= signIn ? Math.round(((signOut - signIn) / 60) * 100) / 100 : '',
    locations: Object.keys(group.locations).sort().join(' | '),
    status: status,
    signInCount: signIns.length,
    signOutCount: signOuts.length,
    rawNames: rawNames.join(' | '),
    submissionCount: group.submissionCount
  };
}

function writeAttendanceRecords_(sheet, records) {
  clearAttendanceDataRows_(sheet);

  if (!records.length) return;

  const rows = records.map(function (record, index) {
    const rowNumber = index + 6;
    const signInValue = record.signInMinutes == null ? '' : record.signInMinutes / 1440;
    const signOutValue = record.signOutMinutes == null ? '' : record.signOutMinutes / 1440;
    const showFormula = '=IF(AND(A' + rowNumber + '>=$B$2,A' + rowNumber + '<=$D$2,' +
      'OR($F$2="ALL",B' + rowNumber + '=$F$2),' +
      'OR($H$2="ALL",AND($H$2="EXCEPTIONS",J' + rowNumber + '<>"Complete"),' +
      'ISNUMBER(SEARCH($H$2,J' + rowNumber + ')))),"SHOW","HIDE")';

    return [
      record.dateValue,
      record.agency,
      record.employeeId,
      record.employeeName,
      record.position,
      signInValue,
      signOutValue,
      record.hours,
      record.locations,
      record.status,
      record.signInCount,
      record.signOutCount,
      record.rawNames,
      record.submissionCount,
      showFormula
    ];
  });

  const range = sheet.getRange(6, 1, rows.length, 15);
  range.setValues(rows);

  sheet.getRange(6, 1, rows.length, 1).setNumberFormat('mm/dd/yyyy');
  sheet.getRange(6, 6, rows.length, 2).setNumberFormat('h:mm AM/PM');
  sheet.getRange(6, 8, rows.length, 1).setNumberFormat('0.00');

  const statusBackgrounds = records.map(function (record) {
    return [record.status === 'Complete' ? '#D9EAD3' : '#FCE5CD'];
  });
  sheet.getRange(6, 10, rows.length, 1).setBackgrounds(statusBackgrounds);
}

function clearAttendanceDataRows_(sheet) {
  const rowsToClear = Math.max(sheet.getMaxRows() - 5, 1);
  sheet.getRange(6, 1, rowsToClear, 15).clearContent();
  sheet.getRange(6, 10, rowsToClear, 1).setBackground(null);
}

function setupAttendanceReconciliationLayout_(sheet, agencies, records) {
  const existingStart = sheet.getRange('B2').getValue();
  const existingEnd = sheet.getRange('D2').getValue();
  const existingAgency = clean_(sheet.getRange('F2').getDisplayValue()) || 'ALL';
  const existingStatus = clean_(sheet.getRange('H2').getDisplayValue()) || 'ALL';

  sheet.getRange('A1').setValue('Attendance Billing Reconciliation');
  sheet.getRange('A2').setValue('Billing Start');
  sheet.getRange('C2').setValue('Billing End');
  sheet.getRange('E2').setValue('Agency');
  sheet.getRange('G2').setValue('Status');
  sheet.getRange('I2').setValue('Use the date controls and filters below to match a vendor billing window.');
  sheet.getRange('A3').setValue('One row per employee per workday. Earliest Sign In and latest Sign Out are shown. Historical name mismatches and duplicate/missing punches are flagged for review.');

  const headers = [[
    'Work Date', 'Agency', 'Employee ID', 'Employee Name', 'Position',
    'Sign In', 'Sign Out', 'Hours', 'Location', 'Status',
    'Sign In Count', 'Sign Out Count', 'Raw Name(s)', 'Submission Count', 'Show?'
  ]];
  sheet.getRange(5, 1, 1, 15).setValues(headers);

  if (!(existingStart instanceof Date) && records.length) {
    sheet.getRange('B2').setValue(records[0].dateValue);
  }
  if (!(existingEnd instanceof Date) && records.length) {
    sheet.getRange('D2').setValue(records[records.length - 1].dateValue);
  }
  sheet.getRange('F2').setValue(existingAgency);
  sheet.getRange('H2').setValue(existingStatus);

  sheet.getRange('B2').setNumberFormat('mm/dd/yyyy');
  sheet.getRange('D2').setNumberFormat('mm/dd/yyyy');

  const agencyOptions = ['ALL'].concat(agencies).concat(['UNMATCHED']);
  const uniqueAgencyOptions = agencyOptions.filter(function (value, index, array) {
    return array.indexOf(value) === index;
  });

  sheet.getRange('B2').setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build()
  );
  sheet.getRange('D2').setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build()
  );
  sheet.getRange('F2').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(uniqueAgencyOptions, true).setAllowInvalid(false).build()
  );
  sheet.getRange('H2').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList([
      'ALL', 'EXCEPTIONS', 'Complete', 'Unmatched roster',
      'Missing Sign In', 'Missing Sign Out', 'Multiple Sign Ins',
      'Multiple Sign Outs', 'Sign Out before Sign In'
    ], true).setAllowInvalid(false).build()
  );

  if (!sheet.getRange('A1:O1').isPartOfMerge()) sheet.getRange('A1:O1').merge();
  if (!sheet.getRange('A3:O3').isPartOfMerge()) sheet.getRange('A3:O3').merge();

  sheet.setFrozenRows(5);
  sheet.hideColumns(15);

  sheet.getRange('A1:O1').setBackground('#EDEDED').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  sheet.getRange('A5:O5').setBackground('#E6E6E6').setFontWeight('bold').setWrap(true);
  sheet.getRange('A2:I2').setBackground('#F5F5F5');
  sheet.getRangeList(['A2', 'C2', 'E2', 'G2']).setFontWeight('bold');
  sheet.getRangeList(['B2', 'D2', 'F2', 'H2']).setFontColor('#0000FF');

  const widths = [95, 110, 105, 180, 85, 85, 85, 85, 220, 190, 90, 90, 220, 100];
  widths.forEach(function (width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
}

function refreshAttendanceFilter_() {
  const spreadsheet = SpreadsheetApp.openById(CONTRACTED_SUPPORT_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(CONTRACTED_SUPPORT_CONFIG.reconciliationSheetName);
  if (!sheet) return;

  const lastRow = Math.max(sheet.getLastRow(), 5);
  const existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();

  const filter = sheet.getRange(5, 1, lastRow - 4, 15).createFilter();
  const criteria = SpreadsheetApp.newFilterCriteria()
    .whenTextEqualTo('SHOW')
    .build();
  filter.setColumnFilterCriteria(15, criteria);
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
  const roster = buildRosterIndex_(spreadsheet);

  const employees = roster.employees.slice().sort(function (a, b) {
    return (
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName) ||
      a.id.localeCompare(b.id)
    );
  });

  const agencyCounts = {};
  employees.forEach(function (employee) {
    agencyCounts[employee.agency] = (agencyCounts[employee.agency] || 0) + 1;
  });

  const result = {
    version: 3,
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

function buildRosterIndex_(spreadsheet) {
  const employees = [];
  const byId = {};
  const byName = {};
  const seenIds = {};
  const agencies = [];

  spreadsheet.getSheets().forEach(function (sheet) {
    const sheetName = clean_(sheet.getName());

    if (CONTRACTED_SUPPORT_CONFIG.excludedSheets.indexOf(sheetName.toUpperCase()) !== -1) {
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 1) return;

    const values = sheet.getRange(1, 1, Math.max(lastRow, 1), 4).getDisplayValues();
    if (!values.length) return;

    const headers = values[0].map(normalizeHeader_);
    const positionIndex = findHeaderIndex_(headers, ['POSITION']);
    const lastNameIndex = findHeaderIndex_(headers, ['LAST NAME', 'LASTNAME']);
    const firstNameIndex = findHeaderIndex_(headers, ['FIRST NAME', 'FIRSTNAME']);
    const idIndex = findHeaderIndex_(headers, ['ID#', 'ID #', 'ID']);

    if (lastNameIndex < 0 || firstNameIndex < 0 || idIndex < 0) return;

    if (agencies.indexOf(sheetName) === -1) agencies.push(sheetName);

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      const id = clean_(row[idIndex]);
      const firstName = clean_(row[firstNameIndex]);
      const lastName = clean_(row[lastNameIndex]);
      const position = positionIndex >= 0 ? clean_(row[positionIndex]) : '';

      if (!id || (!firstName && !lastName)) continue;

      const normalizedId = id.toUpperCase();
      if (seenIds[normalizedId]) continue;
      seenIds[normalizedId] = true;

      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      const employee = {
        id: id,
        firstName: firstName,
        lastName: lastName,
        fullName: fullName,
        agency: sheetName,
        position: position,
        label: id + ' — ' + fullName
      };

      employees.push(employee);
      byId[normalizedId] = employee;

      const normalizedName = normalizePersonName_(fullName);
      if (!byName[normalizedName]) byName[normalizedName] = [];
      byName[normalizedName].push(employee);
    }
  });

  agencies.sort();

  return {
    employees: employees,
    byId: byId,
    byName: byName,
    agencies: agencies
  };
}

function matchAttendanceEmployee_(rawName, roster) {
  const cleaned = clean_(rawName);
  if (!cleaned) return { employee: null, method: 'blank' };

  const idMatch = cleaned.toUpperCase().match(/^([A-Z]+-\d+)/);
  if (idMatch && roster.byId[idMatch[1]]) {
    return { employee: roster.byId[idMatch[1]], method: 'id' };
  }

  let nameOnly = cleaned;
  if (idMatch) {
    nameOnly = clean_(cleaned.substring(idMatch[0].length).replace(/^[\s\-—]+/, ''));
  }

  const normalizedName = normalizePersonName_(nameOnly);
  const matches = roster.byName[normalizedName] || [];
  if (matches.length === 1) {
    return { employee: matches[0], method: 'exact-name' };
  }

  return { employee: null, method: 'unmatched' };
}

function parseAttendanceDate_(value) {
  const text = clean_(value);
  if (!text) return null;

  let match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  let year;
  let month;
  let day;

  if (match) {
    month = Number(match[1]);
    day = Number(match[2]);
    year = Number(match[3]);
  } else {
    match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return {
    year: year,
    month: month,
    day: day,
    key: year + '-' + pad2_(month) + '-' + pad2_(day)
  };
}

function parseAttendanceTimeMinutes_(value) {
  const text = clean_(value).toUpperCase();
  if (!text) return null;

  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3] || '';

  if (minute < 0 || minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === 'AM' && hour === 12) hour = 0;
    if (ampm === 'PM' && hour !== 12) hour += 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

function normalizePersonName_(value) {
  return clean_(value).toUpperCase();
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

function pad2_(value) {
  return String(value).padStart(2, '0');
}

function clean_(value) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}
