import { NextResponse } from "next/server";

export async function GET() {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_PHONE_NUMBER || "";
  const to = process.env.TWILIO_TO_NUMBER || "";

  return NextResponse.json({
    sid_prefix: sid.substring(0, 4),
    sid_length: sid.length,
    token_length: token.length,
    from_prefix: from.substring(0, 4),
    to_prefix: to.substring(0, 4),
  });
}
