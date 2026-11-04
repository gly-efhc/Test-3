import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.EFHC_BROWSER_TOOLS||import.meta.url)('playwright-core');
const base=process.env.EFHC_REACT_URL||'http://127.0.0.1:19240/Test-3/';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+\/Test-3\/$/);
const directory=process.env.EFHC_PARITY_ARTIFACTS||'/tmp/efhc-demo-functions';await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}}),results=[],failures=[],errors=[];
await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
page.on('dialog',dialog=>dialog.accept());
page.on('pageerror',e=>errors.push(e.message));
const key='efhc:react:unified-demo:v893';
const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
async function load(route=''){await page.goto(base+route);await page.waitForFunction(()=>window.__EFHC_DEMO_READ_ONLY__===true);await page.waitForFunction(()=>Boolean(document.querySelector('.efhc-game-header'))||Boolean(document.querySelector('[data-browser-shop-page]')));}
async function check(name,run){try{await run();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){failures.push({name,error:e.message});console.error('FAIL',name,e.message);await page.screenshot({path:path.join(directory,`demo-fail-${failures.length}.png`),fullPage:true});}}
try{
 await check('actual Pages bootstrap and shared 60-panel model',async()=>{await load();await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'null')?.server,key);assert.equal((await state()).accounts['0000657667'].panels.filter(p=>p.is_active).length,60);});
 await check('panel generated amount advances locally without business API polling',async()=>{
  await load('panels/portfolio/');await page.waitForSelector('[data-panel-card-field="generated-kwh"] .tabular-nums');
  const cell=page.locator('[data-panel-card-field="generated-kwh"] .tabular-nums').first(),before=await cell.innerText();await page.waitForTimeout(1400);assert.notEqual(await cell.innerText(),before);
  await page.screenshot({path:path.join(directory,'demo-live-panels.png'),fullPage:true});
 });
 await check('USER activation creates one panel and debits exactly 100 EFHC',async()=>{
  await load('panels/');const before=await state(),a=before.accounts[before.selected_global_id];
  await page.locator('[data-panel-activation-cta]').click();await page.waitForFunction(k=>{const s=JSON.parse(localStorage.getItem(k)||'null');return s.accounts[s.selected_global_id].activated_panels===1;},key);
  const after=await state(),b=after.accounts[after.selected_global_id];
  const d=v=>BigInt(v.replace('.',''));assert.equal(d(a.main_balance)+d(a.bonus_balance)-d(b.main_balance)-d(b.bonus_balance),10000000000n);
 });
 await check('Admin opt-in and real transfer form update the same USER balance',async()=>{
  await load('admin/');await page.locator('[data-demo-admin-mode]').waitFor();
  await page.locator('[data-demo-admin-mode]').click();await load('admin/users/?global_id=0000657667');await page.getByPlaceholder('Global ID',{exact:true}).fill('0000657667');await page.getByRole('button',{name:'Найти',exact:true}).click();
  await page.getByRole('button',{name:/^Средства/}).click();
  const form=page.locator('[data-eam-family="EAM-ADMIN-010"]').filter({hasText:'Перевести / забрать средства'});
  await form.getByLabel('Назначение',{exact:true}).selectOption('main');await form.getByLabel('Сумма EFHC',{exact:true}).fill('2.12345678');await form.getByLabel('Комментарий',{exact:true}).fill('Демо проверка');
  const before=(await state()).accounts['0000657667'].main_balance;
  await form.locator('input[type=checkbox]').check();await form.getByRole('button',{name:'Перевести',exact:true}).click();
  await page.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).accounts['0000657667'].main_balance!==before,{key,before});
  const after=(await state()).accounts['0000657667'].main_balance;const d=v=>BigInt(v.replace('.',''));assert.equal(d(after)-d(before),212345678n);
 });
 await check('Tasks settle without a subscription/refetch loop',async()=>{await load('tasks/');await page.waitForFunction(()=>document.body.innerText.includes('Задания'));await page.waitForTimeout(1500);assert.ok((await page.locator('body').innerText()).includes('Задания'));assert.ok(!(await page.locator('body').innerText()).includes('Не удалось загрузить задачи'));});
 for(const route of ['admin/','admin/bank/','admin/bonuses/','admin/reports/','admin/ads/','admin/panels/','admin/tasks/','admin/hub/','admin/referrals/','admin/shop/','admin/vip-nft/','admin/efhc-deposits/','admin/system/','admin/diagnostics/','admin/withdrawals/','admin/sale-packages/','admin/emergency/','admin/logs/','admin/user-history/','admin/api-workbench/'])await check(`render ${route}`,async()=>{
  await load(route);await page.waitForSelector('[data-admin-route]');await page.waitForTimeout(350);assert.ok(!/Application error|Что-то пошло не так/.test(await page.locator('body').innerText()));assert.equal(errors.length,0,errors.join('\n'));
 });
 await page.screenshot({path:path.join(directory,'demo-admin-workbench.png'),fullPage:true});
 await check('reload preserves operations and selected DEMO role',async()=>{await page.reload();await page.waitForSelector('[data-demo-admin-mode]');const s=await state();assert.equal(s.role,'superadmin');assert.equal(s.accounts['0000657667'].activated_panels,1);assert.equal(s.server.audit.filter(x=>x.reason==='Демо проверка').length,1);});
 await fs.writeFile(path.join(directory,'demo-functions.json'),JSON.stringify({results,failures,errors},null,2));assert.equal(failures.length,0,JSON.stringify(failures));
}finally{await browser.close();}
