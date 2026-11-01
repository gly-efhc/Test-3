// Existing Referrals color transform only; not loaded by progress or Header.
import fs from 'node:fs';
const root=new URL('../../frontend/',import.meta.url);
const palette=JSON.parse(fs.readFileSync(new URL('tests/parity/v866-contract.json',root))).COLOR_THEME_CATALOG.map(x=>x.accent.toLowerCase());
function themeColor(token,neutralizeMix=false){
 let rgb,alpha=1;
 if(token[0]==='#'){
  let hex=token.slice(1);if(hex.length===3)hex=[...hex].map(x=>x+x).join('');
  rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));if(hex.length===8)alpha=parseInt(hex.slice(6),16)/255;
 }else{const values=token.match(/[\d.]+/g).map(Number);rgb=values.slice(0,3);alpha=values[3]??1;}
 const max=Math.max(...rgb),min=Math.min(...rgb);
 // A blue substrate in color-mix changes the hue of dim violet/fuchsia rails.
 // Retain its luminance while making the substrate neutral, so CT owns hue.
 if(neutralizeMix&&max<60&&max!==min){const gray=Math.round(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722);return alpha===1?`rgb(${gray},${gray},${gray})`:`rgba(${gray},${gray},${gray},${alpha})`;}
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
export function chroma(value){return value.replace(/#[\da-f]{3,8}\b|\brgba?\(\s*[\d.]+\s*,[^()]*\)/gi,token=>themeColor(token,value.includes('color-mix(')));}
