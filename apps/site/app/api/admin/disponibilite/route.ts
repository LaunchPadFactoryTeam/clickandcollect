import { handleAvailability } from "../../../../lib/admin/handlers";
import { actionSession, FORBIDDEN, sameOrigin, toResponse } from "../../../../lib/admin/session";
import { revalidateCatalogue } from "../../../../lib/revalidate";
import { defaultAvailability, getContent } from "../../../../lib/site";

export const dynamic = "force-dynamic";

/** Formulaire Disponibilité : écrit les produits coupés ou remis en vente, puis revalide le catalogue du site. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return FORBIDDEN();
  const form = await request.formData().catch(() => new FormData());
  const session = await actionSession();
  const { catalog } = await getContent();
  const result = await handleAvailability(Boolean(session), form, {
    productIds: new Set(catalog.map((p) => p.id)),
    saved: async () => ({ ...defaultAvailability(), ...(await session!.api.availability()) }),
    save: (changes) => session!.api.saveAvailability(changes),
    revalidate: revalidateCatalogue,
  });
  return toResponse(result, session?.cookies);
}
