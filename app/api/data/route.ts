import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

const DATA_PATH = join(process.cwd(), "data", "fortier-data.json");

function readData() {
  const raw = readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeData(data: unknown) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    writeData(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Écriture impossible" }, { status: 500 });
  }
}
