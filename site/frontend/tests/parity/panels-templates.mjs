import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const reference=JSON.parse(await fs.readFile(new URL('./v866-panels-hero-reference.json',import.meta.url)));
const sourceCases=reference.viewports.flatMap(width=>reference.cases.map(base=>{
 const r=structuredClone(base);r.width=width;
 for(const {path,value} of reference.viewport_overrides[base.selection][width]){
  let target=r;for(const key of path.slice(0,-1))target=target[key];target[path.at(-1)]=value;
 }
 return r;
}));
const physical=(canon,group,id)=>canon.SOURCE_STYLE[group][id]||id;
async function select(page,canon,group,id){
 const node=page.locator(`[data-interface-variant-group="${group}"]`),attr=`data-${group.toLowerCase()}`,expected=physical(canon,group,id);
 for(let i=0;i<canon.REGISTRY[group].length;i++){
  if(await node.getAttribute(attr)===expected)return node;
  await node.press('ArrowRight');
 }
 throw new Error(`selection unreachable: ${group}/${id}`);
}
async function settled(page){await page.waitForTimeout(500)}

export async function verifyPanelsHeroTemplates(page,{open,canon,artifacts}){
 assert.equal(reference.source_html_sha256,canon.source.html_sha256);
 await open(page,'panels/');await page.mouse.move(12,12);await page.locator('.efhc-interface-customization-button').click();
 const results=[];
 for(const r of sourceCases){
  await page.setViewportSize({width:r.width,height:844});
  const hero=await select(page,canon,'PH',r.selection);
  const actual=await hero.evaluate((e,r)=>{
   const read=(n,expected)=>{const s=getComputedStyle(n);return Object.fromEntries(Object.keys(expected).map(k=>[k,s[k]]))};
   const selectors={hero:'',head:'.panels-hero-head',title:'.panels-page-title',kicker:'.panels-kicker',tier:'.panels-generation-tier',stats:'.panels-stats'};
   return{expected:Object.fromEntries(Object.entries(selectors).map(([k,s])=>[k,read(s?e.querySelector(s):e,r.expected[k])])),cells:[...e.querySelectorAll('.panels-stat')].map((n,i)=>({cell:read(n,r.cells[i].cell),label:read(n.querySelector('.panels-stat-label'),r.cells[i].label),value:read(n.querySelector('.panels-stat-value'),r.cells[i].value)})),boxes:[...e.querySelectorAll('.panels-stat')].map(n=>n.getBoundingClientRect().toJSON()),values:[...e.querySelectorAll('.panels-stat-value')].map(n=>({text:n.textContent,client:n.clientWidth,scroll:n.scrollWidth}))};
  },r);
  assert.deepEqual(actual.expected,r.expected,`${r.selection} local source geometry ${r.width}`);
  assert.deepEqual(actual.cells,r.cells,`${r.selection} source stat anatomy ${r.width}`);
  const [a,b,c]=actual.boxes;
  if(r.physical==='PH-12'){
   assert.ok(Math.abs(b.x-c.x)<1,'both numeric lanes beside the focus lens');
   assert.ok(b.x>a.x+a.width,'lens occupies left column');
   assert.ok(a.y+a.height>=c.y+c.height-1,'lens spans both rows');
  }else{
   assert.ok(Math.abs(a.y-b.y)<1,'first two source cells share a row');
   assert.ok(c.y>a.y+a.height,'third source cell is below');
   assert.ok(c.width>a.width+b.width,'third cell spans full stats width');
  }
  for(const v of actual.values.slice(1)){assert.match(v.text,/\d+\.\d{8} kWh\//);assert.ok(v.scroll<=v.client+1,'full D8 number fits');}
  results.push({selection:r.selection,physical:r.physical,width:r.width,status:'PASS'});
  if(artifacts&&[320,390,1440].includes(r.width))await hero.screenshot({path:`${artifacts}/ph-restored-${r.selection}-${r.width}.png`});
 }
 await page.setViewportSize({width:390,height:844});
 for(const theme of canon.COLOR_THEME_CATALOG){
  await page.waitForFunction(id=>document.documentElement.dataset.colorThemeId===id,theme.id);await settled(page);
  const header=page.locator('.efhc-game-header');const before=await header.evaluate(e=>({hs:e.dataset.hs,rect:[e.clientWidth,e.clientHeight],text:e.querySelector('.efhc-game-header_balance-value')?.textContent}));
  for(const id of canon.REGISTRY.PH.slice(1)){
   const hero=await select(page,canon,'PH',id);
   const color=await hero.locator('.panels-kicker').evaluate(e=>{const c=document.createElement('span');c.style.color='var(--efhc-ct-accent)';e.append(c);const out=[getComputedStyle(e).color,getComputedStyle(c).color];c.remove();return out});
   assert.equal(color[0],color[1],`${id} kicker follows ${theme.id}`);
  }
  await select(page,canon,'PH','PH-01');assert.equal(await page.locator('#panelsHero').count(),0,'PH-01 retains accepted GameHero DOM');
  assert.deepEqual(await header.evaluate(e=>({hs:e.dataset.hs,rect:[e.clientWidth,e.clientHeight],text:e.querySelector('.efhc-game-header_balance-value')?.textContent})),before,'PH does not alter independent Header');
  if(theme.id!=='CT-10')await page.locator('[data-color-theme-control]').click();
 }
 if(artifacts)await fs.writeFile(`${artifacts}/ph-source-parity-results.json`,JSON.stringify({source:reference.source_html_sha256,results,colorThemes:10},null,2)+'\n');
}

export async function verifyPortfolioColors(page,{open,canon,width,artifacts}){
 await page.setViewportSize({width,height:844});await open(page,'panels/portfolio/');
 const results=[];
 for(const theme of canon.COLOR_THEME_CATALOG){
  await page.waitForFunction(id=>document.documentElement.dataset.colorThemeId===id,theme.id);
  for(const tab of ['active','archive']){
   await page.locator(`[data-panels-tab-button="${tab}"]`).click();
   await page.waitForSelector(`[data-panels-list="${tab}"] .efhc-panel-tile`);
   await page.mouse.move(12,12);await page.locator('.efhc-interface-customization-button').click();await settled(page);
   const header=await page.locator('.efhc-game-header').getAttribute('data-hs');
   for(const id of canon.REGISTRY.PT){
    const surface=await select(page,canon,'PT',id);
    const actual=await surface.evaluate(e=>{
     const active=e.querySelector('[data-active="true"]'),inactive=e.querySelector('[data-active="false"]'),s=getComputedStyle(active),n=getComputedStyle(inactive),probe=document.createElement('span');
     probe.style.cssText='color:var(--efhc-ct-accent);background:var(--efhc-tone-active);border:1px solid rgba(var(--efhc-ct-accent-rgb),.34)';e.append(probe);const p=getComputedStyle(probe),out={color:s.color,background:s.backgroundColor,image:s.backgroundImage,border:s.borderTopColor,expectedColor:p.color,expectedBackground:p.backgroundColor,expectedBorder:p.borderTopColor,inactiveImage:n.backgroundImage,active:active.dataset.panelsTabButton};probe.remove();return out;
    });
    assert.equal(actual.active,tab);assert.equal(actual.color,actual.expectedColor,`${theme.id}/${id}/${tab} text`);
    assert.equal(actual.background,actual.expectedBackground,`${theme.id}/${id}/${tab} active surface`);
    assert.equal(actual.image,'none','legacy independent blue/violet gradient');assert.equal(actual.inactiveImage,'none');
    assert.equal(actual.border,actual.expectedBorder,`${theme.id}/${id}/${tab} contour`);
    results.push({theme:theme.id,tab,group:'PT',selection:id,status:'PASS'});
   }
   for(const id of canon.REGISTRY.PC){
    const surface=await select(page,canon,'PC',id);
    const actual=await surface.locator('.efhc-panel-tile').first().evaluate(e=>{
     const s=getComputedStyle(e),badge=e.querySelector('.efhc-panel-activ-status'),bs=getComputedStyle(badge),probe=document.createElement('span');
     probe.style.cssText='color:var(--efhc-ct-accent);background:color-mix(in srgb,#090a0e 97%,var(--efhc-ct-accent) 3%)';e.append(probe);const p=getComputedStyle(probe),out={background:s.backgroundColor,expectedBackground:p.backgroundColor,image:s.backgroundImage,badgeColor:bs.color,expectedAccent:p.color,isActive:badge.dataset.active,fieldImages:[...e.querySelectorAll('.efhc-panel-tile_dates>div,.efhc-panel-tile_stats>div')].map(n=>getComputedStyle(n).backgroundImage),values:[...e.querySelectorAll('[data-panel-card-field="generated-kwh"] .font-semibold')].map(n=>n.textContent)};probe.remove();return out;
    });
    assert.equal(actual.background,actual.expectedBackground,`${theme.id}/${id}/${tab} shared card surface`);assert.equal(actual.image,'none');
    assert.equal(actual.badgeColor,tab==='active'?actual.expectedAccent:'rgb(148, 163, 184)','Activ status preserves active/archived semantics');
    assert.ok(actual.fieldImages.every(v=>v==='none'),'no foreign-color field backing');for(const value of actual.values)assert.match(value,/^\d+\.\d{8}$/);
    results.push({theme:theme.id,tab,group:'PC',selection:id,status:'PASS'});
   }
   assert.equal(await page.locator('.efhc-game-header').getAttribute('data-hs'),header,'Portfolio design does not change Header');
   if(artifacts&&theme.id==='CT-03')await page.screenshot({path:`${artifacts}/portfolio-ct03-${tab}-${width}.png`});
   if(tab==='archive'&&theme.id!=='CT-10')await page.locator('[data-color-theme-control]').click();
   await page.locator('.efhc-interface-customization-button').click();
  }
 }
 if(artifacts)await fs.writeFile(`${artifacts}/portfolio-color-results-${width}.json`,JSON.stringify({results},null,2)+'\n');
}
