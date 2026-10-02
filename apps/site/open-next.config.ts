import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Cache incrémental sur R2 : nécessaire à la revalidation à la demande (section 1.1).
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
