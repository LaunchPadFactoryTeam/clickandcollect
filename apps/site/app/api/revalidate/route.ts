import { revalidatePath, revalidateTag } from "next/cache";
import { isAuthorized } from "../../../lib/revalidate";

/**
 * Revalidation à la demande : appelée par le webhook Sanity (contenu modifié) et par le back-office
 * (disponibilité enregistrée). Les pages sont régénérées à la requête suivante.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("x-lp-revalidate-secret"), process.env.REVALIDATE_SECRET)) {
    return Response.json({ revalidated: false }, { status: 401 });
  }
  revalidateTag("catalogue", "max");
  revalidatePath("/", "layout");
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
