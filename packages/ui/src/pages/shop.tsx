import { PageShell } from "../chrome.tsx";
import { CategoryFilter, EvinNotice, showsAlcohol, type Site, type Variant } from "../shared.tsx";
import { ProductList } from "./cards.tsx";

/** Liste des produits, filtrable par catégorie (une page statique par catégorie). */
function Shop({ site, variant, category }: { site: Site; variant: Variant; category?: string }) {
  const { shop } = site.content.pages;
  const all = site.content.catalog;
  const products = category ? all.filter((p) => p.category.slug === category) : all;
  const v = variant.toLowerCase();
  const categoryName = category ? products[0]?.category.name : undefined;
  return (
    <PageShell site={site} variant={variant} current="boutique">
      <section className={`${v}-wrap ${v}-page`}>
        <h1 className={`${v}-title`}>
          {shop.title}
          {categoryName && <span className="sr-only"> : {categoryName}</span>}
        </h1>
        <p className={`${v}-intro`}>{shop.lead}</p>
        <CategoryFilter products={all} active={category} className={`filters--${v}`} />
        <ProductList products={products} site={site} variant={variant} headingLevel={2} />
        {showsAlcohol(products, site.config) && <EvinNotice />}
      </section>
    </PageShell>
  );
}

export const ShopA = (props: { site: Site; category?: string }) => <Shop {...props} variant="A" />;
export const ShopB = (props: { site: Site; category?: string }) => <Shop {...props} variant="B" />;
export const ShopC = (props: { site: Site; category?: string }) => <Shop {...props} variant="C" />;
