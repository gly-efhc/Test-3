// Direct OWNER exception to frozen Header materials: all backplates removed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.EFHC_BROWSER_TOOLS||import.meta.url),{chromium}=require('playwright-core');
const canon=JSON.parse(await fs.readFile(new URL('./v866-contract.json',import.meta.url)));
const base=process.env.EFHC_REACT_URL||'http://127.0.0.1:19240/Test-3/';assert.match(base,/^http:\/\/127\.0\.0\.1:\d+\/Test-3\/$/);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}}),results=[];
await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
await page.addInitScript(defaults=>localStorage.setItem('EFHC_USER_SETTINGS_V1',JSON.stringify({lang:'ru',interface_settings_version:4,color_theme_id:'CT-01',interface_variants:defaults,music_enabled:false})),canon.DEFAULTS);
try{
 await page.goto(base);await page.waitForSelector('.efhc-game-header');await page.waitForSelector('.efhc-entry-splash',{state:'hidden'});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});
  const rows=await page.evaluate(canon=>{
   const shell=document.querySelector('.efhc-independent-shell'),header=document.querySelector('.efhc-game-header'),nodes=[header.closest('.efhc-header-divider'),header,...header.querySelectorAll('*')],rows=[];
   const clear=color=>color==='transparent'||color.endsWith(', 0)')||/\/\s*0\s*\)/.test(color);
   for(const theme of canon.COLOR_THEME_CATALOG){
    for(const n of [document.documentElement,shell]){n.dataset.colorThemeId=theme.id;n.dataset.globalThemeId=canon.COLOR_TO_RUNTIME_LEGACY_THEME[theme.id];}
    for(const selection of canon.REGISTRY.HS){
     const composition=canon.HEADER_THEME_COMPOSITION[canon.SOURCE_STYLE.HS[selection]||selection];
     header.dataset.hs=composition.shell;header.querySelector('.efhc-game-header_balance').dataset.hb=composition.hb;header.querySelector('.efhc-game-header_statuses').dataset.sc=composition.sc;
     const remaining=[];
     for(const node of nodes)for(const pseudo of [null,'::before','::after']){
      const s=getComputedStyle(node,pseudo),border=['Top','Right','Bottom','Left'].some(side=>parseFloat(s['border'+side+'Width'])>0&&s['border'+side+'Style']!=='none'&&!clear(s['border'+side+'Color']));
      if(!clear(s.backgroundColor)||s.backgroundImage!=='none'||s.boxShadow!=='none'||s.textShadow!=='none'||s.filter!=='none'||s.backdropFilter!=='none'||border)remaining.push({node:node.getAttribute('class')||node.tagName,pseudo,background:s.backgroundImage,color:s.backgroundColor,shadow:s.boxShadow,border});
     }
     rows.push({theme:theme.id,selection,remaining});
    }
   }
   return rows;
  },canon);
  for(const row of rows)assert.deepEqual(row.remaining,[],`Header backplate ${width}/${row.theme}/${row.selection}`);
  results.push({width,status:'PASS',combinations:rows.length});console.log('PASS transparent Header',width,'combinations',rows.length);
 }
}catch(e){results.push({status:'FAIL',error:e.message});console.error('FAIL transparent Header',e.message);process.exitCode=1}finally{await browser.close()}
if(process.env.EFHC_PARITY_ARTIFACTS){await fs.mkdir(process.env.EFHC_PARITY_ARTIFACTS,{recursive:true});await fs.writeFile(process.env.EFHC_PARITY_ARTIFACTS+'/header-results.json',JSON.stringify({results},null,2)+'\n')}
