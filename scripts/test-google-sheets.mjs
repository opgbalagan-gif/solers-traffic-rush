import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const rows = [], cache = new Map(), properties = new Map([['SIGNING_KEY','only-for-tests'],['SPREADSHEET_ID','test-sheet']]);
const sheet = {
  getLastRow: () => rows.length + 1,
  appendRow: row => rows.push(row),
  getRange(row, col, count, columns) {
    return {
      getValues: () => rows.slice(row - 2, row - 2 + count).map(r => r.slice(col - 1, col - 1 + columns)),
      createTextFinder: value => ({ matchEntireCell() { return this; }, findNext() { const index = rows.findIndex(r => r[4] === value); return index < 0 ? null : { getRow: () => index + 2 }; } }),
    };
  },
};
let busy = false;
const runtime = vm.createContext({
  console, Date,
  PropertiesService: { getScriptProperties: () => ({getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value)}) },
  CacheService: {getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)})},
  LockService: {getScriptLock:()=>({tryLock:()=>!busy,releaseLock:()=>{}})},
  SpreadsheetApp: {openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},
  Utilities: {getUuid:randomUUID,computeHmacSha256Signature:(message,key)=>createHmac('sha256',key).update(message).digest(),base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url')},
  ContentService: {MimeType:{JSON:'application/json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},
});
vm.runInContext(readFileSync('server/google-sheets/Code.gs','utf8'), runtime);
const post = body => runtime.doPost({postData:{contents:JSON.stringify(body)}});
const get = action => runtime.doGet({parameter:{action}});
const first = post({action:'runs'}), second = post({action:'runs'});
assert(first.token && second.token && first.id !== second.id);
const result = {...first,action:'scores',name:'Пилот 1',score:12,distance:15};
assert.equal(post(result).saved,true);
assert.equal(post(result).saved,true); assert.equal(rows.length,1,'Network retries do not duplicate a score');
assert(post({...result,score:13}).error);
assert(post({...second,action:'scores',name:'=IMPORTXML(1)',score:1,distance:1}).error,'Spreadsheet formulas cannot be injected');
assert(post({...second,action:'scores',name:'Пилот 2',score:999999,distance:1}).error);
assert(post({...second,token:second.token+'x',action:'scores',name:'Пилот 2',score:1,distance:1}).error);
assert.equal(post({...second,action:'scores',name:'Пилот 2',score:20,distance:18}).saved,true);
const leaders=get('leaderboard'); assert.equal(leaders.rows.length,2); assert.equal(leaders.rows[0].name,'Пилот 2');
assert(!JSON.stringify(leaders).includes(first.id)); assert(!JSON.stringify(leaders).includes(first.token));
assert.equal(get('config').phoneReady,false);
busy=true; assert(post({action:'runs'}).error); busy=false;
assert(runtime.doPost({postData:{contents:'['}}).error);
console.log('PASS: independent players share ranked results; signatures, bounds, formula rejection, idempotency and private identifiers verified with an isolated Sheet mock.');
