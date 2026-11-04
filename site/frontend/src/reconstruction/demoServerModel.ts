/** Wire-compatible, browser-only DEMO state. No production credentials. */
export type DemoRow=Record<string,any>;
export type DemoPanel={
 id:string;public_id:string;global_id:string;activated_at:string;created_at:string;
 expires_at:string;archived_at:string|null;last_generated_at:string;
 base_gen_per_sec:string;generated_kwh:string;is_active:boolean;is_archived:boolean;
 remainder:string;meta?:DemoRow;cost_bonus?:string;cost_main?:string;
};
export type DemoServerState={
 version:1;started_at:string;as_of_utc:string;bank_balance:string;supply_initial:string;
 minted:string;burned:string;audit:DemoRow[];replays:Record<string,{fingerprint:string;response:unknown}>;
 tasks:DemoRow[];submissions:DemoRow[];hub:DemoRow[];support:DemoRow[];
 items:DemoRow[];orders:DemoRow[];packages:DemoRow[];deposits:DemoRow[];
 providers:DemoRow[];templates:DemoRow[];settings:DemoRow;intents:DemoRow[];
};
