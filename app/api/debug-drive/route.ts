import { NextResponse } from "next/server";
import { createSign } from "crypto";

export const maxDuration = 30;

async function getGoogleAccessToken(creds: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(creds.private_key, "base64url");
  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  const data = await res.json();
  return data.access_token || JSON.stringify(data);
}

export async function GET() {
  const steps: Record<string, string> = {};

  // Étape 1 : env var présente?
  const credsB64 = process.env.GOOGLE_DRIVE_CREDENTIALS;
  steps["1_env_var"] = credsB64 ? `OK (${credsB64.length} chars)` : "MANQUANT";

  if (!credsB64) return NextResponse.json({ steps });

  // Étape 2 : décodage base64
  let creds: Record<string, string>;
  try {
    creds = JSON.parse(Buffer.from(credsB64, "base64").toString());
    steps["2_decode"] = `OK — client_email: ${creds.client_email}`;
  } catch (e) {
    steps["2_decode"] = `ERREUR: ${e}`;
    return NextResponse.json({ steps });
  }

  // Étape 3 : token Google
  try {
    const token = await getGoogleAccessToken(creds);
    steps["3_token"] = token.startsWith("ya29") ? `OK (${token.slice(0, 20)}...)` : `ERREUR: ${token}`;

    // Étape 4 : liste fichiers Drive
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("trashed=false and mimeType!='application/vnd.google-apps.folder'")}&fields=files(id,name)&pageSize=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    steps["4_drive_files"] = data.files?.length > 0
      ? data.files.map((f: { name: string }) => f.name).join(", ")
      : `Vide ou erreur: ${JSON.stringify(data)}`;

  } catch (e) {
    steps["3_token"] = `ERREUR: ${e}`;
  }

  return NextResponse.json({ steps });
}
