import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.EFHC_BROWSER_TOOLS||import.meta.url);
const {chromium}=require('playwright-core');
const canon=JSON.parse(await fs.readFile(new URL('./v866-contract.json',import.meta.url)));
const base=process.env.EFHC_REACT_URL||'http://127.0.0.1:19240/Test-3/';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+\/Test-3\/$/);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
async function check(name,run,{width=390,height=844,telegram=false,settings={}}={}){
 const context=await browser.newContext({viewport:{width,height}});
 const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await page.addInitScript(({defaults,settings,telegram})=>{
  localStorage.setItem('EFHC_USER_SETTINGS_V1',JSON.stringify({lang:'ru',interface_settings_version:4,color_theme_id:'CT-01',interface_variants:defaults,music_enabled:false,...settings}));
  if(telegram){
   const listeners=new Set();window.__efhcHostTest={closed:0,back:()=>[...listeners].forEach(fn=>fn())};
   window.Telegram={WebApp:{platform:'android',initData:'',initDataUnsafe:{},themeParams:{},ready(){},expand(){},onEvent(){},offEvent(){},close(){window.__efhcHostTest.closed++},BackButton:{show(){},hide(){},onClick(fn){listeners.add(fn)},offClick(fn){listeners.delete(fn)}}}};
  }
 },{defaults:canon.DEFAULTS,settings,telegram});
 try{await run(page);results.push({name,status:'PASS'});console.log('PASS',name)}catch(e){results.push({name,status:'FAIL',error:e.message});console.error('FAIL',name,e.message)}finally{await context.close()}
}
async function open(page,route=''){
 await page.goto(base+route,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.efhc-game-header');
 await page.waitForFunction(()=>typeof window.__EFHC_ANDROID_BACK__==='function');
 await page.waitForFunction(()=>!document.querySelector('.efhc-entry-splash:not([aria-hidden="true"]),.efhc-splash-breathe')||document.documentElement.dataset.efhcShell==='ready');
 await page.waitForTimeout(450);
}
const routePath=page=>page.evaluate(()=>location.pathname.replace(/^\/Test-3/,'').replace(/\/$/,'')||'/');
try{
 await check('Admin exit does not retain the Admin renderer',async page=>{
  await open(page,'admin/');await page.waitForSelector('[data-admin-visual-proof-route="/admin"]');
  await page.locator('.efhc-game-header_profile-name-button').click();
  await page.waitForURL('**/web-profile/**');
  await page.waitForFunction(()=>!document.querySelector('[data-admin-visual-proof-route]'),null,{timeout:2500});
  assert.ok(await page.locator('[data-public-surface="profile"],.efhc-profile-page').count());
 });
 await check('Admin has an explicit functional exit',async page=>{
  await open(page,'admin/');await page.locator('[data-app-navigation="exit-admin"]').click();
  await page.waitForFunction(()=>document.querySelector('.efhc-energy-stage'));
  assert.equal(await routePath(page),'/');
  assert.equal(await page.locator('[data-admin-visual-proof-route]').count(),0);
 });
 for(const width of [390,430,768,1440])await check(`Admin width is stable before and after interaction ${width}`,async page=>{
  await open(page,'admin/');
  const samples=[];
  for(let i=0;i<3;i++){
   samples.push(await page.locator('.efhc-independent-shell').boundingBox());
   if(i===0)await page.mouse.click(width/2,250);
   await page.waitForTimeout(80);
  }
  for(const box of samples)assert.ok(Math.abs(box.width-width)<1,JSON.stringify(samples));
  const title=await page.locator('.efhc-admin-header h1').boundingBox();
  const actions=await page.locator('.efhc-admin-header .efhc-admin-actions').boundingBox();
  assert.ok(title&&actions&&(title.y+title.height<=actions.y+1||actions.y+actions.height<=title.y+1||title.x+title.width<=actions.x+1||actions.x+actions.width<=title.x+1),'Admin title overlaps its actions');
 },{width});
 for(const width of [360,430,768,1440])await check(`gear anchored to shell corner ${width}`,async page=>{
  await open(page);
  for(const editing of [false,true]){
   if(editing)await page.locator('.efhc-interface-customization-button').click();
   const geometry=await page.evaluate(()=>{const shell=document.querySelector('.efhc-independent-shell').getBoundingClientRect(),gear=document.querySelector('.efhc-interface-customization-button').getBoundingClientRect(),nav=document.querySelector('.efhc-game-nav').getBoundingClientRect();return{gap:shell.right-gear.right,bottom:nav.top-gear.bottom}});
   assert.ok(geometry.gap>=8&&geometry.gap<=12,JSON.stringify(geometry));
   assert.ok(geometry.bottom>=7&&geometry.bottom<=12,JSON.stringify(geometry));
  }
 },{width});
 await check('splash logo scales with the viewport',async page=>{
  await page.route('**/locale/**',async r=>{await new Promise(resolve=>setTimeout(resolve,700));await r.continue()});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const image=page.locator('.efhc-splash-breathe');await image.waitFor({state:'attached'});
  const box=await image.boundingBox();assert.ok(box&&box.width>=390*.7&&box.width<=390*.85,JSON.stringify(box));
 });
 await check('nested Energy progress selects PB rather than its parent EG',async page=>{
  await open(page);await page.locator('.efhc-interface-customization-button').click();
  const progress=page.locator('[data-interface-variant-group="PB"]').first();
  await progress.click();await page.waitForTimeout(150);
  assert.equal(await progress.getAttribute('data-pb'),'PB-02');
 });
 await check('readonly nested exchange stats still allow the parent XH template gesture',async page=>{
  await open(page,'exchange/');await page.locator('.efhc-interface-customization-button').click();
  await page.locator('.efhc-exchange-stats-surface .efhc-game-stat').first().click();
  assert.equal(await page.locator('.efhc-exchange-hero').getAttribute('data-xh'),'XH-02');
 });
 await check('rank selection KG-03 uses the authored KG-04 style',async page=>{
  await open(page,'ranks/');assert.equal(await page.locator('.efhc-ranks-shell').getAttribute('data-kg'),'KG-04');
 },{settings:{interface_variants:{...canon.DEFAULTS,KG:'KG-03'}}});
 await check('Android Back cancels template selection before leaving the page',async page=>{
  await open(page);await page.locator('.efhc-interface-customization-button').click();
  await page.evaluate(()=>window.__EFHC_ANDROID_BACK__());
  await page.waitForFunction(()=>document.querySelector('.efhc-independent-shell').dataset.interfaceCustomizationMode==='idle',null,{timeout:2500});
  assert.equal(await routePath(page),'/');
 });
 await check('Android Back leaves a directly opened Admin child and then Admin',async page=>{
  await open(page,'admin/users/');
  await page.evaluate(()=>window.__EFHC_ANDROID_BACK__());
  await page.waitForFunction(()=>location.pathname==='/Test-3/admin/');
  await page.evaluate(()=>window.__EFHC_ANDROID_BACK__());
  await page.waitForFunction(()=>location.pathname==='/Test-3/' && !document.querySelector('[data-admin-visual-proof-route]'));
  await page.waitForSelector('.efhc-energy-stage');
 });
 await check('Telegram Android Back is connected on Admin',async page=>{
  await open(page,'admin/users/');await page.evaluate(()=>window.__efhcHostTest.back());
  await page.waitForFunction(()=>location.pathname==='/Test-3/admin/');
 },{telegram:true});
 await check('Android Back at the app root closes the Telegram host',async page=>{
  await open(page);await page.evaluate(()=>window.__EFHC_ANDROID_BACK__());
  assert.equal(await page.evaluate(()=>window.__efhcHostTest.closed),1);
 },{telegram:true});
 await check('browser Android Back closes the root dialog without leaving EFHC',async page=>{
  await open(page);await page.locator('[data-action="Deposit"]').click();
  await page.waitForSelector('[role="dialog"][aria-modal="true"]');await page.waitForTimeout(80);
  await page.evaluate(()=>history.back());await page.waitForTimeout(250);
  assert.ok(page.url().startsWith(base),'root dialog Back left the application');
  assert.equal(await page.locator('[role="dialog"][aria-modal="true"]').count(),0);
  assert.equal(await routePath(page),'/');
 });
 await check('browser Back cancels Admin editing without changing its URL',async page=>{
  await open(page);await page.locator('.efhc-game-header_profile-name-button').click();
  await page.waitForSelector('.efhc-profile-topbar');
  await page.locator('.efhc-profile-topbar_actions button').first().click();
  await page.waitForSelector('[data-admin-visual-proof-route]');
  await page.locator('.efhc-interface-customization-button').click();await page.waitForTimeout(80);
  await page.evaluate(()=>history.back());await page.waitForTimeout(250);
  assert.equal(await routePath(page),'/admin');
  assert.equal(await page.locator('.efhc-independent-shell').getAttribute('data-interface-customization-mode'),'idle');
 });
 await check('browser Back closes profile settings and preserves the profile URL',async page=>{
  await open(page);await page.locator('.efhc-game-header_profile-name-button').click();
  await page.waitForSelector('.efhc-profile-avatar-button');await page.locator('.efhc-profile-avatar-button').click();
  await page.waitForSelector('[role="dialog"][aria-modal="true"]');await page.waitForTimeout(80);
  await page.evaluate(()=>history.back());await page.waitForTimeout(250);
  assert.equal(await routePath(page),'/web-profile');
  assert.equal(await page.locator('[role="dialog"][aria-modal="true"]').count(),0);
 });
 await check('OWNER: gear auto-hides only in idle, returns on activity, save remains visible',async page=>{
  await open(page);
  const gear=page.locator('.efhc-interface-customization-button');
  assert.equal(await gear.getAttribute('data-visible'),'true','gear is not initially visible');
  await page.waitForTimeout(3250);
  assert.equal(await gear.getAttribute('data-visible'),'false','gear must hide after idle timeout');
  assert.equal(await gear.evaluate(el=>getComputedStyle(el).pointerEvents),'none','hidden gear intercepts taps');
  await page.mouse.move(12,12);
  await page.waitForFunction(()=>document.querySelector('.efhc-interface-customization-button')?.dataset.visible==='true');
  await page.waitForTimeout(3250);
  assert.equal(await gear.getAttribute('data-visible'),'false','gear did not reset hide timer');
  await page.evaluate(()=>window.dispatchEvent(new Event('touchstart')));
  await page.waitForFunction(()=>document.querySelector('.efhc-interface-customization-button')?.dataset.visible==='true');
  await gear.click();
  await page.waitForFunction(()=>document.querySelector('.efhc-independent-shell')?.dataset.interfaceCustomizationMode==='editing');
  await page.waitForTimeout(3250);
  assert.equal(await gear.getAttribute('data-visible'),'true','editing save button auto-hid');
  assert.equal(await gear.getAttribute('aria-label'),'Сохранить оформление');
  assert.equal(await page.locator('[data-color-theme-control="true"]').isVisible(),true,'globe vanished with gear');
 });
 await check('OWNER: globe is always visible during editing and cycles all 10 color themes',async page=>{
  await open(page);await page.clock.install();
  await page.locator('.efhc-interface-customization-button').click();
  const selector=page.locator('[data-color-theme-control="true"]');
  await selector.waitFor({state:'visible'});
  await page.clock.runFor(3500);
  assert.equal(await selector.isVisible(),true,'globe must not hide after three seconds');
  await page.mouse.move(12,12);
  await page.clock.runFor(3500);
  assert.equal(await selector.isVisible(),true,'globe must not hide after pointer activity or another timeout');
  for(let n=2;n<=11;n++){
    await selector.click();
    const expected='CT-'+String(n===11?1:n).padStart(2,'0');
    await page.waitForFunction(id=>document.documentElement.dataset.colorThemeId===id,expected);
    assert.equal(await selector.isVisible(),true,'globe vanished during ten-theme cycling');
  }
  await page.clock.runFor(3100);
  assert.equal(await selector.isVisible(),true,'globe disappeared while editing');
  assert.equal(await page.locator('.efhc-interface-customization-button').isVisible(),true,'save must stay visible');
  await selector.click();
  await page.waitForFunction(()=>document.documentElement.dataset.colorThemeId==='CT-02');
  await page.locator('.efhc-interface-customization-button').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('EFHC_USER_SETTINGS_V1')).color_theme_id),'CT-02','save did not persist the theme');
  assert.equal(await selector.count(),0,'globe must be absent outside editing');
  // OWNER acceptance: the selection survives an actual route reload.
  await page.clock.resume();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.colorThemeId==='CT-02');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('EFHC_USER_SETTINGS_V1')).color_theme_id),'CT-02','saved selection must survive reload');
  assert.equal(await page.locator('[data-color-theme-control="true"]').count(),0,'globe must remain absent after reload outside editing');
 });

}finally{await browser.close()}
if(process.env.EFHC_PARITY_ARTIFACTS){await fs.mkdir(process.env.EFHC_PARITY_ARTIFACTS,{recursive:true});await fs.writeFile(process.env.EFHC_PARITY_ARTIFACTS+'/interaction-results.json',JSON.stringify({results},null,2)+'\n')}
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
