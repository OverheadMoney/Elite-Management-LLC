/**
 * Elite Management — intake web app
 * Receives briefs POSTed from elitemgmt.io, logs each to a Google Sheet,
 * emails the brief to the inbox, and sends the prospect a confirmation.
 *
 * Standalone script. On first run it creates 'Elite Management — Inquiries' in Drive and stores its id.
 * Deploy: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone.
 * Paste the /exec URL into index.html as INTAKE_URL and set the same FORM_TOKEN in both places.
 * Run sheetUrl() any time to get the spreadsheet link.
 */

var CONFIG = {
  INBOX: 'value@elitemgmt.io',                 // where briefs are delivered
  FROM_NAME: 'Elite Management',
  SHEET_NAME: 'Inquiries',                     // tab name inside the bound spreadsheet
  FORM_TOKEN: '9eeba2924ae448c7864cb597cde7a286550524027570ba2c', // must match INTAKE_TOKEN in index.html
  SEND_CONFIRMATION: true,
  MAX_FIELD: 5000                              // characters per text field
};

var HEADERS = ['Received', 'Name', 'Title', 'Company', 'Industry', 'Email', 'Phone',
  'Revenue', 'Team', 'Current state', 'Future goals', 'Areas', 'Timing', 'Source', 'Status'];

/** Health check: open the /exec URL in a browser. */
function doGet() {
  return json_({ ok: true, service: 'elitemgmt-intake', time: new Date().toISOString() });
}

/** Form submissions. Body is JSON sent as text/plain (keeps the request "simple", no CORS preflight). */
function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    var body;
    try { body = JSON.parse(raw); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }

    if (body.website) return json_({ ok: true, ignored: true });          // honeypot filled → silently drop
    if (CONFIG.FORM_TOKEN && body.token !== CONFIG.FORM_TOKEN) return json_({ ok: false, error: 'unauthorized' });

    var d = clean_(body);
    var problems = validate_(d);
    if (problems.length) return json_({ ok: false, error: 'invalid', fields: problems });

    var receivedAt = new Date();
    var rowNumber = appendRow_(receivedAt, d);
    notifyInbox_(d, receivedAt, rowNumber);
    if (CONFIG.SEND_CONFIRMATION) confirmProspect_(d);

    return json_({ ok: true, id: rowNumber });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server', message: String(err && err.message || err) });
  }
}

/* ---------- helpers ---------- */

function clean_(b) {
  var s = function (v) { return String(v == null ? '' : v).trim().slice(0, CONFIG.MAX_FIELD); };
  return {
    name: s(b.name), title: s(b.title), company: s(b.company), industry: s(b.industry),
    email: s(b.email).toLowerCase(), phone: s(b.phone), revenue: s(b.revenue), team: s(b.team),
    currentState: s(b.currentState), futureGoals: s(b.futureGoals),
    areas: Array.isArray(b.areas) ? b.areas.map(s).filter(String).join(', ') : s(b.areas),
    timing: s(b.timing), source: s(b.source) || 'elitemgmt.io'
  };
}

function validate_(d) {
  var p = [];
  if (!d.name) p.push('name');
  if (!d.company) p.push('company');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) p.push('email');
  if (!d.currentState) p.push('currentState');
  if (!d.futureGoals) p.push('futureGoals');
  return p;
}

function spreadsheet_() {
  // Standalone script: create the log spreadsheet once in Drive and remember its id.
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* deleted — recreate */ } }
  var ss = SpreadsheetApp.create('Elite Management — Inquiries');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function sheet_() {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function appendRow_(when, d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    sh.appendRow([when, d.name, d.title, d.company, d.industry, d.email, d.phone, d.revenue, d.team,
      d.currentState, d.futureGoals, d.areas, d.timing, d.source, 'new']);
    return sh.getLastRow();
  } finally {
    lock.releaseLock();
  }
}

function briefText_(d, when, row) {
  var lines = [
    'NEW BRIEF — ' + d.company,
    'Received: ' + Utilities.formatDate(when, Session.getScriptTimeZone(), 'EEE, MMM d yyyy h:mm a z'),
    'Row: ' + row,
    '',
    'Name:     ' + d.name + (d.title ? ' (' + d.title + ')' : ''),
    'Company:  ' + d.company + (d.industry ? ' · ' + d.industry : ''),
    'Email:    ' + d.email,
    'Phone:    ' + (d.phone || '—'),
    'Revenue:  ' + (d.revenue || '—'),
    'Team:     ' + (d.team || '—'),
    'Timing:   ' + (d.timing || '—'),
    'Areas:    ' + (d.areas || '—'),
    '',
    'CURRENT STATE', d.currentState, '',
    'FUTURE GOALS', d.futureGoals
  ];
  return lines.join('\n');
}

function notifyInbox_(d, when, row) {
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/\n/g, '<br>'); };
  var rowsHtml = [
    ['Name', d.name + (d.title ? ' (' + d.title + ')' : '')], ['Company', d.company + (d.industry ? ' · ' + d.industry : '')],
    ['Email', d.email], ['Phone', d.phone || '—'], ['Revenue', d.revenue || '—'], ['Team', d.team || '—'],
    ['Timing', d.timing || '—'], ['Areas', d.areas || '—']
  ].map(function (r) { return '<tr><td style="padding:6px 12px 6px 0;color:#6e747d;font:12px/1.4 monospace;letter-spacing:.1em;text-transform:uppercase;vertical-align:top">' + r[0] + '</td><td style="padding:6px 0;font:15px/1.5 Helvetica,Arial,sans-serif;color:#111">' + esc(r[1]) + '</td></tr>'; }).join('');
  var html = '<div style="max-width:640px;font-family:Helvetica,Arial,sans-serif;color:#111">' +
    '<p style="font:11px/1 monospace;letter-spacing:.2em;color:#a8863f;text-transform:uppercase">Elite Management · New brief</p>' +
    '<h2 style="font-weight:500;margin:6px 0 18px">' + esc(d.company) + '</h2>' +
    '<table cellspacing="0" cellpadding="0">' + rowsHtml + '</table>' +
    '<h3 style="margin:24px 0 6px;font:12px/1 monospace;letter-spacing:.2em;color:#a8863f">CURRENT STATE</h3><p style="font-size:15px;line-height:1.55">' + esc(d.currentState) + '</p>' +
    '<h3 style="margin:24px 0 6px;font:12px/1 monospace;letter-spacing:.2em;color:#a8863f">FUTURE GOALS</h3><p style="font-size:15px;line-height:1.55">' + esc(d.futureGoals) + '</p>' +
    '<p style="margin-top:28px;font-size:12px;color:#6e747d">Logged to the Inquiries sheet, row ' + row + '. Reply to this email to answer ' + esc(d.name.split(' ')[0]) + ' directly.</p></div>';

  MailApp.sendEmail({
    to: CONFIG.INBOX,
    replyTo: d.email,
    name: CONFIG.FROM_NAME + ' Intake',
    subject: 'New brief: ' + d.company + ' — ' + d.name,
    body: briefText_(d, when, row),
    htmlBody: html
  });
}

function confirmProspect_(d) {
  var first = d.name.split(' ')[0];
  MailApp.sendEmail({
    to: d.email,
    replyTo: CONFIG.INBOX,
    name: CONFIG.FROM_NAME,
    subject: 'We received your brief — Elite Management',
    body: first + ',\n\nThank you. Your brief for ' + d.company + ' is in front of a principal at Elite Management. ' +
      'You will hear from us within two business days with clarifying questions and a proposed scope.\n\n' +
      'If anything changes in the meantime, reply to this email.\n\n— Elite Management\n' + CONFIG.INBOX + '\nelitemgmt.io'
  });
}

/** Prints the log spreadsheet URL. */
function sheetUrl() { Logger.log(spreadsheet_().getUrl()); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to grant Sheets + Mail permissions and prove the wiring. */
function selfTest() {
  var res = doPost({ postData: { contents: JSON.stringify({
    token: CONFIG.FORM_TOKEN, name: 'Self Test', title: 'Owner', company: 'Test Co', industry: 'Testing',
    email: Session.getActiveUser().getEmail() || CONFIG.INBOX, phone: '', revenue: '$1M – $5M', team: '11 – 50',
    currentState: 'Self-test submission from the Apps Script editor.', futureGoals: 'Confirm the intake wire works end to end.',
    areas: ['Operating diagnostic'], timing: 'Just researching', source: 'selfTest'
  }) } });
  Logger.log(res.getContent());
}
