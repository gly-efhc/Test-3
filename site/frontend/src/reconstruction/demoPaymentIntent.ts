import type {DemoRow} from './demoServerModel';
/** SQL opening intents are historical evidence, never pending browser checkout. */
export function isImportedDemoIntent(row:DemoRow):boolean{return row.dataset==='RECON_CYCLE_0027';}
export function demoPaymentIntentView(row:DemoRow):DemoRow{
 return {...row,id:String(row.id),purpose:String(row.purpose||row.item_type||'deposit'),
  asset:String(row.asset||'EFHC_DEMO'),payload:String(row.payload||`DEMO:${row.global_id}`),
  to_address:String(row.to_address||'DEMO_NO_EXTERNAL_TRANSFER'),
  created_at:String(row.created_at),expires_at:String(row.expires_at||row.created_at)};
}
