import type { CatalogProduct } from "@launchpadfactoryteam/content";
import { navLabel, PageShell } from "../chrome.tsx";
import {
  AddButton,
  categoryHref,
  DLC_TEXT,
  EvinNotice,
  formatPrice,
  formatVat,
  IncoBlock,
  Placeholder,
  ProductMedia,
  showsAlcohol,
  type Site,
  type Variant,
} from "../shared.tsx";

type Props = { site: Site; product: CatalogProduct };

function Breadcrumb({ product, variant }: { product: CatalogProduct; variant: Variant }) {
  return (
    <nav aria-label="Fil d'Ariane" className={`crumbs crumbs--${variant.toLowerCase()}`}>
      <ol>
        <li>
          <a href="/boutique">{navLabel(variant, "boutique")}</a>
        </li>
        <li>
          <a href={categoryHref(product.category.slug)}>{product.category.name}</a>
        </li>
        <li aria-current="page">{product.name}</li>
      </ol>
    </nav>
  );
}

function BuyRow({ product, variant }: { product: CatalogProduct; variant: Variant }) {
  const v = variant.toLowerCase();
  const price = <span className={`price ${v}-buy__price`}>{formatPrice(product.priceTtcCents)}</span>;
  const vat = <span className={`${v}-buy__vat`}>TVA {formatVat(product.vatRate)} incluse</span>;
  return (
    <div className={`${v}-buy`}>
      {variant === "C" ? (
        <div>
          {price}
          {vat}
        </div>
      ) : (
        <>
          {price}
          {vat}
        </>
      )}
      <AddButton product={product} label="Ajouter au panier" className={`${v}-btn ${v}-btn--primary ${v}-buy__add`} />
    </div>
  );
}

function Regulatory({ site, product, variant }: Props & { variant: Variant }) {
  const v = variant.toLowerCase();
  return (
    <>
      <h2 className={`${v}-reg-title`}>Informations réglementaires</h2>
      <IncoBlock product={product} className={`inco--${v}`} />
      <p className={`${v}-note`}>{DLC_TEXT}</p>
      {showsAlcohol([product], site.config) && <EvinNotice />}
    </>
  );
}

function Header({ product, variant }: { product: CatalogProduct; variant: Variant }) {
  const v = variant.toLowerCase();
  return (
    <>
      <p className={variant === "C" ? "c-chip c-chip--small" : `${v}-eyebrow ${v}-eyebrow--small`}>
        {variant === "A"
          ? [product.category.name, product.producer].filter(Boolean).join(" · ")
          : (product.producer ?? product.category.name)}
      </p>
      <h1 className={`${v}-product-title`}>{product.name}</h1>
      <p className={`${v}-product-format`}>{product.format}</p>
      {product.description && <p className={`${v}-product-desc`}>{product.description}</p>}
    </>
  );
}

/** A : photo et vignettes à gauche, texte à droite, bloc réglementaire encadré. */
export function ProductA({ site, product }: Props) {
  return (
    <PageShell site={site} variant="A" current="boutique">
      <article className="a-wrap a-product">
        <Breadcrumb product={product} variant="A" />
        <div className="a-product__grid">
          <div className="a-product__media">
            <ProductMedia product={product} ratio="4/5" className="a-frame" priority />
            <div className="a-thumbs" aria-hidden="true">
              <Placeholder ratio="1/1" className="a-frame" />
              <Placeholder ratio="1/1" className="a-frame" />
              <Placeholder ratio="1/1" className="a-frame" />
            </div>
          </div>
          <div className="a-product__text">
            <Header product={product} variant="A" />
            <BuyRow product={product} variant="A" />
            <Regulatory site={site} product={product} variant="A" />
          </div>
        </div>
      </article>
    </PageShell>
  );
}

/** B : photo plein cadre collante, cartel de texte à droite. */
export function ProductB({ site, product }: Props) {
  return (
    <PageShell site={site} variant="B" current="boutique">
      <article className="b-product">
        <ProductMedia product={product} ratio="4/5" className="b-product__media" priority />
        <div className="b-product__text">
          <Breadcrumb product={product} variant="B" />
          <Header product={product} variant="B" />
          <BuyRow product={product} variant="B" />
          <Regulatory site={site} product={product} variant="B" />
        </div>
      </article>
    </PageShell>
  );
}

/** C : tout dans une carte arrondie, prix sur un aplat chaud. */
export function ProductC({ site, product }: Props) {
  return (
    <PageShell site={site} variant="C" current="boutique">
      <article className="c-page">
        <Breadcrumb product={product} variant="C" />
        <div className="c-card c-product">
          <div className="c-product__media">
            <ProductMedia product={product} ratio="4/5" className="c-round" priority />
            <div className="c-thumbs" aria-hidden="true">
              <Placeholder ratio="1/1" className="c-round-sm" />
              <Placeholder ratio="1/1" className="c-round-sm" />
              <Placeholder ratio="1/1" className="c-round-sm" />
            </div>
          </div>
          <div className="c-product__text">
            <Header product={product} variant="C" />
            <BuyRow product={product} variant="C" />
            <Regulatory site={site} product={product} variant="C" />
          </div>
        </div>
      </article>
    </PageShell>
  );
}
