import type { ClientConfig } from "@launchpadfactoryteam/config";
import { RETENTION } from "./retention.ts";

/**
 * Pages légales générées depuis la configuration de la boutique (section 1.11) : mentions légales, CGV, politique de
 * confidentialité, cookies, exercice des droits, déclaration d'accessibilité. Les textes sont communs à toutes les
 * boutiques et versionnés ici ; ils doivent être validés par le juriste avant la première mise en ligne.
 */

/** Version des textes : à changer à chaque modification de fond (affichée en bas de chaque page). */
export const LEGAL_VERSION = "2026-10-04";

export type LegalBlock = string | { list: string[] } | { facts: [label: string, value: string][] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  /** Une phrase pour la balise description. */
  description: string;
  sections: LegalSection[];
}

export const LEGAL_SLUGS = [
  "mentions-legales",
  "cgv",
  "confidentialite",
  "cookies",
  "mes-droits",
  "accessibilite",
] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export interface LegalInput {
  config: ClientConfig;
  /** Email public de la boutique (contenus du site). */
  shopEmail: string;
}

/** Prestataires techniques, communs à toutes les boutiques. */
export const PROCESSORS = [
  {
    name: "Cloudflare, Inc.",
    role: "hébergement du site et diffusion des pages",
    location: "101 Townsend Street, San Francisco, CA 94107, États-Unis ; serveurs au plus près des visiteurs",
    transfer: true,
  },
  {
    name: "Supabase, Inc.",
    role: "base de données des commandes",
    location: "données hébergées dans l'Union européenne",
    transfer: false,
  },
  {
    name: "Stripe Payments Europe, Ltd.",
    role: "paiement en ligne (les données de carte ne passent jamais par le site)",
    location: "Dublin, Irlande",
    transfer: true,
  },
  {
    name: "Sendinblue SAS (Brevo)",
    role: "envoi des emails de commande et de contact",
    location: "Paris, France",
    transfer: false,
  },
] as const;

const ACCESSIBILITY_STATE: Record<ClientConfig["legal"]["accessibilite"]["etat"], string> = {
  non_conforme: "non conforme",
  partiellement_conforme: "partiellement conforme",
  totalement_conforme: "totalement conforme",
};

/** Libellé du lien de pied de page, d'après l'état déclaré. */
export const accessibilityLabel = (config: ClientConfig) =>
  `Accessibilité : ${ACCESSIBILITY_STATE[config.legal.accessibilite.etat]}`;

/** « +33467000000 » → « 04 67 00 00 00 ». */
function phone(e164: string): string {
  const national = e164.replace(/^\+33/, "0");
  return /^0\d{9}$/.test(national) ? national.replace(/(\d\d)(?=\d)/g, "$1 ") : e164;
}

/** « 12345678900012 » → « 123 456 789 00012 ». */
export const formatSiret = (siret: string) => siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4");

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

function company(config: ClientConfig): string {
  const { legal } = config;
  const form = [legal.forme_juridique, legal.capital && `au capital de ${legal.capital}`].filter(Boolean).join(" ");
  return form ? `${legal.raison_sociale}, ${form}` : legal.raison_sociale;
}

export function legalDocuments(input: LegalInput): Record<LegalSlug, LegalDocument> {
  return {
    "mentions-legales": mentions(input),
    cgv: cgv(input),
    confidentialite: privacy(input),
    cookies: cookies(input),
    "mes-droits": rights(input),
    accessibilite: accessibility(input),
  };
}

function mentions({ config, shopEmail }: LegalInput): LegalDocument {
  const { boutique, legal } = config;
  const facts: [string, string][] = [
    ["Société", company(config)],
    ["Siège social", legal.adresse_siege ?? boutique.adresse],
    ["SIRET", formatSiret(legal.siret)],
  ];
  if (legal.rcs) facts.push(["Immatriculation", legal.rcs]);
  if (legal.tva_intracommunautaire) facts.push(["TVA intracommunautaire", legal.tva_intracommunautaire]);
  facts.push(["Téléphone", phone(boutique.telephone)], ["Email", shopEmail]);
  return {
    slug: "mentions-legales",
    title: "Mentions légales",
    description: `Éditeur, directeur de la publication et hébergeur du site ${boutique.domaine}.`,
    sections: [
      { heading: "Éditeur du site", blocks: [`Le site ${boutique.domaine} est édité par :`, { facts }] },
      { heading: "Directeur de la publication", blocks: [legal.directeur_publication] },
      {
        heading: "Hébergement",
        blocks: [
          "Le site est hébergé par Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis (www.cloudflare.com).",
          "Les données des commandes sont hébergées dans l'Union européenne par Supabase, Inc. (supabase.com).",
        ],
      },
      {
        heading: "Conception",
        blocks: ["Site conçu et maintenu par LaunchPad, prestataire technique de la boutique."],
      },
      {
        heading: "Propriété intellectuelle",
        blocks: [
          `Les textes, photographies, logos et éléments graphiques du site sont la propriété de ${legal.raison_sociale} ou utilisés avec l'accord de leurs auteurs. Toute reproduction sans autorisation est interdite.`,
        ],
      },
      {
        heading: "Données personnelles et cookies",
        blocks: [
          "Le traitement de vos données est décrit dans la politique de confidentialité, et l'usage des cookies dans la page Gestion des cookies.",
        ],
      },
    ],
  };
}

function cgv({ config, shopEmail }: LegalInput): LegalDocument {
  const { boutique, legal, features } = config;
  const sections: LegalSection[] = [
    {
      heading: "Objet",
      blocks: [
        `Les présentes conditions régissent les commandes passées sur ${boutique.domaine} auprès de ${company(config)}, ${legal.adresse_siege ?? boutique.adresse}, SIRET ${formatSiret(legal.siret)}, ci-après « la boutique ». Elles s'appliquent aux clients consommateurs. Passer commande vaut acceptation de ces conditions, cochée au moment du paiement.`,
      ],
    },
    {
      heading: "Produits et prix",
      blocks: [
        "Les produits sont décrits sur leur fiche avec leurs informations réglementaires (dénomination, quantité, ingrédients et allergènes, conditions de conservation, origine lorsqu'elle est obligatoire).",
        "Les prix sont indiqués en euros, toutes taxes comprises, TVA au taux applicable incluse. Le retrait en boutique est gratuit. Le prix payé est celui affiché au moment de la commande.",
        "Un produit indiqué indisponible ne peut pas être commandé. Si un produit commandé ne pouvait finalement pas être fourni, la boutique vous en informe et vous rembourse le produit manquant.",
      ],
    },
    {
      heading: "Commande",
      blocks: [
        {
          list: [
            "Vous ajoutez les produits au panier et choisissez un créneau de retrait parmi ceux proposés.",
            "Vous vérifiez le récapitulatif, acceptez les présentes conditions et payez en ligne.",
            "La commande est ferme dès la confirmation du paiement ; un email de confirmation récapitule son numéro, son contenu, le montant payé et le créneau de retrait.",
          ],
        },
      ],
    },
    {
      heading: "Paiement",
      blocks: [
        "Le paiement se fait en ligne, par carte bancaire, Apple Pay ou Google Pay, par l'intermédiaire de Stripe. Le montant est débité à la commande. Les données de carte sont traitées par Stripe et ne sont jamais transmises à la boutique.",
      ],
    },
    {
      heading: "Retrait",
      blocks: [
        `La commande se retire à la boutique, ${boutique.adresse}, pendant le créneau choisi. Un email vous prévient quand elle est prête. Présentez votre nom ou votre numéro de commande.`,
        `En cas d'empêchement, contactez la boutique au ${phone(boutique.telephone)} ou à ${shopEmail} pour convenir d'un autre moment.`,
      ],
    },
    {
      heading: "Droit de rétractation",
      blocks: [
        "Le droit de rétractation ne s'applique pas aux denrées susceptibles de se détériorer ou de se périmer rapidement (article L221-28, 4° du Code de la consommation), ni aux produits descellés après la livraison qui ne peuvent être renvoyés pour des raisons d'hygiène (article L221-28, 5°).",
        `Pour les autres produits, vous disposez de 14 jours à compter du retrait pour vous rétracter, sans avoir à vous justifier, en l'indiquant à ${shopEmail} par une déclaration sans ambiguïté. Vous rapportez les produits intacts à la boutique dans les 14 jours suivants ; la boutique vous rembourse dans les 14 jours suivant votre demande, par le moyen de paiement utilisé.`,
      ],
    },
    {
      heading: "Garanties légales",
      blocks: [
        "Les produits bénéficient de la garantie légale de conformité (articles L217-3 et suivants du Code de la consommation) et de la garantie des vices cachés (articles 1641 et suivants du Code civil). Signalez tout défaut à la boutique dès que possible.",
      ],
    },
  ];
  if (features.alcool) {
    sections.push({
      heading: "Boissons alcoolisées",
      blocks: [
        "La vente de boissons alcoolisées est interdite aux mineurs (article L3342-1 du Code de la santé publique). En commandant un tel produit, vous déclarez avoir 18 ans ou plus ; une pièce d'identité peut vous être demandée au retrait, et le produit refusé si vous ne pouvez pas la présenter. L'abus d'alcool est dangereux pour la santé, à consommer avec modération.",
      ],
    });
  }
  sections.push(
    {
      heading: "Réclamations et médiation",
      blocks: [
        `Pour toute réclamation, contactez d'abord la boutique à ${shopEmail}. À défaut de solution, vous pouvez recourir gratuitement au médiateur de la consommation : ${legal.mediateur.nom} (${legal.mediateur.site}).`,
      ],
    },
    {
      heading: "Données personnelles",
      blocks: [
        "Les données nécessaires à la commande sont traitées comme indiqué dans la politique de confidentialité.",
      ],
    },
    { heading: "Droit applicable", blocks: ["Les présentes conditions sont soumises au droit français."] },
  );
  return {
    slug: "cgv",
    title: "Conditions générales de vente",
    description: `Commande, paiement, retrait en boutique, rétractation et garanties chez ${boutique.nom}.`,
    sections,
  };
}

function privacy({ config }: LegalInput): LegalDocument {
  const { boutique, legal } = config;
  const r = RETENTION;
  return {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    description: `Quelles données ${boutique.nom} collecte, pourquoi, combien de temps, et comment exercer vos droits.`,
    sections: [
      {
        heading: "Responsable du traitement",
        blocks: [
          `${company(config)}, ${legal.adresse_siege ?? boutique.adresse}, est responsable du traitement des données collectées sur ${boutique.domaine}. Pour toute question : ${legal.contact_rgpd}.`,
          "LaunchPad, prestataire technique de la boutique, traite ces données pour son compte en qualité de sous-traitant, dans le cadre d'un contrat conforme à l'article 28 du RGPD.",
        ],
      },
      {
        heading: "Données collectées et finalités",
        blocks: [
          {
            list: [
              "Commande : nom saisi au paiement, email, téléphone s'il est donné, produits, montants et créneau de retrait. Finalité : préparer et remettre la commande, vous tenir informé (exécution du contrat).",
              "Factures et lignes de vente : obligation comptable de la boutique (obligation légale).",
              "Offres de la boutique : email et preuve de votre accord, seulement si vous avez coché la case prévue (consentement, retirable à tout moment).",
              "Formulaire de contact : nom, email et message, transmis par email à la boutique pour vous répondre (intérêt légitime ; ils ne sont pas conservés sur le site).",
              "Sécurité : journaux techniques minimaux pour protéger le site contre les abus (intérêt légitime).",
            ],
          },
          "Les données de carte bancaire sont saisies chez Stripe et ne sont jamais connues de la boutique. Aucun profilage ni aucune publicité ciblée n'est réalisé.",
        ],
      },
      {
        heading: "Durées de conservation",
        blocks: [
          {
            facts: [
              ["Coordonnées des clients", `${r.customerYears} ans après la dernière commande, puis effacées`],
              ["Accord pour les offres", `jusqu'au retrait, ou ${r.consentYears} ans sans commande`],
              ["Preuve de cet accord", `${r.consentProofYears} ans en archive après son retrait ou son expiration`],
              ["Liste des désinscrits", `${r.unsubscribeMinYears} ans au moins, pour ne plus vous écrire`],
              ["Montants et lignes de vente", `${r.salesYears} ans, sans aucune donnée personnelle`],
              ["Messages de contact", `chez la boutique, ${r.contactYears} ans au plus après le dernier échange`],
            ],
          },
          "Ces durées sont appliquées automatiquement chaque mois.",
        ],
      },
      {
        heading: "Pseudonymisation",
        blocks: [
          "Pour reconnaître un client fidèle sans conserver plus de données que nécessaire, la boutique calcule une empreinte de votre email avec une clé secrète qui lui est propre (HMAC-SHA256). Cette empreinte ne permet pas de retrouver l'email et diffère d'une boutique à l'autre. Elle est effacée avec vos coordonnées.",
        ],
      },
      {
        heading: "Destinataires et prestataires",
        blocks: [
          "Vos données sont destinées à la boutique et à ses prestataires techniques, qui n'en font aucun autre usage :",
          { list: PROCESSORS.map((p) => `${p.name} : ${p.role} (${p.location}).`) },
          "Lorsque des données sont traitées hors de l'Union européenne (Cloudflare, Stripe), le transfert est encadré par le cadre de protection des données UE–États-Unis ou par les clauses contractuelles types de la Commission européenne.",
        ],
      },
      {
        heading: "Vos droits",
        blocks: [
          `Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, et du droit de retirer votre accord à tout moment. Écrivez à ${legal.contact_rgpd} ; la page Exercer mes droits détaille la marche à suivre. Une réponse vous est apportée dans un délai d'un mois.`,
          "Vous pouvez aussi introduire une réclamation auprès de la CNIL (www.cnil.fr).",
        ],
      },
      {
        heading: "Cookies",
        blocks: [
          "Le site ne dépose aucun cookie publicitaire ni de mesure d'audience : voir la page Gestion des cookies.",
        ],
      },
    ],
  };
}

function cookies({ config }: LegalInput): LegalDocument {
  const audience = config.audience.umami_website_id
    ? "La fréquentation est mesurée par Umami, sans cookie et sans donnée personnelle : aucune adresse IP n'est conservée et aucun visiteur n'est suivi d'un site à l'autre."
    : "Aucun outil de mesure d'audience n'est utilisé.";
  return {
    slug: "cookies",
    title: "Gestion des cookies",
    description:
      "Le site ne dépose aucun cookie publicitaire ni de mesure d'audience : aucun bandeau n'est nécessaire.",
    sections: [
      {
        heading: "Aucun cookie sur les pages du site",
        blocks: [
          "La consultation des pages du site ne dépose aucun cookie et aucun traceur publicitaire. C'est pourquoi aucun bandeau de consentement ne vous est présenté.",
          audience,
        ],
      },
      {
        heading: "Stockage strictement nécessaire",
        blocks: [
          {
            list: [
              "Panier : son contenu est gardé dans le stockage local de votre navigateur, sur votre appareil, pour ne pas le perdre en changeant de page. Il n'est envoyé à personne et disparaît une fois la commande payée.",
              "Paiement : sur la page de paiement, Stripe dépose des cookies nécessaires à la sécurité de la transaction et à la lutte contre la fraude.",
              "Espace commerçant : la connexion de la boutique à son espace de gestion utilise des cookies de session.",
            ],
          },
          "Ces stockages sont exemptés de consentement car indispensables au service que vous demandez. Vous pouvez les effacer à tout moment depuis les réglages de votre navigateur.",
        ],
      },
    ],
  };
}

function rights({ config }: LegalInput): LegalDocument {
  const { legal, boutique } = config;
  return {
    slug: "mes-droits",
    title: "Exercer mes droits",
    description: `Obtenir une copie de vos données ou les faire effacer auprès de ${boutique.nom}.`,
    sections: [
      {
        heading: "Comment faire",
        blocks: [
          `Écrivez à ${legal.contact_rgpd} depuis l'adresse email utilisée pour vos commandes, en précisant votre demande :`,
          {
            list: [
              "Accès et portabilité : vous recevez toutes vos commandes et vos accords sur cette boutique, dans un fichier lisible (JSON).",
              "Effacement : vos nom, email et téléphone sont effacés de toutes vos commandes, et votre accord pour les offres est retiré.",
              "Rectification, limitation ou opposition : indiquez ce que vous souhaitez modifier ou arrêter.",
              "Retrait de votre accord pour les offres : il prend effet immédiatement.",
            ],
          },
          "Écrire depuis l'adresse de vos commandes nous permet de vérifier votre identité sans vous demander de pièce justificative. À défaut, une vérification complémentaire peut vous être demandée.",
        ],
      },
      {
        heading: "Délai et suites",
        blocks: [
          "Une réponse vous est apportée dans un délai d'un mois. Chaque demande est enregistrée, sans conserver votre email en clair.",
          "Les montants et lignes de vente restent conservés, sans donnée personnelle, pour les obligations comptables de la boutique.",
          "Si la réponse ne vous satisfait pas, vous pouvez saisir la CNIL (www.cnil.fr).",
        ],
      },
    ],
  };
}

function accessibility({ config, shopEmail }: LegalInput): LegalDocument {
  const { legal, boutique } = config;
  const a = legal.accessibilite;
  const state = ACCESSIBILITY_STATE[a.etat];
  const results =
    a.etat === "non_conforme"
      ? "Aucun audit de conformité au RGAA n'a encore été réalisé. En l'absence d'audit, le site est déclaré non conforme, bien qu'il ait été conçu pour respecter le RGAA."
      : `Un audit réalisé le ${longDate(a.date_audit!)}${a.taux_conformite !== undefined ? ` révèle que ${a.taux_conformite} % des critères du RGAA sont respectés` : " a établi ce niveau de conformité"}.`;
  return {
    slug: "accessibilite",
    title: "Déclaration d'accessibilité",
    description: `État de conformité de ${boutique.domaine} au référentiel général d'amélioration de l'accessibilité (RGAA).`,
    sections: [
      {
        heading: "Engagement",
        blocks: [
          `${legal.raison_sociale} s'engage à rendre son site accessible, conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005. Cette déclaration s'applique à ${boutique.domaine}.`,
        ],
      },
      {
        heading: "État de conformité",
        blocks: [`Le site ${boutique.domaine} est ${state} avec le RGAA, version 4.1.`],
      },
      {
        heading: "Résultats des tests",
        blocks: [
          results,
          "Chaque version du site est vérifiée automatiquement (outil axe) sur toutes ses pages, sans violation sérieuse ou critique, ainsi qu'à la navigation au clavier et aux contrastes de couleurs.",
        ],
      },
      {
        heading: "Établissement de cette déclaration",
        blocks: [
          {
            facts: [
              ["Technologies utilisées", "HTML, CSS, JavaScript"],
              ["Version des textes", LEGAL_VERSION],
            ],
          },
        ],
      },
      {
        heading: "Retour d'information et contact",
        blocks: [
          `Si vous ne pouvez pas accéder à un contenu ou à un service, contactez la boutique à ${shopEmail} ou au ${phone(boutique.telephone)} : une alternative accessible vous sera proposée.`,
        ],
      },
      {
        heading: "Voies de recours",
        blocks: [
          "Si vous constatez un défaut d'accessibilité qui vous empêche d'accéder à un contenu, et que vous n'avez pas obtenu de réponse satisfaisante, vous pouvez saisir le Défenseur des droits : formulaire en ligne sur www.defenseurdesdroits.fr, téléphone 09 69 39 00 00, ou courrier gratuit à Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.",
        ],
      },
    ],
  };
}
