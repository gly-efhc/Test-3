import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.EFHC_BROWSER_TOOLS||import.meta.url),{chromium}=require('playwright-core');
const canon=JSON.parse(await fs.readFile(new URL('./v866-contract.json',import.meta.url)));
const base=process.env.EFHC_REACT_URL||'http://127.0.0.1:19240/Test-3/';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+\/Test-3\/$/);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}}),results=[];
await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
await page.addInitScript(defaults=>localStorage.setItem('EFHC_USER_SETTINGS_V1',JSON.stringify({lang:'ru',interface_settings_version:4,color_theme_id:'CT-01',interface_variants:defaults,music_enabled:false})),canon.DEFAULTS);
try{
 await page.goto(base+'referrals/');await page.waitForSelector('[data-public-surface="referrals"]');await page.waitForSelector('.efhc-entry-splash',{state:'hidden'});
 assert.equal(await page.locator('.efhc-referrals-shell .efhc-game-kicker').innerText(),'ПАРТНЁРСКАЯ СИСТЕМА');
 assert.ok((await page.locator('.efhc-referrals-shell').innerText()).includes('Уровни достижений'));
 assert.ok((await page.locator('.efhc-referrals-shell').innerText()).includes('Пригласить пользователя'));
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});
  const rows=await page.evaluate(canon=>{
   const root=document.querySelector('[data-public-surface="referrals"]'),shell=root.closest('.efhc-independent-shell');
   const output=[];
   function hue(rgb){const max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;if(max<60||d/max<.25)return null;return ((max===rgb[0]?(rgb[1]-rgb[2])/d:max===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4)*60+360)%360;}
   for(const theme of canon.COLOR_THEME_CATALOG){
    for(const n of [document.documentElement,shell]){n.dataset.colorThemeId=theme.id;n.dataset.globalThemeId=canon.COLOR_TO_RUNTIME_LEGACY_THEME[theme.id];}
    const expectedHue=hue([1,3,5].map(i=>parseInt(theme.accent.slice(i,i+2),16)));
    for(const variant of canon.REGISTRY.RG){
     root.dataset.rg=variant;
     const frame=getComputedStyle(root),hero=getComputedStyle(root.querySelector('.efhc-game-hero')),cards=[...root.querySelectorAll('.efhc-card')].map(e=>{const s=getComputedStyle(e);return[s.borderRadius,s.borderWidth,s.backgroundImage,s.backgroundColor,s.boxShadow,s.backdropFilter]}),rect=root.getBoundingClientRect();
     const brands=[...root.querySelectorAll('[data-referral-share-kind]')].map(e=>({kind:e.dataset.referralShareKind,color:getComputedStyle(e).backgroundColor}));
     const offTheme=[];
     for(const node of root.querySelectorAll('.efhc-game-hero,.efhc-card,.efhc-game-stat,.efhc-referral-achievement-track,.efhc-referral-achievement-dot,.efhc-referrals-my-entry')){
      const s=getComputedStyle(node),tokens=[s.backgroundImage,s.backgroundColor,s.borderTopColor,s.boxShadow].join(' ').match(/(?:rgba?|color)\([^)]*\)/g)||[];
      for(const token of tokens){const nums=token.match(/[\d.]+/g).map(Number),rgb=nums.slice(0,3).map(v=>token.startsWith('color(')?v*255:v),h=hue(rgb);if((nums[3]??1)>0&&h!==null&&Math.min(Math.abs(h-expectedHue),360-Math.abs(h-expectedHue))>4)offTheme.push({node:node.className,token});}
     }
     output.push({theme:theme.id,variant,overflow:document.documentElement.scrollWidth>innerWidth+1,width:rect.width,signature:JSON.stringify([frame.borderRadius,frame.backgroundImage,frame.backgroundColor,hero.borderRadius,hero.borderWidth,hero.backgroundImage,hero.boxShadow,hero.backdropFilter,cards]),brands,offTheme});
    }
   }
   return output;
  },canon);
  const expected={telegram:'rgb(38, 165, 228)',whatsapp:'rgb(37, 211, 102)',viber:'rgb(115, 96, 242)',facebook:'rgb(8, 102, 255)',x:'rgb(17, 17, 17)'};
  for(const row of rows){assert.ok(!row.overflow,`referrals overflow ${width}/${row.variant}`);assert.deepEqual(row.offTheme,[],`referrals color mismatch ${row.theme}/${row.variant}`);for(const b of row.brands)assert.equal(b.color,expected[b.kind],`brand color changed by ${row.theme}/${row.variant}`);}
  // RG-01/RG-13 differ by historical chroma only; CT-owned colors intentionally
  // remove that difference. All thirteen authored IDs remain exercised.
  const signatures=new Set(rows.filter(x=>x.theme==='CT-01').map(x=>x.signature));assert.equal(signatures.size,12,'RG material models collapsed');
  results.push({width,status:'PASS',combinations:rows.length,signatures:signatures.size});console.log('PASS referrals',width,'combinations',rows.length,'signatures',signatures.size);
 }
 if(process.env.EFHC_PARITY_ARTIFACTS){await page.reload();await page.waitForSelector('.efhc-entry-splash',{state:'hidden'});await page.setViewportSize({width:390,height:844});await fs.mkdir(process.env.EFHC_PARITY_ARTIFACTS,{recursive:true});await page.screenshot({path:process.env.EFHC_PARITY_ARTIFACTS+'/referrals-restored-390.png',fullPage:true});}
}catch(e){results.push({status:'FAIL',error:e.message});console.error('FAIL referrals',e.message);process.exitCode=1}finally{await browser.close()}
if(process.env.EFHC_PARITY_ARTIFACTS){await fs.mkdir(process.env.EFHC_PARITY_ARTIFACTS,{recursive:true});await fs.writeFile(process.env.EFHC_PARITY_ARTIFACTS+'/referrals-results.json',JSON.stringify({results},null,2)+'\n')}
