import type { ReactNode } from "react";
import type { ClientConfig } from "@launchpadfactoryteam/config";
import type { CatalogProduct, ContentSnapshot } from "@launchpadfactoryteam/content";
import { jsonLdScript } from "@launchpadfactoryteam/seo";

export type Variant = "A" | "B" | "C";

/** Tout ce qu'une page reçoit : configuration validée et contenus figés au build. */
export interface Site {
  config: ClientConfig;
  content: ContentSnapshot;
}

/** 1250 → « 12,50 € » (espace insécable avant l'euro). */
export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")}\u00a0€`;
}

/** 5.5 → « 5,5 % ». */
export function formatVat(rate: number): string {
  return `${String(rate).replace(".", ",")}\u00a0%`;
}

export const productHref = (p: Pick<CatalogProduct, "slug">) => `/produits/${p.slug}`;
export const categoryHref = (slug?: string) => (slug ? `/boutique/${slug}` : "/boutique");

/** Badge d'une carte : l'indisponibilité prime, puis la mention alcool si l'option est active. */
export function productBadge(p: CatalogProduct, config: ClientConfig): string | null {
  if (!p.available) return "Indisponible";
  if (p.isAlcohol && config.features.alcool) return "Alcool · 18 ans";
  return null;
}

export const EVIN_TEXT = "L'abus d'alcool est dangereux pour la santé. À consommer avec modération.";

export function showsAlcohol(products: readonly CatalogProduct[], config: ClientConfig): boolean {
  return config.features.alcool && products.some((p) => p.isAlcohol);
}

/** Mention sanitaire, sur toute page qui montre un produit alcoolisé (loi Évin). */
export function EvinNotice() {
  return <p className="notice-evin">{EVIN_TEXT} La vente d'alcool aux mineurs de moins de 18 ans est interdite.</p>;
}

/** Photo produit, ou motif neutre sans texte tant qu'aucune photo n'est fournie. */
export function ProductMedia({
  product,
  ratio,
  className,
  priority = false,
  children,
}: {
  product: CatalogProduct;
  ratio: "4/5" | "3/4" | "1/1";
  className?: string;
  priority?: boolean;
  children?: ReactNode;
}) {
  const image = product.images?.[0];
  const [w, h] = ratio.split("/").map(Number) as [number, number];
  return (
    <div className={`media ${className ?? ""}`} style={{ aspectRatio: ratio }}>
      {image ? (
        <img
          src={image.url}
          alt={image.alt ?? product.name}
          width={w * 200}
          height={h * 200}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <div className="ph" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}

/** Image décorative de mise en page (devanture, portrait…) : emplacement neutre, ignoré des lecteurs d'écran. */
export function Placeholder({ ratio, className }: { ratio?: string; className?: string }) {
  return (
    <div className={`ph ${className ?? ""}`} style={ratio ? { aspectRatio: ratio } : undefined} aria-hidden="true" />
  );
}

/** Bouton d'ajout au panier ; désactivé et libellé « Indisponible » pour un produit coupé. Le panier arrive au lot 4. */
export function AddButton({
  product,
  className,
  label = "Ajouter",
}: {
  product: CatalogProduct;
  className: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`btn ${className}`}
      data-add-to-cart={product.id}
      disabled={!product.available}
      aria-label={product.available ? `${label} : ${product.name}` : `${product.name} indisponible`}
    >
      {product.available ? label : "Indisponible"}
    </button>
  );
}

/** Ingrédients avec les allergènes mis en évidence (règlement INCO). */
export function Ingredients({ product }: { product: CatalogProduct }) {
  const allergens = product.inco.allergens ?? [];
  return (
    <>
      {product.inco.ingredients}
      {allergens.length > 0 && (
        <>
          {" "}
          <strong>Allergènes : {allergens.join(", ")}.</strong>
        </>
      )}
      {product.inco.mayContain && <> Peut contenir des traces de {product.inco.mayContain}.</>}
    </>
  );
}

/** Bloc réglementaire complet de la fiche produit. */
export function IncoBlock({ product, className }: { product: CatalogProduct; className?: string }) {
  const rows: [string, ReactNode][] = [
    ["Dénomination", product.inco.denomination],
    ["Ingrédients", <Ingredients key="i" product={product} />],
    ["Quantité nette", product.inco.netQuantity],
    ["Conservation", product.inco.storage],
    ["Fabricant", product.inco.manufacturer],
  ];
  if (product.inco.origin) rows.push(["Origine", product.inco.origin]);
  if (product.isAlcohol && product.abv)
    rows.push(["Titre alcoométrique", `${String(product.abv).replace(".", ",")} % vol.`]);
  return (
    <dl className={`inco ${className ?? ""}`}>
      {rows.map(([dt, dd]) => (
        <div key={dt}>
          <dt>{dt}</dt>
          <dd>{dd}</dd>
        </div>
      ))}
    </dl>
  );
}

export const DLC_TEXT =
  "La date limite de consommation, qui dépend du lot, vous est communiquée au moment du retrait en boutique.";

/** Filtres de catégorie : des liens, donc aucun JavaScript, et une page indexable par catégorie. */
export function CategoryFilter({
  products,
  active,
  className,
  allLabel = "Tout",
}: {
  products: readonly CatalogProduct[];
  active?: string;
  className?: string;
  allLabel?: string;
}) {
  const categories = [...new Map(products.map((p) => [p.category.slug, p.category.name])).entries()];
  const items: [string | undefined, string][] = [[undefined, allLabel], ...categories];
  return (
    <nav aria-label="Filtrer par catégorie">
      <ul className={`filters ${className ?? ""}`}>
        {items.map(([slug, name]) => (
          <li key={slug ?? "tout"}>
            <a href={categoryHref(slug)} aria-current={slug === active ? "page" : undefined}>
              {name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}

export function SkipLink() {
  return (
    <a className="skip-link" href="#contenu">
      Aller au contenu
    </a>
  );
}

export function Required() {
  return (
    <span className="req" aria-hidden="true">
      {" "}
      *
    </span>
  );
}
