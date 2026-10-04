/** @launchpadfactoryteam/rgpd — Empreintes, durées de conservation, pages légales et modèles documentaires (lot 8). */
export { customerHash, hmacSha256Hex, normalizeEmail, sha256Hex } from "./hash.ts";
export { RETENTION } from "./retention.ts";
export {
  accessibilityLabel,
  formatSiret,
  LEGAL_SLUGS,
  LEGAL_VERSION,
  legalDocuments,
  PROCESSORS,
  type LegalBlock,
  type LegalDocument,
  type LegalInput,
  type LegalSection,
  type LegalSlug,
} from "./legal.ts";
export { processingAgreement, processingRecord } from "./documents.ts";
