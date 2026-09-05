const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:JSON_HEADERS});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const phoneValue=value=>{const digits=String(value??'').replace(/\D/g,'');return /^[78]\d{10}$/.test(digits)?'+7'+digits.slice(1):null;};
const configuredUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};
async function rateLimit(db,request,group,limit,now){
  const ip=request.headers.get('CF-Connecting-IP')||'local';
  const key=group+':'+await digest(ip)+':'+Math.floor(now/3600000);
  await db.prepare('INSERT INTO rate_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key,now+3600000).run();
  const row=await db.prepare('SELECT count FROM rate_limits WHERE key=?').bind(key).first();
  return row.count<=limit;
}
async function authorizedRun(db,body){
  if(typeof body.id!=='string'||typeof body.token!=='string'||body.id.length>80||body.token.length>100)return null;
  const run=await db.prepare('SELECT * FROM runs WHERE id=?').bind(body.id).first();
  if(!run||run.token_hash!==await digest(body.token)||run.finished_at)return null;
  return run;
}
export async function deliverLead(db,env,lead){
  const webhook=configuredUrl(env.CRM_WEBHOOK_URL);
  if(!webhook)return false;
  // A stable idempotency key lets the CRM receiver safely deduplicate retries.
  try{
    const response=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':lead.id,...(env.CRM_WEBHOOK_TOKEN?{'Authorization':'Bearer '+env.CRM_WEBHOOK_TOKEN}:{})},body:JSON.stringify({external_id:lead.id,source:'SOLLERS Traffic Rush',model:'ST9',phone:lead.phone,score:lead.score,consent:{accepted:true,at:new Date(lead.consent_at).toISOString(),version:lead.consent_version},created_at:new Date(lead.consent_at).toISOString()}),signal:AbortSignal.timeout(8000)});
    await db.prepare('UPDATE leads SET crm_status=?,attempts=attempts+1 WHERE id=?').bind(response.ok?'delivered':'pending',lead.id).run();
    return response.ok;
  }catch{await db.prepare('UPDATE leads SET attempts=attempts+1 WHERE id=?').bind(lead.id).run();return false;}
}
export async function handleApi(request,env,ctx={waitUntil:()=>{}}){
  const pathname=new URL(request.url).pathname, now=Date.now(),db=env.DB;
  if(pathname==='/api/config'&&request.method==='GET')return json({socialUrl:configuredUrl(env.SOCIAL_URL),socialLabel:env.SOCIAL_LABEL||'СОЦСЕТИ ДИЛЕРА',phoneReady:Boolean(configuredUrl(env.CRM_WEBHOOK_URL)&&configuredUrl(env.PRIVACY_URL)),privacyUrl:configuredUrl(env.PRIVACY_URL),continueMode:['alternate','phone-third','choice'].includes(env.CONTINUE_MODE)?env.CONTINUE_MODE:'alternate'});
  if(!db)return json({error:'Сервер результатов временно недоступен. Попробуйте позже.'},503);
  if(pathname==='/api/leaderboard'&&request.method==='GET'){
    const result=await db.prepare('SELECT name,score,distance FROM runs WHERE finished_at IS NOT NULL AND score IS NOT NULL ORDER BY score DESC,finished_at ASC LIMIT 20').all();
    return json({rows:result.results});
  }
  if(pathname.startsWith('/api/admin/')){
    if(!env.ADMIN_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.ADMIN_TOKEN)return json({error:'Нет доступа'},401);
    if(pathname==='/api/admin/leads'&&request.method==='GET'){
      const rows=await db.prepare('SELECT id,phone,consent_at,consent_version,score,crm_status,attempts FROM leads ORDER BY consent_at DESC LIMIT 100').all();return json({rows:rows.results});
    }
    if(pathname==='/api/admin/retry'&&request.method==='POST'){
      const rows=await db.prepare("SELECT * FROM leads WHERE crm_status='pending' AND attempts<20 LIMIT 10").all();
      const sent=await Promise.all(rows.results.map(lead=>deliverLead(db,env,lead)));return json({retried:sent.length,delivered:sent.filter(Boolean).length});
    }
    return json({error:'Не найдено'},404);
  }
  if(request.method!=='POST')return json({error:'Не найдено'},404);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'Недопустимый источник запроса'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Ожидается JSON'},415);
  if(Number(request.headers.get('Content-Length')||0)>4096)return json({error:'Слишком большой запрос'},413);
  const raw=await request.text();if(raw.length>4096)return json({error:'Слишком большой запрос'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Некорректные данные'},400);}
  if(!body||Array.isArray(body)||typeof body!=='object')return json({error:'Некорректные данные'},400);
  if(pathname==='/api/runs'){
    if(!await rateLimit(db,request,'runs',90,now))return json({error:'Слишком много заездов. Попробуйте позже.'},429);
    const id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
    await db.prepare('INSERT INTO runs(id,token_hash,started_at) VALUES (?,?,?)').bind(id,await digest(token),now).run();
    ctx.waitUntil(db.batch([db.prepare('DELETE FROM rate_limits WHERE expires<?').bind(now),db.prepare('DELETE FROM runs WHERE finished_at IS NULL AND started_at<?').bind(now-7*86400000)]));
    return json({id,token},201);
  }
  const run=await authorizedRun(db,body);if(!run)return json({error:'Заезд не найден или уже сохранён. Начните новый заезд.'},401);
  if(pathname==='/api/scores'){
    const name=String(body.name??'').trim();
    const seconds=Math.max(0,(now-run.started_at)/1000);
    if(name.length<2||name.length>20||/[<>\x00-\x1f]/.test(name))return json({error:'Введите позывной от 2 до 20 символов.'},400);
    if(!Number.isInteger(body.score)||body.score<0||body.score>seconds*18+30||!Number.isInteger(body.distance)||body.distance<0||body.distance>seconds*70+20)return json({error:'Не удалось подтвердить результат заезда.'},400);
    const result=await db.prepare('UPDATE runs SET name=?,score=?,distance=?,finished_at=? WHERE id=? AND finished_at IS NULL').bind(name,body.score,body.distance,now,run.id).run();
    if(!result.meta.changes)return json({error:'Результат уже сохранён.'},409);
    return json({saved:true});
  }
  if(pathname==='/api/leads'){
    if(!configuredUrl(env.CRM_WEBHOOK_URL)||!configuredUrl(env.PRIVACY_URL))return json({error:'Форма дилера пока не подключена.'},503);
    const phone=phoneValue(body.phone);
    if(!phone)return json({error:'Введите номер из 11 цифр, начиная с +7 или 8.'},400);
    if(body.consent!==true)return json({error:'Для отправки требуется согласие на обработку данных.'},400);
    if(!Number.isInteger(body.continuation)||body.continuation<1||body.continuation>100)return json({error:'Некорректное продолжение заезда.'},400);
    if(!await rateLimit(db,request,'leads',8,now))return json({error:'Слишком много заявок. Попробуйте позже.'},429);
    const id=run.id+':'+body.continuation;
    await db.prepare('INSERT OR IGNORE INTO leads(id,run_id,phone,consent_at,consent_version,score,crm_status) VALUES (?,?,?,?,?,?,?)').bind(id,run.id,phone,now,env.CONSENT_VERSION||'st9-lead-v1',Math.max(0,Math.min(1000000,Number(body.score)||0)),'pending').run();
    const lead=await db.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
    if(lead.crm_status!=='delivered')ctx.waitUntil(deliverLead(db,env,lead));
    return json({accepted:true});
  }
  return json({error:'Не найдено'},404);
}
const worker = {
  async fetch(request,env,ctx){
    try{
      if(new URL(request.url).pathname.startsWith('/api/'))return await handleApi(request,env,ctx);
      return env.ASSETS.fetch(request);
    }catch{return json({error:'Сервер временно недоступен. Повторите попытку.'},503);}
  },
};
export default worker;
