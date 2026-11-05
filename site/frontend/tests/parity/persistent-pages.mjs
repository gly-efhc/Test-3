import {localPagesBase} from './pages-base.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.EFHC_BROWSER_TOOLS||import.meta.url)('playwright-core');
const base=localPagesBase(),dir=process.env.EFHC_PARITY_ARTIFACTS||'/tmp/efhc-persistence-artifacts';
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
page.setDefaultTimeout(7000);
await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
await context.addInitScript(()=>{
 if(sessionStorage.getItem('efhc:test:clear-read-cache')){
  localStorage.removeItem('EFHC_USER_DATA_CACHE_V1');sessionStorage.removeItem('efhc:test:clear-read-cache');
 }
});
const errors=[],results=[],key='efhc:react:unified-demo:v893';page.on('pageerror',e=>errors.push(e.message));
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:e.message});console.error('FAIL '+name+': '+e.message);await page.screenshot({path:dir+'/persistent-failure-'+results.length+'.png',fullPage:true});}}
async function scenario(value){await page.evaluate(({key,value})=>{const s=JSON.parse(localStorage.getItem(key));s.scenario=value;localStorage.setItem(key,JSON.stringify(s));},{key,value});}
async function load(route=''){await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.waitForTimeout(350);}
try{
 await load();await page.waitForFunction(key=>!!localStorage.getItem(key),key);
 await check('first failed sync keeps complete Energy with zero values',async()=>{
  await scenario('error');await page.evaluate(()=>sessionStorage.setItem('efhc:test:clear-read-cache','1'));await load();
  await page.locator('.efhc-energy-stage').waitFor({state:'visible'});
  assert.equal((await page.locator('[data-energy-value-safe]').innerText()).trim(),'0.00000000');
  assert.equal(await page.locator('[data-energy-chip]').count(),3);
 });
 const routes=JSON.parse(await fs.readFile(new URL('../../src/reconstruction/demo-route-catalog-v893.json',import.meta.url))).filter(r=>!['/404','/500'].includes(r));
 for(const route of routes)await check('data failure preserves static page '+route,async()=>{
  await load(route==='/'?'':route.slice(1)+'/');
  if(['/admin/users','/admin/user-history'].includes(route)){await page.locator('[data-admin-user-profile]').waitFor({state:'visible'});assert.ok(await page.locator('[data-admin-global-id-search-canon] input').isVisible());assert.ok(await page.locator('.efhc-profile-topbar button').first().isVisible());}
  else if(route.startsWith('/admin')){await page.locator('[data-admin-primitive="page"]').waitFor({state:'visible'});assert.ok(await page.locator('[data-app-navigation="exit-admin"]').isVisible());}
  else if(route.startsWith('/browser-shop')){await page.locator('.efhc-shop-catalog-toolbar').waitFor({state:'visible'});assert.equal(await page.locator('[role="tab"]').count(),3);}
  else{await page.locator('.efhc-game-nav').waitFor({state:'visible'});assert.equal(await page.locator('.efhc-game-nav a').count(),6);assert.ok(await page.locator('.efhc-game-header').isVisible());}
  assert.equal(await page.locator('[data-energy-state="loading"],[data-energy-state="recoverable-error"]').count(),0);
  assert.ok(!/Application error|ZodError/.test(await page.locator('body').innerText()));
 });
 await check('same USER retains cache and running Energy across failed sync and reload',async()=>{
  await scenario('filled');await load();await page.waitForFunction(()=>{const c=JSON.parse(localStorage.getItem('EFHC_USER_DATA_CACHE_V1')||'null');return c?.entries.some(e=>e.key[0]==='syncSnapshot');});
  const before=Number(await page.locator('[data-energy-value-safe]').innerText());
  await scenario('error');await load();await page.locator('.efhc-energy-stage').waitFor();await page.waitForTimeout(800);
  const after=Number(await page.locator('[data-energy-value-safe]').innerText());assert.ok(after>=before&&after>0);
 });
 await check('USER switch resets language/design, removes former cache, and failed new load shows zero',async()=>{
  await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.selected_global_id='0000000123';s.scenario='error';localStorage.setItem(key,JSON.stringify(s));const settings=JSON.parse(localStorage.getItem('EFHC_USER_SETTINGS_V1'));settings.lang='ru';settings.color_theme_id='CT-03';localStorage.setItem('EFHC_USER_SETTINGS_V1',JSON.stringify(settings));},key);
  await load();await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal((await page.locator('[data-energy-value-safe]').innerText()).trim(),'0.00000000');
  const c=await page.evaluate(()=>JSON.parse(localStorage.getItem('EFHC_USER_DATA_CACHE_V1')));assert.equal(c.owner,'0000000123');assert.ok(c.entries.every(e=>e.key[1]===c.owner));
  const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('EFHC_USER_SETTINGS_V1')));assert.equal(s.color_theme_id,'CT-01');
 });
 await check('Admin selection preserves USER cache and language settings',async()=>{
  await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.selected_global_id='0000000456';localStorage.setItem(key,JSON.stringify(s));const settings=JSON.parse(localStorage.getItem('EFHC_USER_SETTINGS_V1'));settings.lang='ru';settings.color_theme_id='CT-03';localStorage.setItem('EFHC_USER_SETTINGS_V1',JSON.stringify(settings));},key);
  await load('admin/');await page.locator('[data-admin-primitive="page"]').waitFor();
  const c=await page.evaluate(()=>JSON.parse(localStorage.getItem('EFHC_USER_DATA_CACHE_V1')));assert.equal(c.owner,'0000000123');
  const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('EFHC_USER_SETTINGS_V1')));assert.equal(s.lang,'ru');assert.equal(s.color_theme_id,'CT-03');
 });
 await check('no React rendering or hydration errors',async()=>assert.deepEqual(errors,[]));
}finally{await fs.writeFile(dir+'/persistent-pages.json',JSON.stringify({base,results,errors},null,2));await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
