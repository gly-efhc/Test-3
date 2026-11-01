import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.EFHC_BROWSER_TOOLS||import.meta.url),{chromium}=require('playwright-core');
const canon=JSON.parse(await fs.readFile(new URL('./v866-contract.json',import.meta.url)));
const base=process.env.EFHC_REACT_URL||'http://127.0.0.1:19240/Test-3/';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+\/Test-3\/$/);
const routes={BN:'',PB:'',PH:'panels/',PA:'panels/',PT:'panels/portfolio/',PC:'panels/portfolio/',XH:'exchange/',TG:'tasks/',RG:'referrals/',RP:'referrals/',KG:'ranks/',PM:'web-profile/',HI:'web-profile/?section=history',FQ:'faq/',WD:'withdraw/',ER:'404/',AM:'admin/'};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try{
 for(const [group,route] of Object.entries(routes)){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(5000);
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.addInitScript(defaults=>localStorage.setItem('EFHC_USER_SETTINGS_V1',JSON.stringify({lang:'ru',interface_settings_version:4,color_theme_id:'CT-01',interface_variants:defaults,music_enabled:false})),canon.DEFAULTS);
  try{
   await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.waitForSelector('.efhc-interface-customization-button');await page.waitForTimeout(600);
   await page.locator('.efhc-interface-customization-button').click();
   const surface=page.locator(`[data-interface-variant-group="${group}"]`).first();await surface.waitFor({state:'attached'});
   const signatures=new Set();
   for(const selection of canon.REGISTRY[group]){
    let style=canon.SOURCE_STYLE[group][selection]||selection;
    if(group==='KG')style=canon.RANK_STYLE_ID_BY_SELECTION[style];
    const attribute='data-'+(group==='RP'?'pb':group.toLowerCase());
    await page.waitForFunction(({group,attribute,style})=>document.querySelector(`[data-interface-variant-group="${group}"]`)?.getAttribute(attribute)===style,{group,attribute,style});
    const signature=await surface.evaluate(e=>JSON.stringify([e,...e.querySelectorAll('.efhc-card,.efhc-game-hero,.efhc-game-stat,.efhc-panel-tile,.efhc-task-card,.efhc-game-nav_item,.efhc-energy-progress-track,.efhc-energy-progress-fill')].slice(0,12).map(n=>{const s=getComputedStyle(n);return[s.display,s.padding,s.borderRadius,s.borderWidth,s.boxShadow,s.backgroundImage,s.gridTemplateColumns]})));
    signatures.add(signature);
    await surface.press('ArrowRight');
   }
   results.push({group,status:'PASS',selections:canon.REGISTRY[group].length,renderedSignatures:signatures.size});console.log('PASS template cycle',group,canon.REGISTRY[group].length,'signatures',signatures.size);
  }catch(e){results.push({group,status:'FAIL',error:e.message});console.error('FAIL template cycle',group,e.message)}finally{await context.close()}
 }
}finally{await browser.close()}
if(process.env.EFHC_PARITY_ARTIFACTS){await fs.mkdir(process.env.EFHC_PARITY_ARTIFACTS,{recursive:true});await fs.writeFile(process.env.EFHC_PARITY_ARTIFACTS+'/template-results.json',JSON.stringify({results},null,2)+'\n')}
if(results.some(x=>x.status==='FAIL'))process.exitCode=1;

await import('./referrals.mjs');
