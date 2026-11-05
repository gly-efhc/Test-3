import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// OWNER C30: current CT04–10 are the reference. No HTML fixture or redesign.
const physicalCards=['PC-01','PC-02','PC-03','PC-04','PC-05','PC-06','PC-08','PC-09','PC-10'];
const colorId=n=>'CT-'+String(n).padStart(2,'0');
function readCards(){
 const read=e=>{
  const s=getComputedStyle(e),r=e.getBoundingClientRect();
  return {width:r.width,height:r.height,padding:s.padding,borderWidth:s.borderWidth,borderRadius:s.borderRadius,
   fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,letterSpacing:s.letterSpacing,
   margin:s.margin,gap:s.gap,display:s.display,columns:s.gridTemplateColumns};
 };
 return [...document.querySelectorAll('.efhc-panel-tile')].slice(0,3).map(e=>({
  identity:e.dataset.panelIdentity,frame:read(e),
  contents:[e.querySelector('.efhc-panel-tile_head'),e.querySelector('.efhc-panel-tile_dates'),e.querySelector('.efhc-panel-tile_stats'),
   ...e.querySelectorAll('.efhc-panel-tile_dates .font-semibold,.efhc-panel-tile_stats .font-semibold')].map(read),
 }));
}

export async function verifyPortfolioThemeHeights(page,{base,artifacts,widths=[320,390,1440]}={}){
 const results=[];
 await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('EFHC_USER_DATA_CACHE_V1')||'null')?.owner);
 await page.evaluate(()=>{
  const key='EFHC_USER_SETTINGS_V1',s=JSON.parse(sessionStorage.getItem(key));
  s.lang='ru';s.color_theme_id='CT-01';s.interface_variants={...s.interface_variants,PC:'PC-01',PT:'PT-01'};
  sessionStorage.setItem(key,JSON.stringify(s));
 });
 try{
  for(const width of widths){
   await page.setViewportSize({width,height:844});
   await page.goto(base+'panels/portfolio/',{waitUntil:'domcontentloaded'});
   await page.locator('.efhc-entry-splash[aria-hidden="false"]').waitFor({state:'hidden',timeout:30000});
   for(const tab of ['active','archive']){
    await page.locator(`[data-panels-tab-button="${tab}"]`).click();
    await page.locator(`[data-panels-list="${tab}"] .efhc-panel-activ-status[data-active="${tab==='active'}"]`).first().waitFor({state:'visible'});
    await page.mouse.move(12,12);await page.locator('.efhc-interface-customization-button').click();
    const surface=page.locator('[data-interface-variant-group="PC"]');
    for(const physical of physicalCards){
     assert.equal(await surface.getAttribute('data-pc'),physical,'color change must preserve the independent card design');
     const colors=[];
     for(let color=1;color<=10;color++){
      await page.waitForFunction(id=>document.documentElement.dataset.colorThemeId===id,colorId(color));
      const entry={width,tab,physical,color:colorId(color),cards:await page.evaluate(readCards)};
      assert.equal(entry.cards.length,3,'measure actual populated cards');colors.push(entry);results.push(entry);
      await page.locator('[data-color-theme-control="true"]').click();
     }
     const reference=colors[3];
     for(const actual of colors){
      assert.deepEqual(actual.cards,reference.cards,`${width}px/${tab}/${physical}/${actual.color}: frame geometry and existing font/padding/grid must match CT04`);
     }
     await surface.press('ArrowRight');
    }
    await page.locator('.efhc-interface-customization-button').click();
   }
  }
  return results;
 }finally{
  if(artifacts){await fs.mkdir(artifacts,{recursive:true});await fs.writeFile(artifacts+'/portfolio-theme-height.json',JSON.stringify({reference:'current React CT04–10',results},null,2));}
 }
}
