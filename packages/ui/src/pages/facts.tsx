import { formatOpeningHours } from "@launchpadfactoryteam/content";
import { displayPhone, pickupSummary, preparationLabel, splitAddress } from "@launchpadfactoryteam/seo";
import type { Site, Variant } from "../shared.tsx";

const tel = (e164: string) => `tel:${e164}`;

/** « Venir chercher sa commande » : adresse, créneaux, préparation, téléphone, en texte. */
export function PickupFacts({ site, variant }: { site: Site; variant: Variant }) {
  const { config } = site;
  const address = splitAddress(config.boutique.adresse);
  const slots = pickupSummary(config.retrait.creneaux);
  return (
    <dl className={`facts facts--pickup facts--${variant.toLowerCase()}`}>
      <div>
        <dt>Adresse</dt>
        <dd>
          {address.street}
          <br />
          {address.postalCode} {address.city}
        </dd>
      </div>
      <div>
        <dt>{variant === "B" ? "Créneaux" : "Créneaux de retrait"}</dt>
        <dd>
          {slots.map((s, i) => (
            <span key={s.days}>
              {i > 0 && <br />}
              {s.days}
              <br />
              {s.slots}
            </span>
          ))}
        </dd>
      </div>
      <div>
        <dt>Préparation</dt>
        <dd>
          {preparationLabel(config.retrait.delai_preparation_heures)}
          <br />
          {variant === "A" ? "Commande payée en ligne" : "Payé en ligne"}
        </dd>
      </div>
      <div>
        <dt>Téléphone</dt>
        <dd>
          <a href={tel(config.boutique.telephone)}>{displayPhone(config.boutique.telephone)}</a>
        </dd>
      </div>
    </dl>
  );
}

/** Coordonnées de la page Contact : adresse, horaires d'ouverture, téléphone et email. */
export function ContactFacts({ site, variant }: { site: Site; variant: Variant }) {
  const { config, content } = site;
  const { email } = content.pages.settings;
  const hours = formatOpeningHours(content.pages.settings.openingHours);
  const phone = <a href={tel(config.boutique.telephone)}>{displayPhone(config.boutique.telephone)}</a>;
  const mail = <a href={`mailto:${email}`}>{email}</a>;
  return (
    <dl className={`facts facts--contact facts--${variant.toLowerCase()}`}>
      <div>
        <dt>Adresse</dt>
        <dd>{config.boutique.adresse}</dd>
      </div>
      <div>
        <dt>{variant === "A" ? "Horaires d'ouverture" : "Horaires"}</dt>
        <dd>
          {hours.map((h, i) => (
            <span key={h}>
              {i > 0 && <br />}
              {h}
            </span>
          ))}
        </dd>
      </div>
      {variant === "A" ? (
        <>
          <div>
            <dt>Téléphone</dt>
            <dd>{phone}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{mail}</dd>
          </div>
        </>
      ) : (
        <div>
          <dt>{variant === "B" ? "Contact" : "Contact direct"}</dt>
          <dd>
            {phone}
            <br />
            {mail}
          </dd>
        </div>
      )}
    </dl>
  );
}
