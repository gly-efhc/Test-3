/** Reconcile to the confirmed value immediately, including downward corrections.
 * This is display state, never a ledger write. */
export function reconcileEnergyAnchor(_previous: {base_scaled: bigint; base_client_ms: number}, confirmed: bigint, now: number) {
  return {base_scaled: confirmed < 0n ? 0n : confirmed, base_client_ms: now};
}
