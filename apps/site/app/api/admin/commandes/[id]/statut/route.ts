import { handleStatus } from "../../../../../../lib/admin/handlers";
import { actionSession, FORBIDDEN, sameOrigin, toResponse } from "../../../../../../lib/admin/session";
import { inBackground } from "../../../../../../lib/background";
import { processPendingEmails } from "../../../../../../lib/emails";
import { env } from "../../../../../../lib/env";
import { config, getContent, themeTokens } from "../../../../../../lib/site";

export const dynamic = "force-dynamic";

/** Avancement d'une commande (bouton de la liste ou étape du détail). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return FORBIDDEN();
  const { id } = await params;
  const form = await request.formData().catch(() => new FormData());
  const session = await actionSession();
  const result = await handleStatus(Boolean(session), id, form, {
    currentStatus: async (orderId) => (await session!.api.getOrder(orderId))?.status ?? null,
    updateStatus: (orderId, from, to) => session!.api.updateStatus(orderId, from, to),
    afterReady: () =>
      inBackground(async () => {
        const content = await getContent();
        return processPendingEmails(env(), { config, settings: content.pages.settings, tokens: themeTokens });
      }),
  });
  return toResponse(result, session?.cookies);
}
