/**
 * Durées de conservation du cadrage (section 1.10), appliquées chaque mois par la base (app.apply_retention) et
 * reprises dans la politique de confidentialité. Le cadrage fait foi.
 */
export const RETENTION = {
  /** Coordonnées et empreinte du client, à compter de sa dernière commande. */
  customerYears: 3,
  /** Consentement marketing sans nouvelle commande, puis archivé. */
  consentYears: 3,
  /** Preuve d'un consentement archivé (retiré ou expiré). */
  consentProofYears: 5,
  /** Liste des désinscrits : au moins 3 ans. */
  unsubscribeMinYears: 3,
  /** Montants et lignes de vente, sans donnée personnelle (obligation comptable). */
  salesYears: 10,
  /** Messages du formulaire de contact, chez le commerçant, après le dernier échange. */
  contactYears: 3,
} as const;
