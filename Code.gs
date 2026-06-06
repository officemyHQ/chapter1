function doGet(e) {
  var action = e.parameter.action;

  if (action === 'debug') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets().map(function(s) { return s.getName(); });
    return ContentService.createTextOutput(JSON.stringify({ sheets: sheets }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'login') {
    var username = e.parameter.username;
    var password = e.parameter.password;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('username');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === username && String(data[i][1]) === String(password)) {
        var name = data[i][2] || username;
        var email = data[i][0];
        var course = data[i][3] || 'Beginner Course';

        upsertUserProgress(ss, email, name, course);

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          name: name,
          email: email,
          course: course
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getProgress') {
    var email = e.parameter.email;
    if (!email) {
      return ContentService.createTextOutput(JSON.stringify({ found: false }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = { found: false, ch1: null, ch2: null };

    var ch1Sheet = ss.getSheetByName('Chapter 1 Responses');
    if (ch1Sheet) {
      var ch1Data = ch1Sheet.getDataRange().getValues();
      for (var j = ch1Data.length - 1; j >= 1; j--) {
        if (String(ch1Data[j][2]).toLowerCase() === String(email).toLowerCase()) {
          result.found = true;
          result.ch1 = {
            q1: ch1Data[j][3] || '',
            q2: ch1Data[j][4] || '',
            q3: ch1Data[j][5] || '',
            q4: ch1Data[j][6] || '',
            q5: ch1Data[j][7] || ''
          };
          break;
        }
      }
    }

    var ch2Sheet = ss.getSheetByName('Chapter 2 Responses');
    if (ch2Sheet) {
      var ch2Data = ch2Sheet.getDataRange().getValues();
      for (var i = ch2Data.length - 1; i >= 1; i--) {
        if (String(ch2Data[i][2]).toLowerCase() === String(email).toLowerCase()) {
          result.found = true;
          result.ch2 = {
            q1: ch2Data[i][3] || '',
            q2: ch2Data[i][4] || '',
            q3: ch2Data[i][5] || '',
            q4: ch2Data[i][6] || ''
          };
          break;
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'admin') {
    var key = e.parameter.key;
    if (key !== 'myHQBuddyadmin') {
      return ContentService.createTextOutput(JSON.stringify({ success: false }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var userSheet = ss.getSheetByName('username');
    var userData = userSheet.getDataRange().getValues();
    var users = {};
    for (var i = 1; i < userData.length; i++) {
      var email = String(userData[i][0]).toLowerCase().trim();
      if (!email) continue;
      users[email] = {
        name: userData[i][2] || userData[i][0],
        email: userData[i][0],
        course: userData[i][3] || 'Beginner Course',
        ch1: false,
        ch1_submitted_at: null,
        ch2: false,
        ch2_submitted_at: null
      };
    }

    var ch1Sheet = ss.getSheetByName('Chapter 1 Responses');
    if (ch1Sheet) {
      var ch1Data = ch1Sheet.getDataRange().getValues();
      for (var r = 1; r < ch1Data.length; r++) {
        var rowEmail = String(ch1Data[r][2]).toLowerCase().trim();
        if (users[rowEmail]) {
          users[rowEmail].ch1 = true;
          users[rowEmail].ch1_submitted_at = ch1Data[r][0] ? String(ch1Data[r][0]) : null;
        }
      }
    }

    var ch2Sheet = ss.getSheetByName('Chapter 2 Responses');
    if (ch2Sheet) {
      var ch2Data = ch2Sheet.getDataRange().getValues();
      for (var r = 1; r < ch2Data.length; r++) {
        var rowEmail = String(ch2Data[r][2]).toLowerCase().trim();
        if (users[rowEmail]) {
          users[rowEmail].ch2 = true;
          users[rowEmail].ch2_submitted_at = ch2Data[r][0] ? String(ch2Data[r][0]) : null;
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, users: users }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput('OK');
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var sheetName = data.chapter === 'Chapter 2' ? 'Chapter 2 Responses' : 'Chapter 1 Responses';
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      if (sheetName === 'Chapter 2 Responses') {
        sheet.appendRow(['Timestamp', 'Name', 'Email', 'Q1', 'Q2', 'Q3', 'Q4']);
      } else {
        sheet.appendRow(['Timestamp', 'Name', 'Email', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
      }
    }

    var row = [
      data.timestamp || nowIST(),
      data.name || '—',
      data.email || '—',
      data.q1 || '',
      data.q2 || '',
      data.q3 || '',
      data.q4 || ''
    ];
    if (sheetName === 'Chapter 1 Responses') row.push(data.q5 || '');

    sheet.appendRow(row);

    // Update User Progress tab
    if (data.email && data.email !== '—') {
      var progressSheet = getOrCreateProgressSheet(ss);
      var progressData = progressSheet.getDataRange().getValues();
      var emailLower = String(data.email).toLowerCase().trim();
      var userRow = -1;
      for (var i = 1; i < progressData.length; i++) {
        if (String(progressData[i][0]).toLowerCase().trim() === emailLower) {
          userRow = i + 1; // 1-indexed sheet row
          break;
        }
      }
      var now = nowIST();
      if (userRow > 0) {
        if (sheetName === 'Chapter 1 Responses') {
          progressSheet.getRange(userRow, 5).setValue('Submitted'); // Ch1 Status
          progressSheet.getRange(userRow, 6).setValue(now);         // Ch1 Submitted At
        } else {
          progressSheet.getRange(userRow, 7).setValue('Submitted'); // Ch2 Status
          progressSheet.getRange(userRow, 8).setValue(now);         // Ch2 Submitted At
        }
      }
    }

    return ContentService.createTextOutput('OK');
  } catch(err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}

function nowIST() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');
}

function upsertUserProgress(ss, email, name, course) {
  var sheet = getOrCreateProgressSheet(ss);
  var data = sheet.getDataRange().getValues();
  var emailLower = String(email).toLowerCase().trim();
  var now = nowIST();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().trim() === emailLower) {
      // Existing user — update Last Login only
      sheet.getRange(i + 1, 4).setValue(now);
      return;
    }
  }

  // New user — append row with blank chapter statuses
  sheet.appendRow([email, name, course, now, 'Not submitted', '', 'Not submitted', '']);
}

function getOrCreateProgressSheet(ss) {
  var sheet = ss.getSheetByName('User Progress');
  if (!sheet) {
    sheet = ss.insertSheet('User Progress');
    sheet.appendRow(['Email', 'Name', 'Course', 'Last Login', 'Ch1 Status', 'Ch1 Submitted At', 'Ch2 Status', 'Ch2 Submitted At']);
  }
  return sheet;
}
