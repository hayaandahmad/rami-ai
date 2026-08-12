/**
 * Rami — Google Apps Script persistence backend.
 *
 * Bound to the Rami Google Sheet (Extensions -> Apps Script).
 * Deployed as a Web App that Rami's Next.js server calls via
 * POST /api/interview/save (never called directly from the browser).
 *
 * Expected tabs: "questions" (seeded manually, never written here),
 * "answers", "sessions" (both managed by this script).
 *
 * Setup:
 *   1. Project Settings -> Script Properties -> add RAMI_SHEETS_SECRET
 *      with a long random value. This must match RAMI_SHEETS_SECRET in
 *      Rami's server environment.
 *   2. Deploy -> New deployment -> Web app
 *        Execute as: Me
 *        Who has access: Anyone with the link
 *   3. Copy the Web App URL into RAMI_SHEETS_WEBHOOK_URL.
 */

var ANSWERS_SHEET_NAME = "answers";
var SESSIONS_SHEET_NAME = "sessions";

var ANSWERS_HEADERS = [
  "document_id",
  "document_type",
  "question_id",
  "answer_field",
  "section_id",
  "question_text",
  "value",
  "is_tbc",
  "is_follow_up",
  "created_at",
  "updated_at",
];

var SESSIONS_HEADERS = [
  "document_id",
  "document_title",
  "document_type",
  "beneficiary",
  "status",
  "progress_percent",
  "interview_completed",
  "started_at",
  "updated_at",
  "completed_at",
];

/**
 * Single entry point for Rami's save contract:
 *   { secret, answer?, session }
 */
function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);

    if (!isValidSecret_(request.secret)) {
      return jsonResponse_({ ok: false, error: "Invalid or missing secret." });
    }

    if (!request.session) {
      return jsonResponse_({ ok: false, error: "Missing required 'session' payload." });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

      if (request.answer) {
        upsertAnswer_(spreadsheet, request.answer);
      }

      upsertSession_(spreadsheet, request.session);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({ ok: true });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function isValidSecret_(providedSecret) {
  var expectedSecret = PropertiesService.getScriptProperties().getProperty(
    "RAMI_SHEETS_SECRET",
  );
  return !!expectedSecret && providedSecret === expectedSecret;
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

/**
 * Returns the 1-based sheet row index matching all key columns, or -1.
 * Assumes row 1 is the header row.
 */
function findRowByKey_(sheet, keyColumns, keyValues) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var columnIndexes = keyColumns.map(function (columnName) {
    return headers.indexOf(columnName);
  });

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var isMatch = true;

    for (var k = 0; k < columnIndexes.length; k++) {
      if (String(row[columnIndexes[k]]) !== String(keyValues[k])) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return i + 2; // +1 for 0-index -> 1-index, +1 for header row
    }
  }

  return -1;
}

/**
 * Upserts one row into "answers" keyed by document_id + question_id.
 * Preserves created_at on updates; always refreshes updated_at.
 * Must be called while holding the script lock.
 */
function upsertAnswer_(spreadsheet, answer) {
  var sheet = getOrCreateSheet_(spreadsheet, ANSWERS_SHEET_NAME, ANSWERS_HEADERS);
  var rowIndex = findRowByKey_(
    sheet,
    ["document_id", "question_id"],
    [answer.documentId, answer.questionId],
  );

  var now = new Date().toISOString();
  var createdAt = now;

  if (rowIndex !== -1) {
    var existingRow = sheet.getRange(rowIndex, 1, 1, ANSWERS_HEADERS.length).getValues()[0];
    var createdAtIndex = ANSWERS_HEADERS.indexOf("created_at");
    createdAt = existingRow[createdAtIndex] || now;
  }

  var row = [
    answer.documentId,
    answer.documentType,
    answer.questionId,
    answer.answerField,
    answer.sectionId,
    answer.questionText,
    answer.value,
    answer.isTbc,
    answer.isFollowUp,
    createdAt,
    now,
  ];

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

/**
 * Upserts one row into "sessions" keyed by document_id.
 * Preserves started_at (and completed_at once set) on updates;
 * always refreshes updated_at. Sets completed_at when the session
 * transitions to interviewCompleted = true.
 * Must be called while holding the script lock.
 */
function upsertSession_(spreadsheet, session) {
  var sheet = getOrCreateSheet_(spreadsheet, SESSIONS_SHEET_NAME, SESSIONS_HEADERS);
  var rowIndex = findRowByKey_(sheet, ["document_id"], [session.documentId]);

  var now = new Date().toISOString();
  var startedAt = now;
  var completedAt = session.interviewCompleted ? now : "";

  if (rowIndex !== -1) {
    var existingRow = sheet.getRange(rowIndex, 1, 1, SESSIONS_HEADERS.length).getValues()[0];
    var startedAtIndex = SESSIONS_HEADERS.indexOf("started_at");
    var completedAtIndex = SESSIONS_HEADERS.indexOf("completed_at");
    startedAt = existingRow[startedAtIndex] || now;
    completedAt = existingRow[completedAtIndex] || completedAt;
  }

  var row = [
    session.documentId,
    session.documentTitle,
    session.documentType,
    session.beneficiary,
    session.status,
    session.progressPercent,
    session.interviewCompleted,
    startedAt,
    now,
    completedAt,
  ];

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}
