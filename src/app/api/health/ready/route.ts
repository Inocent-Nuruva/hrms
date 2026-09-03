import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ready",
      service: "hrms-frontend",
      revision: process.env.APP_REVISION ?? "unknown",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
