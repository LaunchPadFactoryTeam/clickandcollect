/** @launchpadfactoryteam/db — migrations SQL, politiques RLS, types et clients Supabase (lot 2). */
export type { Database, Json } from "./database.types.ts";
export type { Db } from "./clients.ts";
export { createSiteClient } from "./clients.ts";
export {
  SITE_ROLE,
  signSiteToken,
  verifySiteToken,
  type SignSiteTokenInput,
  type SiteTokenClaims,
} from "./site-token.ts";

import type { Database } from "./database.types.ts";
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export const ORDER_STATUSES: readonly OrderStatus[] = ["new", "preparing", "ready", "collected"];
