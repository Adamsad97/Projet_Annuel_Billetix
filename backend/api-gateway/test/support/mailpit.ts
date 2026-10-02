/** Lecture des emails capturés par Mailpit : les tests suivent les vrais liens envoyés aux utilisateurs. */
const MAILPIT_URL = (process.env.E2E_MAILPIT_URL ?? "http://localhost:8025").replace(/\/$/, "");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface MailSummary {
  ID: string;
  Subject: string;
  Created: string;
}

async function searchMessages(to: string): Promise<MailSummary[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  if (!response.ok) throw new Error(`Mailpit injoignable (${response.status}) sur ${MAILPIT_URL}`);
  return ((await response.json()) as { messages: MailSummary[] }).messages ?? [];
}

/** Attend le prochain email reçu par `to` dont le corps contient `marker`, et renvoie le jeton du lien. */
export async function waitForLinkToken(
  to: string,
  marker: string,
  excludeIds: string[] = [],
  timeoutMs = 30_000,
): Promise<{ token: string; id: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const message of await searchMessages(to)) {
      if (excludeIds.includes(message.ID)) continue;
      const detail = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json()) as {
        HTML: string;
        Text: string;
      };
      const content = `${detail.Text}\n${detail.HTML}`;
      const match = content.match(new RegExp(`${marker.replace(/[/?]/g, "\\$&")}\\?token=([A-Za-z0-9._-]+)`));
      if (match) return { token: match[1], id: message.ID };
    }
    await sleep(500);
  }
  throw new Error(`Aucun email « ${marker} » reçu par ${to} en ${timeoutMs / 1000} s`);
}
