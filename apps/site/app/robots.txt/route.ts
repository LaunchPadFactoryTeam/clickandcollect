import { robotsTxt } from "@launchpadfactoryteam/seo";
import { config } from "../../lib/site";

export const dynamic = "force-static";

export function GET() {
  return new Response(robotsTxt(config), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
