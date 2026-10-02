/** @launchpadfactoryteam/ui — composants partagés, variantes A, B, C des pages et îlots panier (lots 3 et 4). Styles : styles/*.css. */
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
export { cartProducts, Steps } from "./pages/cart.tsx";
export { CartView, type CartProduct, type CartTexts } from "./client/CartView.tsx";
export { CheckoutView } from "./client/CheckoutView.tsx";
export { ConfirmationView, slotText } from "./client/ConfirmationView.tsx";
export {
  CartPage,
  ConfirmationPage,
  ContactPage,
  HomePage,
  PAGES,
  PaymentPage,
  ProductPage,
  ShopPage,
  StoryPage,
  variantOf,
  type PageKey,
} from "./variants.tsx";
