// Restore the authored progress models from frozen v866; OWNER 2026-11-01
// authorizes CT-owned chroma and ±15% of the .715rem starter rail height.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../frontend/',import.meta.url));
const require=createRequire(process.env.EFHC_FRONTEND_DEPENDENCIES||path.join(root,'package.json'));
const postcss=require('postcss');
const source=postcss.parse(fs.readFileSync(path.join(root,'public/FRONTEND_v866.css'),'utf8'));
const scope='.efhc-independent-shell[data-interface-app-mode="user"] :is(.efhc-energy-stage,.efhc-referrals-shell)';
const palette=JSON.parse(fs.readFileSync(path.join(root,'tests/parity/v866-contract.json'))).COLOR_THEME_CATALOG.map(x=>x.accent.toLowerCase());
function themeColor(token){
 let rgb,alpha=1;
 if(token[0]==='#'){
  let hex=token.slice(1);if(hex.length===3)hex=[...hex].map(x=>x+x).join('');
  rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));if(hex.length===8)alpha=parseInt(hex.slice(6),16)/255;
 }else{const values=token.match(/[\d.]+/g).map(Number);rgb=values.slice(0,3);alpha=values[3]??1;}
 const max=Math.max(...rgb),min=Math.min(...rgb);
 // White highlights, dark neutral substrates and neutral shadows are materials.
 if(max-min<18||max<60)return token;
 let color='var(--efhc-ct-accent)';
 const hex='#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join('');
 if(!palette.includes(hex)){
  const light=(max+min)/510,baseline=(110+255)/510;
  color=light<baseline?`color-mix(in srgb,var(--efhc-ct-accent) ${Math.round(light/baseline*100)}%,black)`:`color-mix(in srgb,var(--efhc-ct-accent) ${Math.round((1-light)/(1-baseline)*100)}%,white)`;
 }
 return alpha===1?color:`color-mix(in srgb,${color} ${Number((alpha*100).toFixed(2))}%,transparent)`;
}
export function chroma(value){return value.replace(/#[\da-f]{3,8}\b|\brgba?\(\s*[\d.]+\s*,[^()]*\)/gi,themeColor);}
function extract(container){
 const result=container.clone({nodes:[]});
 for(const node of container.nodes||[]){
  if(node.type==='rule'){
   // Contextual color projections are replaced by CT tokens. Keep actual PB
   // selectors and their source order; project them identically onto both routes.
   if(/data-(?:global-theme-id|color-theme-id)/.test(node.selector))continue;
   const selectors=postcss.list.comma(node.selector).flatMap(selector=>{
    const index=selector.search(/\.efhc-energy-progress-(?:track|fill)(?=[\s.:[>]|$)/);
    return index<0?[]:[`${scope} ${selector.slice(index)}`];
   });
   if(!selectors.length)continue;
   const rule=node.clone({selector:selectors.join(',\n')});
   rule.walkDecls(decl=>{
    decl.value=chroma(decl.value).replace(/\bpb-flow\b/g,'v866-pb-flow');
    decl.important=true;
   });
   result.append(rule);
  }else if(node.type==='atrule'&&['media','supports','container'].includes(node.name)){
   const kept=extract(node);if(kept.nodes.length)result.append(kept);
  }else if(node.type==='atrule'&&node.name==='keyframes'&&node.params==='pb-flow')result.append(node.clone({params:'v866-pb-flow'}));
 }
 return result;
}
const starter=':is([data-pb="PB-01"],'+Array.from({length:12},(_,i)=>`[data-pb="PB-${i+24}"]`).join(',')+')';
// Layered !important declarations outrank the unlayered legacy overrides.
// Reset only the two owned elements and their pseudos to remove stale models;
// then replay the immutable author's rules. No other surface is selected.
const css=`/* Generated from frozen FRONTEND_v866.css; source SHA is checked by contracts.
   OWNER: CT owns all PB/RP colors; authored geometry/effects retained, size bounded. */
@layer efhc-v866-progress {
${scope} :is(.efhc-energy-progress-track,.efhc-energy-progress-fill),
${scope} :is(.efhc-energy-progress-track,.efhc-energy-progress-fill)::before,
${scope} :is(.efhc-energy-progress-track,.efhc-energy-progress-fill)::after {all:revert!important;}
${extract(source)}
${scope} .efhc-energy-progress-track[data-pb] {
 min-height:.627rem!important;max-height:.82225rem!important;
 color:var(--efhc-ct-accent)!important;
}
${scope} .efhc-energy-progress-track[data-pb] > .efhc-energy-progress-fill {
 width:var(--efhc-progress-value,0%)!important;
 height:clamp(.501375rem,calc(100% - 1px),.678625rem)!important;
 top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;
 color:var(--efhc-ct-accent)!important;
}
${scope} .efhc-energy-progress-track${starter} > .efhc-energy-progress-fill {
 background:linear-gradient(90deg,color-mix(in srgb,var(--efhc-ct-accent) 72%,#0b0e1b),var(--efhc-ct-accent))!important;
 box-shadow:0 0 12px color-mix(in srgb,var(--efhc-ct-accent) 24%,transparent)!important;
}
${scope} .efhc-energy-progress-fill.efhc-no-motion {animation:none!important;transition:none!important;}
}
`;
const dest=path.join(root,'public/v866-react-progress.css');
if(process.argv.includes('--check')){
 if(fs.readFileSync(dest,'utf8')!==css)throw Error('v866 progress adapter drift');
 console.log('V866_REACT_PROGRESS_DERIVATION=PASS');
}else fs.writeFileSync(dest,css);
