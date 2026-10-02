/** Alerte d'exploitation : journal structuré du Worker et, si configurée, notification à l'équipe. */
export async function alert(url: string | undefined, message: string, details: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ level: "error", message, ...details }));
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${message}\n${JSON.stringify(details)}` }),
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "Alerte non transmise", error: String(error) }));
  }
}
