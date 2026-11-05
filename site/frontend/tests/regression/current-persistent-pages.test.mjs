import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sourceRuntime} from '../helpers/source-runtime.mjs';
import {onlineManager} from '@tanstack/react-query';
const A='0000000001',B='0000000002';
const r=()=>sourceRuntime({overrides:{'../hooks/useT':{useT:()=>key=>key},'../hooks/useInterfaceVariantSurface':{useInterfaceVariantSurface:group=>({variant:group+'-01',handlers:{},ref:null})},'../hooks/useDemoGenerationProjection':{useDemoGenerationProjection:()=>null}}});
for(const status of ['idle','loading','error','success'])test('Energy retains its full canonical structure with no data: '+status,()=>{
 const h=r(),Page=h.load('pages/index.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Page,{snap:null,snapshotStatus:status,snapshotMode:'live'}));
 assert.match(html,/class="efhc-energy-stage"/);
 assert.match(html,/class="efhc-energy-progress-track"/);
 assert.match(html,/data-energy-chip-count="3"/);
 assert.doesNotMatch(html,/data-energy-state="(?:loading|recoverable-error)"/);
});
test('server correction is accepted immediately, even when lower than a local projection',()=>{
 const h=sourceRuntime();
 const {reconcileEnergyAnchor}=h.load('lib/energyProjection.ts');
 const a=reconcileEnergyAnchor({base_scaled:900n,base_client_ms:0},400n,1000);
 assert.equal(a.base_scaled,400n);assert.equal(a.base_client_ms,1000);
});
test('owner data persists across reload, while independent rejected updates retain it',async()=>{
 const h=sourceRuntime(),q=h.load('lib/queryClient.ts');
 assert.equal(typeof q.activateUserDataOwner,'function','explicit USER owner boundary is required');
 const c=q.createEfhcQueryClient();q.activateUserDataOwner(c,A,false);
 c.setQueryData(['panels',A,'summary'],{active_count:3});
 c.setQueryData(['referrals',A,'stats'],{active_referrals:4});
 await assert.rejects(c.fetchQuery({queryKey:['panels',A,'summary'],queryFn:()=>Promise.reject(Error('offline')),retry:false,staleTime:0}));
 const next=sourceRuntime({storage:h.storage}).load('lib/queryClient.ts'),reload=next.createEfhcQueryClient();next.activateUserDataOwner(reload,A,false);
 assert.equal(reload.getQueryData(['panels',A,'summary']).active_count,3);
 assert.equal(reload.getQueryData(['referrals',A,'stats']).active_referrals,4);
 c.clear();reload.clear();
});
test('USER switch clears former data and settings; late responses and return cannot restore them',()=>{
 const h=sourceRuntime(),q=h.load('lib/queryClient.ts');
 assert.equal(typeof q.activateUserDataOwner,'function');
 const c=q.createEfhcQueryClient();q.activateUserDataOwner(c,A,false);
 c.setQueryData(['panels',A,'summary'],{active_count:3});
 const settings=h.load('lib/settings.ts');settings.saveSettings({...settings.resetSettings(),lang:'ru',color_theme_id:'CT-03'});
 assert.equal(q.activateUserDataOwner(c,B,false),true);
 assert.equal(c.getQueryData(['panels',A,'summary']),undefined);
 assert.equal(settings.loadSettings().lang,'en');assert.equal(settings.loadSettings().color_theme_id,'CT-01');
 c.setQueryData(['panels',A,'summary'],{active_count:999});
 const next=sourceRuntime({storage:h.storage}).load('lib/queryClient.ts'),reload=next.createEfhcQueryClient();next.activateUserDataOwner(reload,B,false);
 assert.equal(reload.getQueryData(['panels',A,'summary']),undefined);
 q.activateUserDataOwner(c,A,false);assert.equal(c.getQueryData(['panels',A,'summary']),undefined);
 c.clear();reload.clear();
});
test('Admin Global ID selection does not reset USER cache or settings',()=>{
 const h=sourceRuntime(),q=h.load('lib/queryClient.ts');assert.equal(typeof q.activateUserDataOwner,'function');
 const c=q.createEfhcQueryClient();q.activateUserDataOwner(c,A,false);
 c.setQueryData(['panels',A,'summary'],{active_count:3});
 const settings=h.load('lib/settings.ts');settings.saveSettings({...settings.resetSettings(),lang:'ru'});
 assert.equal(q.activateUserDataOwner(c,B,true),false);
 assert.equal(c.getQueryData(['panels',A,'summary']).active_count,3);assert.equal(settings.loadSettings().lang,'ru');c.clear();
});
test('credentials and Admin permissions never enter the persisted USER read model',()=>{
 const h=sourceRuntime(),q=h.load('lib/queryClient.ts'),c=q.createEfhcQueryClient();q.activateUserDataOwner(c,A,false);
 c.setQueryData(['auth','session'],{token:'DO_NOT_PERSIST',roles:['superadmin']});
 c.setQueryData(['panels',A,'summary'],{active_count:2});
 assert.ok(![...h.storage.values()].join('').includes('DO_NOT_PERSIST'));c.clear();
});
test('unavailable storage cannot prevent the zero model or default settings',async()=>{
 const h=sourceRuntime();h.window.localStorage.getItem=()=>{throw Error('blocked');};h.window.localStorage.setItem=()=>{throw Error('blocked');};
 const q=h.load('lib/queryClient.ts'),c=q.createEfhcQueryClient();q.activateUserDataOwner(c,A,false);
 assert.equal(h.load('lib/browserFallback.ts').emptyOwnerSnapshot(A).profile.main_balance,'0.00000000');
 assert.equal((await h.load('lib/settings.ts').loadSettingsAsync()).lang,'en');c.clear();
});
test('offline backend mutations reject without pausing for automatic replay',{timeout:2000},async()=>{
 const q=sourceRuntime().load('lib/queryClient.ts'),c=q.createEfhcQueryClient();
 onlineManager.setOnline(false);
 try{const mutation=c.getMutationCache().build(c,{mutationFn:async()=>{throw Error('offline');}});await assert.rejects(mutation.execute(),/offline/);assert.equal(mutation.state.isPaused,false);}
 finally{onlineManager.setOnline(true);c.clear();}
});
test('all Admin GET views retain their operator-scoped data on transient failure, never on permission denial',async()=>{
 const h=sourceRuntime(),service=h.load('services/adminLinked.service.ts');
 assert.equal(typeof service.readAdminDisplay,'function','shared Admin read model is required');
 const read=service.readAdminDisplay;
 assert.equal((await read(A,'/admin/reports/overview',async()=>({amount:'12.00000000'}))).amount,'12.00000000');
 assert.equal((await read(A,'/admin/reports/overview',async()=>{throw Object.assign(Error('offline'),{status:503});})).amount,'12.00000000');
 await assert.rejects(read(B,'/admin/reports/overview',async()=>{throw Error('offline');}),/offline/);
 await assert.rejects(read(A,'/admin/reports/overview',async()=>{throw Object.assign(Error('denied'),{status:403});}),/denied/);
});
test('display Global ID and cached data are independent of transport credentials; changing USER owner replaces them',()=>{
 const h=sourceRuntime(),cache=h.load('lib/userDataCache.ts'),auth=h.load('lib/auth-session.ts'),q=h.load('lib/queryClient.ts');
 assert.equal(typeof cache.cachedUserDisplayOwner,'function');
 const credential=token=>({access_token:token.repeat(40),token_type:'Bearer',expires_at:'2099-01-01T00:00:00Z'});
 auth.storeAuthSession(credential('A'));
 const c=q.createEfhcQueryClient();q.activateUserDataOwner(c,A,false);
 assert.equal(cache.cachedUserDisplayOwner(),A);
 auth.storeAuthSession(credential('B'));assert.equal(cache.cachedUserDisplayOwner(),A);
 auth.clearAuthSession();assert.equal(cache.cachedUserDisplayOwner(),A);
 q.activateUserDataOwner(c,B,false);assert.equal(cache.cachedUserDisplayOwner(),B);
 assert.ok(![...h.storage.values()].join('').includes('A'.repeat(40)));c.clear();
});
