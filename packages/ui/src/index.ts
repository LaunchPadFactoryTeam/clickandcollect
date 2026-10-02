/** @launchpadfactoryteam/ui — composants partagés et variantes A, B, C des pages (lot 3). Styles : styles/*.css. */
export {
  AddButton,
  CategoryFilter,
  DLC_TEXT,
  EVIN_TEXT,
  EvinNotice,
  formatPrice,
  formatVat,
  IncoBlock,
  Ingredients,
  JsonLd,
  Placeholder,
  ProductMedia,
  productBadge,
  productHref,
  categoryHref,
  showsAlcohol,
  SkipLink,
  type Site,
  type Variant,
} from "./shared.tsx";
export { Footer, Header, LEGAL_LINKS, navLabel, PageShell, type Section } from "./chrome.tsx";
export { ProductCard, ProductList } from "./pages/cards.tsx";
export { ContactFacts, PickupFacts } from "./pages/facts.tsx";
export {
  ContactPage,
  HomePage,
  PAGES,
  ProductPage,
  ShopPage,
  StoryPage,
  variantOf,
  type PageKey,
} from "./variants.tsx";
