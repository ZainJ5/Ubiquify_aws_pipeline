import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    status: job.status,
    phase: job.phase,
    log: job.log,
    result: job.result,
    error: job.error,
  });
}
