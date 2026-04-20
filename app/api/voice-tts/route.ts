export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  if (!text) return new Response("Texte manquant", { status: 400 });

  const voiceId = process.env.ELEVENLABS_VOICE_ID!;
  const apiKey = process.env.ELEVENLABS_API_KEY!;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.80,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    console.error("ElevenLabs error:", await res.text());
    return new Response("Erreur TTS", { status: 500 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache",
    },
  });
}
