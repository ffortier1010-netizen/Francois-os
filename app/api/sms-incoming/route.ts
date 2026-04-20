import { google } from "googleapis";

export const maxDuration = 30;

const SYSTEM_PROMPT = `Tu es Léo Atlas, le copilote IA de François Fortier — courtier immobilier commercial et directeur de construction au Québec.

Top 3 objectifs 90 jours :
1. Pipeline courtage commercial → mandats idéaux 10M$+
2. Systématiser la direction de projets → économiser 15-20h/semaine
3. Stratégie investisseurs → plan finalisé + 1ère opportunité plexes 6+

Agents disponibles : [BROKER PRO], [CONSTRUCTION OPS], [INVEST ANALYZER], [STRATÈGE 90J], [FAMILY HQ], [BODY & PERFORMANCE], [DOCUMENT MASTER].

Tu réponds par SMS — sois ultra court (max 160 caractères si possible), direct, en français. Pas de validation inutile. Challenge François quand c'est pertinent.`;

const DOC_KEYWORDS = ["envoie", "document", "fichier", "budget", "contrat", "rapport", "analyse", "find", "cherche", "trouve", "envoyer", "envoi"];

function isDocumentRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return DOC_KEYWORDS.some(k => lower.includes(k));
}

async function searchGoogleDrive(query: string): Promise<{ name: string; link: string }[]> {
  const credsB64 = process.env.GOOGLE_DRIVE_CREDENTIALS!;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const creds = JSON.parse(Buffer.from(credsB64, "base64").toString());

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });

  // Extraire les mots-clés du message
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !DOC_KEYWORDS.includes(w));
  const searchTerms = words.slice(0, 3).join(" ");

  const nameQuery = searchTerms
    ? `'${folderId}' in parents and name contains '${searchTerms}' and trashed=false`
    : `'${folderId}' in parents and trashed=false`;

  const res = await drive.files.list({
    q: nameQuery,
    fields: "files(id, name, webViewLink, modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = res.data.files || [];

  // Rendre chaque fichier accessible via lien
  for (const file of files) {
    try {
      await drive.permissions.create({
        fileId: file.id!,
        requestBody: { role: "reader", type: "anyone" },
        supportsAllDrives: true,
      });
    } catch { /* déjà partagé */ }
  }

  return files.map(f => ({ name: f.name!, link: f.webViewLink! }));
}

async function sendSMS(to: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: message }).toString(),
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const from = params.get("From") || "";
    const message = params.get("Body") || "";

    if (!message || !from) {
      return new Response("OK", { status: 200 });
    }

    // Demande de document ?
    if (isDocumentRequest(message)) {
      try {
        const files = await searchGoogleDrive(message);

        if (files.length === 0) {
          await sendSMS(from, "Aucun document trouvé. Précise le nom du fichier.");
        } else if (files.length === 1) {
          await sendSMS(from, `📄 ${files[0].name}\n${files[0].link}`);
        } else {
          const list = files.slice(0, 3).map((f, i) => `${i + 1}. ${f.name}\n${f.link}`).join("\n\n");
          await sendSMS(from, `📁 ${files.length} docs trouvés:\n\n${list}`);
        }
      } catch (err) {
        console.error("Drive error:", err);
        await sendSMS(from, "Erreur accès Drive. Réessaie.");
      }

      return new Response("OK", { status: 200 });
    }

    // Réponse Léo Atlas standard
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await res.json();
    const reply = data.content?.[0]?.text ?? "Erreur — réessaie.";

    await sendSMS(from, reply);

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("SMS incoming error:", err);
    return new Response("OK", { status: 200 });
  }
}
