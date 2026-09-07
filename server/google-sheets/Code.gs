/* SOLLERS Traffic Rush: private storage, public score API. */
var LIMIT = 50;
var HEADERS = ['Позывной', 'Очки', 'Дистанция, м', 'Дата', 'ID заезда'];

function setupLeaderboard() {
  var properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('SIGNING_KEY')) properties.setProperty('SIGNING_KEY', Utilities.getUuid() + Utilities.getUuid());
  var id = properties.getProperty('SPREADSHEET_ID');
  if (!id) {
    var spreadsheet = SpreadsheetApp.create('SOLLERS Traffic Rush — результаты');
    properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
    var sheet = spreadsheet.getSheets()[0];
    sheet.setName('Результаты');
    sheet.getRange(1, 1, 1, 5).setValues([HEADERS]).setFontWeight('bold').setBackground('#17242e').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 210);
    sheet.setColumnWidths(2, 2, 135);
    sheet.setColumnWidth(4, 180);
    sheet.setColumnWidth(5, 300);
    sheet.getRange('B:C').setNumberFormat('0');
    sheet.getRange('D:D').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    SpreadsheetApp.flush();
    id = spreadsheet.getId();
  }
  console.log('https://docs.google.com/spreadsheets/d/' + id + '/edit');
  return id;
}

function scoreSheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Таблица результатов пока не подключена.');
  return SpreadsheetApp.openById(id).getSheetByName('Результаты');
}

function output_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function signature_(id, startedAt) {
  var key = PropertiesService.getScriptProperties().getProperty('SIGNING_KEY');
  if (!key) throw new Error('Таблица результатов пока не подключена.');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(id + '.' + startedAt, key)).replace(/=+$/, '');
}

function sameSignature_(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function newRun_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Сервер занят. Попробуйте ещё раз.');
  try {
    var cache = CacheService.getScriptCache();
    var bucket = 'starts:' + Math.floor(Date.now() / 60000);
    var count = Number(cache.get(bucket) || 0);
    if (count >= 300) throw new Error('Много новых заездов. Попробуйте через минуту.');
    cache.put(bucket, String(count + 1), 120);
  } finally { lock.releaseLock(); }
  var id = Utilities.getUuid(), now = Date.now();
  return {id: id, token: now + '.' + signature_(id, now)};
}

function validateScore_(body, now) {
  if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.id) || typeof body.token !== 'string') throw new Error('Заезд не найден. Начните новый заезд.');
  var token = body.token.split('.');
  var startedAt = Number(token[0]);
  if (token.length !== 2 || !Number.isSafeInteger(startedAt) || startedAt > now || now - startedAt > 86400000 || !sameSignature_(token[1], signature_(body.id, startedAt))) throw new Error('Срок заезда истёк. Начните новый заезд.');
  var seconds = (now - startedAt) / 1000;
  var name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 20 || /^[=+@\-]/.test(name) || /[<>\x00-\x1f]/.test(name)) throw new Error('Позывной: 2–20 символов, без служебных знаков в начале.');
  if (!Number.isInteger(body.score) || body.score < 0 || body.score > seconds * 18 + 30 || !Number.isInteger(body.distance) || body.distance < 0 || body.distance > seconds * 70 + 20) throw new Error('Не удалось подтвердить результат заезда.');
  return name;
}

function saveScore_(body) {
  var now = Date.now(), name = validateScore_(body, now);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Таблица занята. Повторите сохранение.');
  try {
    var sheet = scoreSheet_();
    var previous = sheet.getLastRow() > 1 ? sheet.getRange(2, 5, sheet.getLastRow() - 1, 1).createTextFinder(body.id).matchEntireCell(true).findNext() : null;
    if (previous) {
      var existing = sheet.getRange(previous.getRow(), 1, 1, 3).getValues()[0];
      if (existing[0] !== name || existing[1] !== body.score || existing[2] !== body.distance) throw new Error('Этот заезд уже сохранён.');
      return {saved: true};
    }
    sheet.appendRow([name, body.score, body.distance, new Date(now), body.id]);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove('leaderboard');
    return {saved: true};
  } finally { lock.releaseLock(); }
}

function leaderboard_() {
  var cache = CacheService.getScriptCache(), cached = cache.get('leaderboard');
  if (cached) return JSON.parse(cached);
  var sheet = scoreSheet_();
  var data = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues() : [];
  data = data.filter(function(row) { return typeof row[0] === 'string' && Number.isFinite(row[1]) && Number.isFinite(row[2]); });
  data.sort(function(a, b) { return b[1] - a[1] || new Date(a[3]).getTime() - new Date(b[3]).getTime(); });
  var result = {rows: data.slice(0, LIMIT).map(function(row, i) { return {rank: i + 1, name: row[0], score: row[1], distance: row[2]}; }), updatedAt: new Date().toISOString()};
  cache.put('leaderboard', JSON.stringify(result), 10);
  return result;
}

function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'config') return output_({socialUrl: null, socialLabel: 'СОЦСЕТИ ДИЛЕРА', phoneReady: false, privacyUrl: null, continueMode: 'alternate'});
    if (action === 'leaderboard') return output_(leaderboard_());
    return output_({service: 'SOLLERS Traffic Rush', ready: Boolean(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'))});
  } catch (error) { return output_({error: error.message || 'Сервер результатов недоступен.'}); }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || raw.length > 4096) throw new Error('Некорректный запрос.');
    var body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Некорректный запрос.');
    if (body.action === 'runs') return output_(newRun_());
    if (body.action === 'scores') return output_(saveScore_(body));
    throw new Error('Действие недоступно.');
  } catch (error) { return output_({error: error.message || 'Не удалось сохранить результат.'}); }
}
