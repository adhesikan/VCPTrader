// Single source of truth for promo configuration
// Jan 30, 2026 11:59:59.999 PM America/New_York = Jan 31, 2026 04:59:59.999 UTC
export const PROMO_END_ISO = "2026-01-31T04:59:59.999Z";
export const PROMO_CODE = "EARLYBIRD50";

export const PROMO_CONFIG = {
  standardPrice: 129,
  promoPrice: 59,
  discountPercent: 50,
  planName: "VCP Trader Pro",
  endDateDisplay: "Jan 30, 2026",
};

export function isPromoActive(): boolean {
  return Date.now() < new Date(PROMO_END_ISO).getTime();
}

export function getPromoEndDate(): Date {
  return new Date(PROMO_END_ISO);
}
