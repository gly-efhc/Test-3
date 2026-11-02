import assert from 'node:assert/strict';
export async function verifyUiFollowup(page,{open,artifacts,theme,width}){
 await open(page,'ranks/');
 assert.equal(await page.locator('[data-ranks-hero-summary] .efhc-game-hero_icon').count(),0,'Ranks decorative star removed');
 await page.mouse.move(12,12);await page.locator('.efhc-interface-customization-button').click();
 const header=page.locator('[data-interface-variant-group="HS"]');
 const ranks=page.locator('[data-interface-variant-group="KG"]');
 const material=()=>header.locator('.efhc-header-action:visible').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.backgroundImage]}));
 const canonical=await material();
 for(let i=1;i<6;i++){
  await header.press('ArrowRight');
  if(i>=3)assert.deepEqual(await material(),canonical,`Header ${i+1} background differs from 1 at ${theme}`);
 }
 for(let i=0;i<10;i++){
  // Resolve the current CT roles in the same element scope; compare rendered
  // values, not token names. Geometry and KG selection remain independent.
  const m=await ranks.locator('[data-ranks-hero-summary]').evaluate(el=>{
   const s=getComputedStyle(el),probe=document.createElement('div');el.append(probe);
   probe.style.cssText='background:var(--efhc-route-surface-raised);border:1px solid var(--efhc-route-border-strong)';
   const p=getComputedStyle(probe);const out={background:s.backgroundColor,border:s.borderTopColor,expectedBackground:p.backgroundColor,expectedBorder:p.borderTopColor};probe.remove();return out;
  });
  assert.equal(m.background,m.expectedBackground,`KG ${i+1} background CT ${theme}`);assert.equal(m.border,m.expectedBorder,`KG ${i+1} border CT ${theme}`);
  await ranks.press('ArrowRight');
 }
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(100);
 for(const surface of [header,ranks]){
  const rect=await surface.boundingBox();const above=await page.locator('.efhc-interface-variant-dots').evaluateAll((es,r)=>es.some(e=>{let b=e.getBoundingClientRect();return Math.abs(b.x+b.width/2-r.x-r.width/2)<2&&b.bottom<=r.y+1&&r.y-b.bottom<24}),rect);
  assert.ok(above,'selector dots must be above their surface');
 }
 if(artifacts)await page.screenshot({path:`${artifacts}/ranks-header-${theme}-${width}.png`});
 await page.locator('.efhc-interface-customization-button').click();
 await open(page,'referrals/');
 assert.equal(await page.locator('details').filter({hasText:'Реферальная система'}).count(),0,'unreferenced system details removed');
 assert.equal(await page.getByText('Подробнее в FAQ',{exact:true}).count(),0);
 if(artifacts)await page.screenshot({path:`${artifacts}/referrals-clean-${theme}-${width}.png`});
}
