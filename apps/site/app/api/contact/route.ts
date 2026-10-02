import { config } from "../../../lib/site";

/** L'envoi des messages de contact est branché avec les emails transactionnels (lot 6). */
export function POST() {
  return new Response(
    `L'envoi de messages depuis le site arrive prochainement. En attendant, appelez ${config.boutique.nom} au ${config.boutique.telephone}.`,
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "86400" } },
  );
}
