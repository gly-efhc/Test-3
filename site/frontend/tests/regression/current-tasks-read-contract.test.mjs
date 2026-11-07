import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceRuntime} from '../helpers/source-runtime.mjs';
function service(payload){return sourceRuntime({overrides:{'../lib/api':{apiRequest:async()=>payload}}}).load('services/tasks.service.ts');}
const item=bonus=>({id:'1',code:'TASK_PUBLIC_TEST',title:'Task',bonus_efhc:bonus,is_active:true});
for(const invalid of ['0E-8','1e-3','NaN','1.123456789']){
 test('invalid task amount is rejected before React render: '+invalid,async()=>{
  await assert.rejects(service({items:[item(invalid)]}).getTasksCatalog());
  await assert.rejects(service({total_bonus_earned:invalid}).getTaskEarnings());
  await assert.rejects(service({items:[{id:null,task_id:'1',status:'not_started',bonus_efhc:invalid,can_claim:false}]}).getMyTasks());
 });
}
test('valid zero and large task D8 values remain exact strings',async()=>{
 for(const value of ['0.00000000','9007199254740993.12345678']){
  assert.equal((await service({items:[item(value)]}).getTasksCatalog())[0].bonus_efhc,value);
  assert.equal((await service({total_bonus_earned:value}).getTaskEarnings()).total_bonus_earned,value);
 }
});
test('bad catalog synchronization preserves the previous validated catalog',async()=>{
 let payload={items:[item('0.00000000')]};
 const h=sourceRuntime({overrides:{'../lib/api':{apiRequest:async()=>payload}}}),c=h.load('lib/queryClient.ts').createEfhcQueryClient();
 const s=h.load('services/tasks.service.ts'),options={queryKey:['tasks-catalog'],queryFn:s.getTasksCatalog,retry:false,staleTime:0};
 try{await c.fetchQuery(options);payload={items:[item('0E-8')]};await assert.rejects(c.fetchQuery(options));assert.equal(c.getQueryData(options.queryKey)[0].bonus_efhc,'0.00000000');}finally{c.clear();}
});
