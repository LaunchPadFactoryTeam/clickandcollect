import type { CatalogProduct } from "@launchpadfactoryteam/content";
import {
  AddButton,
  formatPrice,
  ProductMedia,
  productBadge,
  productHref,
  type Site,
  type Variant,
} from "../shared.tsx";

/**
 * Carte produit, même contenu dans les trois templates : visuel, catégorie, dénomination, format, prix,
 * mention d'indisponibilité. Jamais d'allergène sur la carte, toujours sur la fiche.
 */
export function ProductCard({
  product,
  site,
  variant,
  headingLevel = 3,
  priority = false,
}: {
  product: CatalogProduct;
  site: Site;
  variant: Variant;
  headingLevel?: 2 | 3;
  priority?: boolean;
}) {
  const badge = productBadge(product, site.config);
  const H = headingLevel === 2 ? "h2" : "h3";
  const v = variant.toLowerCase();
  const name = (
    <H className="card__name">
      <a href={productHref(product)}>{product.name}</a>
    </H>
  );
  const media = (
    <ProductMedia product={product} ratio={variant === "B" ? "3/4" : "4/5"} className="card__media" priority={priority}>
      {badge && <span className={`card__badge${product.available ? "" : " card__badge--off"}`}>{badge}</span>}
    </ProductMedia>
  );
  if (variant === "B") {
    return (
      <article className={`card card--b${product.available ? "" : " unavailable"}`}>
        {media}
        <div className="card__body">
          <p className="card__cat">{product.category.name}</p>
          {name}
          <p className="card__format">
            {product.format} · <span className="price">{formatPrice(product.priceTtcCents)}</span>
          </p>
          <AddButton product={product} shop={site.config.boutique.domaine} className="card__add" />
        </div>
      </article>
    );
  }
  return (
    <article className={`card card--${v}${product.available ? "" : " unavailable"}`}>
      {media}
      <div className="card__body">
        <p className="card__cat">{product.category.name}</p>
        {name}
        <p className="card__format">{product.format}</p>
        <div className="card__buy">
          <span className="price card__price">{formatPrice(product.priceTtcCents)}</span>
          <AddButton product={product} shop={site.config.boutique.domaine} className="card__add" />
        </div>
      </div>
    </article>
  );
}

export function ProductList({
  products,
  site,
  variant,
  headingLevel = 2,
}: {
  products: readonly CatalogProduct[];
  site: Site;
  variant: Variant;
  headingLevel?: 2 | 3;
}) {
  return (
    <ul className={`products products--${variant.toLowerCase()}`}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} site={site} variant={variant} headingLevel={headingLevel} priority={i < 2} />
        </li>
      ))}
    </ul>
  );
}
