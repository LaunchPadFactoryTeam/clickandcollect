import type { ClientConfig } from "@launchpadfactoryteam/config";
import type { CatalogProduct } from "@launchpadfactoryteam/content";
import { CartA, CartB, CartC, ConfirmationStep, PaymentStep } from "./pages/cart.tsx";
import { ContactA, ContactB, ContactC } from "./pages/contact.tsx";
import { HomeA, HomeB, HomeC } from "./pages/home.tsx";
import { ProductA, ProductB, ProductC } from "./pages/product.tsx";
import { ShopA, ShopB, ShopC } from "./pages/shop.tsx";
import { StoryA, StoryB, StoryC } from "./pages/story.tsx";
import type { Site, Variant } from "./shared.tsx";

/** Les variantes de chaque page ; le choix se fait page par page dans design.variantes. */
export const PAGES = {
  accueil: { A: HomeA, B: HomeB, C: HomeC },
  boutique: { A: ShopA, B: ShopB, C: ShopC },
  fiche_produit: { A: ProductA, B: ProductB, C: ProductC },
  epicerie: { A: StoryA, B: StoryB, C: StoryC },
  contact: { A: ContactA, B: ContactB, C: ContactC },
  panier: { A: CartA, B: CartB, C: CartC },
} as const;

export type PageKey = keyof typeof PAGES;

/** La variante du panier suit celle de la boutique si la configuration ne la précise pas. */
export function variantOf(config: ClientConfig, page: PageKey): Variant {
  const { variantes } = config.design;
  return page === "panier" ? (variantes.panier ?? variantes.boutique) : variantes[page];
}

/** Rend la variante configurée de la page. Changer de variante ne change pas le contenu, seulement sa mise en page. */
export function HomePage({ site }: { site: Site }) {
  const Page = PAGES.accueil[variantOf(site.config, "accueil")];
  return <Page site={site} />;
}

export function ShopPage({ site, category }: { site: Site; category?: string }) {
  const Page = PAGES.boutique[variantOf(site.config, "boutique")];
  return <Page site={site} category={category} />;
}

export function ProductPage({ site, product }: { site: Site; product: CatalogProduct }) {
  const Page = PAGES.fiche_produit[variantOf(site.config, "fiche_produit")];
  return <Page site={site} product={product} />;
}

export function StoryPage({ site }: { site: Site }) {
  const Page = PAGES.epicerie[variantOf(site.config, "epicerie")];
  return <Page site={site} />;
}

export function ContactPage({ site }: { site: Site }) {
  const Page = PAGES.contact[variantOf(site.config, "contact")];
  return <Page site={site} />;
}

export function CartPage({ site }: { site: Site }) {
  const Page = PAGES.panier[variantOf(site.config, "panier")];
  return <Page site={site} />;
}

/** Paiement et confirmation suivent la variante du panier. */
export function PaymentPage({ site }: { site: Site }) {
  return <PaymentStep site={site} variant={variantOf(site.config, "panier")} />;
}

export function ConfirmationPage({ site }: { site: Site }) {
  return <ConfirmationStep site={site} variant={variantOf(site.config, "panier")} />;
}
