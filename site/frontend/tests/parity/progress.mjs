// OWNER 2026-11-01: authored PB/RP topology, CT-owned chroma, ±15% sizing.
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
try{
 for(const [group,route] of [['PB',''],['RP','referrals/']]){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.addInitScript(defaults=>localStorage.setItem('EFHC_USER_SETTINGS_V1',JSON.stringify({lang:'ru',interface_settings_version:4,color_theme_id:'CT-01',interface_variants:defaults,music_enabled:false})),canon.DEFAULTS);
  try{
   await page.goto(base+route,{waitUntil:'domcontentloaded'});
   await page.waitForSelector('.efhc-energy-progress-track');
   await page.waitForSelector('.efhc-entry-splash',{state:'hidden'});
   for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:844});
    const samples=await page.evaluate(({canon,group})=>{
     const shell=document.querySelector('.efhc-independent-shell'),track=document.querySelector(group==='PB'?'.efhc-energy-stage .efhc-energy-progress-track':'[data-referrals-progress-bar]'),fill=track.querySelector('.efhc-energy-progress-fill');
     const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
     function rgba(value){ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];}
     function hue([r,g,b]){const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(d<18||max<60)return null;return ((max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;}
     const rows=[];
     for(const theme of canon.COLOR_THEME_CATALOG){
      for(const node of [document.documentElement,shell]){node.dataset.colorThemeId=theme.id;node.dataset.globalThemeId=canon.COLOR_TO_RUNTIME_LEGACY_THEME[theme.id];}
      const targetHue=hue(rgba(theme.accent));
      for(const selection of canon.REGISTRY[group]){
       const style=canon.SOURCE_STYLE[group][selection]||selection;track.dataset.pb=style;
       track.closest('[data-interface-variant-group]')?.setAttribute('data-pb',style);
       fill.style.width='55%';fill.style.setProperty('--efhc-progress-value','55%');
       const t=getComputedStyle(track),f=getComputedStyle(fill),after=getComputedStyle(track,'::after'),fillAfter=getComputedStyle(fill,'::after');
       const rect=track.getBoundingClientRect(),fr=fill.getBoundingClientRect();
       const colored=[t.backgroundImage,t.backgroundColor,t.borderColor,t.boxShadow,f.backgroundImage,f.backgroundColor,f.boxShadow,after.backgroundImage,fillAfter.backgroundImage].join(' ').match(/(?:rgba?|color)\([^)]*\)/g)||[];
       const offTheme=colored.filter(token=>{const c=rgba(token),h=hue(c);return c[3]>0&&h!==null&&Math.min(Math.abs(h-targetHue),360-Math.abs(h-targetHue))>4;});
       rows.push({theme:theme.id,selection,style,height:rect.height,fillHeight:fr.height,fillInside:fr.left>=rect.left-.1&&fr.right<=rect.right+.1&&fr.top>=rect.top-.1&&fr.bottom<=rect.bottom+.1,offTheme,background:f.backgroundImage,clip:f.clipPath,animation:f.animationName,after:after.backgroundImage,fillAfter:fillAfter.backgroundImage,signature:JSON.stringify([t.height,t.padding,t.borderRadius,t.borderWidth,t.backgroundImage,t.boxShadow,f.backgroundImage,f.backgroundColor,f.boxShadow,f.clipPath,f.animationName,after.content,after.backgroundImage,fillAfter.content,fillAfter.backgroundImage])});
      }
     }
     return rows;
    },{canon,group});
    for(const sample of samples){
     assert.ok(sample.height>=11.44*.85-.03&&sample.height<=11.44*1.15+.03,`progress size ${group}/${width}: ${JSON.stringify(sample)}`);
     assert.ok(sample.fillInside&&sample.fillHeight>0,`progress fill containment ${group}/${width}: ${JSON.stringify(sample)}`);
     assert.deepEqual(sample.offTheme,[],`progress color ${group}/${width}/${sample.theme}/${sample.selection}`);
     if(sample.style==='PB-04'||sample.style==='PB-09')assert.match(sample.background,/repeating-linear-gradient/,'segmented progress model lost');
     if(sample.style==='PB-14')assert.match(sample.background,/135deg/,'diagonal progress model lost');
     if(sample.style==='PB-15')assert.match(sample.clip,/polygon/,'arrow progress model lost');
     if(sample.style==='PB-16')assert.match(sample.animation,/pb-flow/,'animated progress model lost');
     if(sample.style==='PB-18')assert.match(sample.after,/repeating-linear-gradient/,'progress ticks lost');
     if(sample.style==='PB-23')assert.match(sample.fillAfter,/120deg/,'progress sheen lost');
    }
    const signatures=new Set(samples.filter(x=>x.theme==='CT-01').map(x=>x.signature));
    assert.ok(signatures.size>=21,`lost progress designs: ${group}/${width} only ${signatures.size}`);
    results.push({group,width,status:'PASS',samples:samples.length,signatures:signatures.size});
    console.log('PASS progress library',group,width,'samples',samples.length,'signatures',signatures.size);
   }
  }catch(e){results.push({group,status:'FAIL',error:e.message});console.error('FAIL progress library',group,e.message)}finally{await context.close()}
 }
}finally{await browser.close()}
if(process.env.EFHC_PARITY_ARTIFACTS){await fs.mkdir(process.env.EFHC_PARITY_ARTIFACTS,{recursive:true});await fs.writeFile(process.env.EFHC_PARITY_ARTIFACTS+'/progress-results.json',JSON.stringify({results},null,2)+'\n')}
if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
