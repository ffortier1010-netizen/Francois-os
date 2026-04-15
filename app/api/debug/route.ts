import { NextResponse } from "next/server";

export async function GET() {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_PHONE_NUMBER || "";
  const to = process.env.TWILIO_TO_NUMBER || "";
  const anthropic = process.env.ANTHROPIC_API_KEY || "";

  const test = process.env.TEST_VAR || "";

  return NextResponse.json({
    anthropic_ok: anthropic.length > 0,
    test_var: test,
    sid_length: sid.length,
    token_length: token.length,
    from_length: from.length,
    to_length: to.length,
  });
}
