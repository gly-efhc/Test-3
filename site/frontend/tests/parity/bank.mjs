import {localPagesBase} from './pages-base.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.EFHC_BROWSER_TOOLS||import.meta.url)('playwright-core');
const base=localPagesBase(),key='efhc:react:unified-demo:v893';
const directory=process.env.EFHC_PARITY_ARTIFACTS||'/tmp/efhc-bank';await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],results=[];
await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const amount=series=>page.locator(`[data-series="${series}"] .efhc-admin-bank-map-v179_amount`);
const fields={reserve:'reserve_efhc',circulation:'circulation_efhc','panel-new-obligations':'new_obligations_efhcm',main:'users_main_efhc',bonus:'users_bonus_efhc',actual:'actual_mass_efhc','panel-obligations':'fixed_obligations_efhcm','panel-spend':'panel_spent_efhc','panel-generated':'generated_kwh','panel-converted':'converted_kwh','panel-pending-conversion':'pending_kwh'};
const normalize=text=>text.replace(/\s/g,'').replace(/−/g,'-').replace(/EFHCm|EFHCb|EFHC|kWh/g,'');
async function check(name,run){await run();results.push({name,status:'PASS'});console.log('PASS',name);}
async function ready(){await page.waitForSelector('[data-bank-state="ready"]',{state:'attached'});await page.locator('.efhc-entry-splash[aria-hidden="false"]').waitFor({state:'hidden'});}
try{
 await page.goto(base+'admin/bank/');await ready();
 await check('all eleven Bank rows render the complete persisted D8 snapshot',async()=>{
  const s=await state(),f=s.server.bank_snapshot.facts;assert.ok(Object.keys(s.accounts).length>=1000,'same fixture users as the Admin table');
  assert.equal(await page.locator('[data-series]').count(),11);
  for(const [series,field]of Object.entries(fields))assert.equal(normalize(await amount(series).innerText()),f['bank_metrics_'+field],series);
  assert.equal(await page.locator('[data-integrity-ok]').getAttribute('data-integrity-ok'),'true');
 });
 await check('manual Bank refresh completes without a request/subscription loop',async()=>{
  await page.evaluate(()=>{window.__bankWrites=0;window.addEventListener('efhc:demo:state-changed',()=>window.__bankWrites++);});
  await page.getByRole('button',{name:'Обновить',exact:true}).first().click();await ready();
  await page.waitForTimeout(600);const writes=await page.evaluate(()=>window.__bankWrites);await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>window.__bankWrites),writes,'no recursive reads/writes');assert.ok(writes<10);
 });
 await check('a real deposit in a second USER tab updates the open Bank without reload',async()=>{
  const before=(await state()).server.bank_snapshot.facts.bank_metrics_users_main_efhc;
  const user=await context.newPage();await user.goto(base);await user.waitForSelector('.efhc-game-header');
  await user.locator('[data-action="Deposit"]').click();await user.locator('[data-direct-deposit-amount]').fill('2.12345678');
  await user.locator('[data-direct-deposit-action="send-efhc-jetton"]').click();await user.waitForSelector('[data-direct-deposit-status="confirmed"]');
  const after=(await state()).server.bank_snapshot.facts.bank_metrics_users_main_efhc;
  assert.equal(BigInt(after.replace('.',''))-BigInt(before.replace('.','')),212345678n);
  await page.waitForFunction(({key})=>{
   const f=JSON.parse(localStorage.getItem(key)).server.bank_snapshot.facts;
   return document.querySelector('[data-series="main"] .efhc-admin-bank-map-v179_amount')?.textContent.replace(/\s|EFHCm/g,'')===f.bank_metrics_users_main_efhc;
  },{key});
  assert.equal(await page.locator('[data-integrity-ok]').getAttribute('data-integrity-ok'),'true');await user.close();
 });
 await check('Bank reload preserves the operation and complete data',async()=>{const before=(await state()).server.bank_snapshot.facts.bank_metrics_users_main_efhc;await page.reload();await ready();assert.equal(normalize(await amount('main').innerText()),before);assert.equal(errors.length,0,errors.join('\n'));});
 await page.screenshot({path:path.join(directory,'bank-complete.png'),fullPage:true});
}catch(error){await page.screenshot({path:path.join(directory,'bank-failure.png'),fullPage:true});throw error;}
finally{await fs.writeFile(path.join(directory,'bank.json'),JSON.stringify({results,errors},null,2));await browser.close();}
