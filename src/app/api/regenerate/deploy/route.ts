import { NextRequest } from "next/server";
import { z } from "zod";
import { runVercelDeploy } from "@/lib/deploy/vercel";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const schema = z.object({
  zipBase64: z.string().min(20),
  projectNameSeed: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", code: "BAD_BODY" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message, code: "VALIDATION" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { type: string; payload?: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const ev of runVercelDeploy({
          zipBase64: parsed.data.zipBase64,
          projectNameSeed: parsed.data.projectNameSeed,
        })) {
          send(ev);
        }
        send({ type: "done" });
      } catch (e) {
        send({
          type: "error",
          payload: { message: e instanceof Error ? e.message : "Deploy failed" },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
