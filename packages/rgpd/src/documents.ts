import type { ClientConfig } from "@launchpadfactoryteam/config";
import { formatSiret, LEGAL_VERSION, PROCESSORS } from "./legal.ts";
import { RETENTION } from "./retention.ts";

/**
 * Modèles documentaires remplis depuis la configuration (lot 8) : contrat de sous-traitance (article 28 du RGPD)
 * entre le commerçant et LaunchPad, et fiche du registre des traitements du commerçant. En Markdown, à relire,
 * compléter (champs entre crochets) et signer : ils ne remplacent pas l'avis du juriste.
 */

const shopAddress = (c: ClientConfig) => c.legal.adresse_siege ?? c.boutique.adresse;
const r = RETENTION;

export function processingAgreement(config: ClientConfig): string {
  const { legal, boutique } = config;
  return `# Contrat de sous-traitance de données personnelles

Modèle LaunchPad, version ${LEGAL_VERSION}. À relire et signer avant la mise en ligne de ${boutique.domaine}.

## Parties

- **Responsable du traitement** : ${legal.raison_sociale}${legal.forme_juridique ? `, ${legal.forme_juridique}` : ""}, ${shopAddress(config)}, SIRET ${formatSiret(legal.siret)}, représentée par ${legal.directeur_publication}.
- **Sous-traitant** : LaunchPad, [forme juridique, adresse, SIRET], représentée par [nom du représentant].

## Objet

Le sous-traitant conçoit, héberge et maintient le site ${boutique.domaine}, son tunnel de commande, ses emails transactionnels et l'espace de gestion de la boutique. Il traite pour cela des données personnelles pour le compte du responsable du traitement, sur ses seules instructions documentées, dans le respect de l'article 28 du RGPD.

## Description des traitements

| | |
| --- | --- |
| Personnes concernées | Clients de la boutique ; visiteurs utilisant le formulaire de contact |
| Données | Nom, email, téléphone, contenu des commandes, créneau de retrait, accord pour les offres et sa preuve, messages de contact |
| Finalités | Prise et suivi des commandes, emails de commande, réponse aux messages, offres pour les clients ayant donné leur accord |
| Durée | Celle du contrat de prestation ; durées de conservation ci-dessous |

## Durées de conservation appliquées automatiquement

- Coordonnées et empreinte des clients : ${r.customerYears} ans après la dernière commande.
- Accord pour les offres : jusqu'au retrait ou ${r.consentYears} ans sans commande ; preuve archivée ${r.consentProofYears} ans.
- Liste des désinscrits : ${r.unsubscribeMinYears} ans au moins.
- Montants et lignes de vente : ${r.salesYears} ans, sans donnée personnelle.

## Obligations du sous-traitant

1. Traiter les données uniquement pour les finalités ci-dessus et sur instruction du responsable du traitement.
2. Garantir la confidentialité des données et former les personnes autorisées à les traiter.
3. Mettre en œuvre les mesures de sécurité décrites ci-dessous.
4. Ne recourir à un autre sous-traitant qu'avec l'accord écrit préalable du responsable du traitement ; les sous-traitants ultérieurs autorisés sont listés ci-dessous.
5. Aider le responsable du traitement à répondre aux demandes d'exercice des droits (export et effacement par email, journalisés).
6. Notifier toute violation de données dans les 48 heures après en avoir pris connaissance.
7. Au terme du contrat, restituer les données (export) puis les supprimer, sauf obligation légale de conservation.
8. Mettre à disposition les informations nécessaires pour démontrer le respect de ces obligations et permettre des audits.

## Mesures de sécurité

- Chiffrement des échanges (HTTPS) et des données au repos chez les hébergeurs.
- Cloisonnement des données par boutique dans la base (sécurité au niveau des lignes), vérifié par des tests automatisés.
- Aucune donnée de carte bancaire traitée : paiement chez Stripe.
- Empreinte des emails par HMAC-SHA256 avec une clé propre à la boutique.
- Comptes de l'espace de gestion créés par LaunchPad, blocage après 5 échecs de connexion en 15 minutes.
- Secrets conservés dans les coffres des hébergeurs, jamais dans le code.

## Sous-traitants ultérieurs autorisés

${PROCESSORS.map((p) => `- ${p.name} : ${p.role} (${p.location}).`).join("\n")}

Les transferts hors de l'Union européenne sont encadrés par le cadre de protection des données UE–États-Unis ou par les clauses contractuelles types de la Commission européenne.

## Signatures

Fait à [ville], le [date], en deux exemplaires.

| Pour ${legal.raison_sociale} | Pour LaunchPad |
| --- | --- |
| ${legal.directeur_publication} | [nom du représentant] |
`;
}

export function processingRecord(config: ClientConfig): string {
  const { legal, boutique } = config;
  return `# Registre des traitements — vente en click and collect

Fiche du registre de ${legal.raison_sociale} (article 30 du RGPD), modèle LaunchPad version ${LEGAL_VERSION}.

| Rubrique | Contenu |
| --- | --- |
| Responsable du traitement | ${legal.raison_sociale}, ${shopAddress(config)}, SIRET ${formatSiret(legal.siret)} |
| Contact pour les données personnelles | ${legal.contact_rgpd} |
| Nom du traitement | Commandes en ligne et retrait en boutique sur ${boutique.domaine} |
| Finalités | Prise, préparation et remise des commandes ; emails de commande ; réponse aux messages de contact ; offres aux clients ayant donné leur accord ; obligations comptables |
| Bases légales | Exécution du contrat (commandes) ; obligation légale (comptabilité) ; consentement (offres) ; intérêt légitime (messages, sécurité) |
| Personnes concernées | Clients ; visiteurs utilisant le formulaire de contact |
| Données | Nom, email, téléphone, contenu et montant des commandes, créneau, preuve de l'accord pour les offres, messages |
| Données sensibles | Aucune. Déclaration d'âge (18 ans ou plus) seulement pour les boissons alcoolisées, sans date de naissance |
| Destinataires | Personnel de la boutique ; LaunchPad (sous-traitant) |
| Sous-traitants | ${PROCESSORS.map((p) => p.name).join(" ; ")} |
| Transferts hors UE | Cloudflare et Stripe (États-Unis), encadrés par le cadre UE–États-Unis ou des clauses contractuelles types |
| Durées de conservation | Coordonnées : ${r.customerYears} ans après la dernière commande ; accord pour les offres : jusqu'au retrait ou ${r.consentYears} ans sans commande, preuve ${r.consentProofYears} ans ; désinscrits : ${r.unsubscribeMinYears} ans au moins ; ventes : ${r.salesYears} ans sans donnée personnelle |
| Mesures de sécurité | HTTPS ; cloisonnement par boutique ; paiement chez Stripe ; empreinte HMAC-SHA256 des emails ; blocage des connexions après 5 échecs ; durées appliquées automatiquement chaque mois |
| Exercice des droits | Par email à ${legal.contact_rgpd} ; export et effacement journalisés ; réponse sous un mois |
| Date de création de la fiche | [date] |
`;
}
