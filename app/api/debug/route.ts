import { NextResponse } from "next/server";

export async function GET() {
  const allKeys = Object.keys(process.env).filter(k =>
    k.includes("TWILIO") || k.includes("SMS") || k.includes("TEST") || k.includes("ANTHROPIC") || k.includes("HELLO")
  );

  return NextResponse.json({ found_keys: allKeys });
}
