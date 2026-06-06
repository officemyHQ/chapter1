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
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          name: data[i][2] || username,
          email: data[i][0]
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

    // Check Chapter 2
    var ch2Sheet = ss.getSheetByName('Chapter 2 Responses');
    if (ch2Sheet) {
      var ch2Data = ch2Sheet.getDataRange().getValues();
      // Columns: Timestamp(0), Name(1), Email(2), Q1(3), Q2(4), Q3(5), Q4(6)
      // Scan bottom-up to get the most recent submission
      for (var i = ch2Data.length - 1; i >= 1; i--) {
        if (String(ch2Data[i][2]).toLowerCase() === String(email).toLowerCase()) {
          return ContentService.createTextOutput(JSON.stringify({
            found: true,
            chapter: 'Chapter 2',
            answers: {
              q1: ch2Data[i][3] || '',
              q2: ch2Data[i][4] || '',
              q3: ch2Data[i][5] || '',
              q4: ch2Data[i][6] || ''
            }
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    // Check Chapter 1
    var ch1Sheet = ss.getSheetByName('Chapter 1 Responses');
    if (ch1Sheet) {
      var ch1Data = ch1Sheet.getDataRange().getValues();
      // Columns: Timestamp(0), Name(1), Email(2), Q1(3), Q2(4), Q3(5), Q4(6), Q5(7)
      for (var j = ch1Data.length - 1; j >= 1; j--) {
        if (String(ch1Data[j][2]).toLowerCase() === String(email).toLowerCase()) {
          return ContentService.createTextOutput(JSON.stringify({
            found: true,
            chapter: 'Chapter 1',
            answers: {
              q1: ch1Data[j][3] || '',
              q2: ch1Data[j][4] || '',
              q3: ch1Data[j][5] || '',
              q4: ch1Data[j][6] || '',
              q5: ch1Data[j][7] || ''
            }
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ found: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'admin') {
    var key = e.parameter.key;
    if (key !== 'myHQBuddyadmin') {
      return ContentService.createTextOutput(JSON.stringify({ success: false }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Build user map from username sheet
    // Columns: A=email/username, B=password, C=display name
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

    // Mark Ch1 submissions
    var ch1Sheet = ss.getSheetByName('Chapter 1 Responses');
    if (ch1Sheet) {
      var ch1Data = ch1Sheet.getDataRange().getValues();
      for (var r = 1; r < ch1Data.length; r++) {
        var rowEmail = String(ch1Data[r][2]).toLowerCase().trim();
        if (users[rowEmail]) {
          users[rowEmail].ch1 = true;
          users[rowEmail].ch1_submitted_at = ch1Data[r][0] ? new Date(ch1Data[r][0]).toISOString() : null;
        }
      }
    }

    // Mark Ch2 submissions
    var ch2Sheet = ss.getSheetByName('Chapter 2 Responses');
    if (ch2Sheet) {
      var ch2Data = ch2Sheet.getDataRange().getValues();
      for (var r = 1; r < ch2Data.length; r++) {
        var rowEmail = String(ch2Data[r][2]).toLowerCase().trim();
        if (users[rowEmail]) {
          users[rowEmail].ch2 = true;
          users[rowEmail].ch2_submitted_at = ch2Data[r][0] ? new Date(ch2Data[r][0]).toISOString() : null;
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
      data.timestamp || new Date().toISOString(),
      data.name || '—',
      data.email || '—',
      data.q1 || '',
      data.q2 || '',
      data.q3 || '',
      data.q4 || ''
    ];
    if (sheetName === 'Chapter 1 Responses') row.push(data.q5 || '');

    sheet.appendRow(row);
    return ContentService.createTextOutput('OK');
  } catch(err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
