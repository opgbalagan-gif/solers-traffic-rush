import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
if(!existsSync('out/index.html')){console.error('Сначала выполните pnpm build');process.exit(1);}
const env={...process.env,WRANGLER_LOG_PATH:resolve('.wrangler/logs'),WRANGLER_SEND_METRICS:'false',MINIFLARE_REGISTRY_PATH:resolve('.wrangler/registry')};
const cli=resolve('node_modules/wrangler/bin/wrangler.js');
const migration=spawnSync(process.execPath,[cli,'d1','migrations','apply','DB','--local'],{stdio:'inherit',env});
if(migration.status!==0)process.exit(migration.status??1);
const lan=process.argv.includes('--lan');
if(lan)for(const [adapter,addresses] of Object.entries(networkInterfaces()))for(const address of addresses??[]){
  if(address.family==='IPv4'&&!address.internal&&!/tun|vpn|virtual/i.test(adapter))console.log(`Для телефона в той же сети: http://${address.address}:4173/`);
}
const server=spawn(process.execPath,[cli,'dev','--config','wrangler.jsonc','--no-bundle','--ip',lan?'0.0.0.0':'127.0.0.1','--port','4173','--show-interactive-dev-session=false'],{stdio:'inherit',env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.kill(signal));
server.on('exit',code=>process.exit(code??0));
