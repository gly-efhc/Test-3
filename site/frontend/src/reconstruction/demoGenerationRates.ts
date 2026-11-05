/** C28: immutable public-only mirror, never backend generation authority.
 * Runtime ENV must be server-only; never use NEXT_PUBLIC_* for rate authority.
 */
export const BASE_RATE = '0.00000692' as const;
export const VIP_RATE = '0.00000741' as const;
export const GENERATION_RATES = Object.freeze({base: BASE_RATE,vip: VIP_RATE});
