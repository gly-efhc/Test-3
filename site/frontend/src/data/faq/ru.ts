import type { FaqCatalog } from "./types";
import { faqCatalogByLang } from "./catalogs";

// Legacy compatibility alias.
// Active runtime source of truth: generated `catalogs.ts`.
export const faqRuCatalog: FaqCatalog = faqCatalogByLang.ru!;
