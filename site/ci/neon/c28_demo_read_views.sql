-- EFHC_Nektron_Test only. Additive read projections; no business-row writes or grants.
-- Preserve the catalog_rows column contract and its existing SELECT-only guest access.
CREATE OR REPLACE VIEW efhc_demo_public.catalog_rows AS
 SELECT 'hub_links'::text AS table_name, h.id::text AS id, to_jsonb(h) AS item FROM efhc_core.hub_links h
 UNION ALL SELECT 'shop_items', x.id::text, to_jsonb(x) FROM efhc_core.shop_items x
 UNION ALL SELECT 'task_catalog', t.id::text, to_jsonb(t) FROM efhc_core.tasks t
 UNION ALL SELECT 'settings', s.key::text, to_jsonb(s) FROM efhc_core.app_settings s
 UNION ALL SELECT 'admin_roles', r.id::text, to_jsonb(r) FROM efhc_admin.admin_role r
 UNION ALL SELECT 'referrals', r.id::text, jsonb_build_object(
  'id',r.id::text,'global_id',lpad(r.inviter_global_id::text,10,'0'),
  'inviter_global_id',lpad(r.inviter_global_id::text,10,'0'),
  'invitee_global_id',lpad(r.invitee_global_id::text,10,'0'),
  'created_at',r.created_at,'activated_at',r.activated_at,'unit_reward_no',r.unit_reward_no)
 FROM efhc_core.referral_links r
 UNION ALL SELECT 'referral_bonuses', b.id::text, jsonb_build_object(
  'id',b.id::text,'global_id',lpad(b.global_id::text,10,'0'),
  'amount_efhc',b.amount_efhc::numeric(30,8)::text,'kind',b.kind,'created_at',b.created_at)
 FROM efhc_core.referral_bonus_ledger b
 UNION ALL SELECT 'task_submissions', t.id::text, jsonb_build_object(
  'id',t.id::text,'global_id',lpad(t.global_id::text,10,'0'),'task_id',t.task_id::text,
  'status',t.status,'bonus_amount_efhc',t.bonus_amount_efhc::numeric(30,8)::text,
  'paid',t.paid,'paid_tx_id',t.paid_tx_id::text,'created_at',t.created_at,'updated_at',t.updated_at)
 FROM efhc_core.task_submissions t
 UNION ALL SELECT 'ad_reward_sessions', a.session_id::text, jsonb_build_object(
  'id',a.session_id,'session_id',a.session_id,'global_id',lpad(a.global_id::text,10,'0'),
  'task_code',a.task_code,'status',a.status,'primary_provider',a.primary_provider,
  'actual_provider',a.actual_provider,'reward_snapshot_efhcb',a.reward_snapshot_efhcb::numeric(30,8)::text,
  'started_at',a.started_at,'rewarded_at',a.rewarded_at,'expires_at',a.expires_at,'test_mode',a.test_mode)
 FROM efhc_core.ad_sessions a;
