import { z } from "zod";

import { findSupportPages, localSupportAnswer, SUPPORT_KNOWLEDGE } from "@/lib/support-knowledge";
import { ContractError, HttpError, readLimitedBody } from "@/lib/server/http";
import { withRateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ChatBody = z.strictObject({
  messages: z.array(z.strictObject({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4_000).trim().min(1),
  })).min(1).max(12).refine((messages) => messages.at(-1)?.role === "user", {
    message: "The last message must be a user question.",
  }),
  accessMode: z.enum(["admin", "employee"]).optional(),
});

const ProviderReply = z.object({
  output_text: z.string().max(32_000).optional(),
  output: z.array(z.object({
    content: z.array(z.object({ text: z.string().max(32_000).optional() }).passthrough()).max(32).optional(),
  }).passthrough()).max(32).optional(),
}).passthrough();

function readText(payload: unknown): string {
  const parsed = ProviderReply.safeParse(payload);
  if (!parsed.success) throw new ContractError("The assistant returned an invalid response.");
  const direct = parsed.data.output_text?.trim();
  if (direct) return direct;
  const parts = (parsed.data.output ?? []).flatMap((item) =>
    (item.content ?? []).map((block) => block.text?.trim() ?? "").filter(Boolean));
  const text = parts.join("\n");
  if (text.length > 32_000) throw new ContractError("The assistant response exceeds the supported length.");
  return text;
}

async function chat(request: Request): Promise<Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "Send a JSON question.");
  }
  const bytes = await readLimitedBody(request, 320_000);
  let body: unknown;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, "Send valid JSON containing a question."); }
  const parsed = ChatBody.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "Send 1–12 messages, each containing 1–4,000 characters, ending with a user question.");
  }
  const { messages: history, accessMode } = parsed.data;
  const userTurns = history.filter((entry) => entry.role === "user");
  const question = userTurns.at(-1)!.content;
  const previousQuestion = userTurns.at(-2)?.content ?? "";
  // accessMode only filters public guide links; it never grants authorization.
  const local = localSupportAnswer(question, previousQuestion, accessMode);
  const guide = () => Response.json({ ...local, source: "guide" }, {
    headers: { "Cache-Control": "no-store" },
  });
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return guide();
  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-4.5",
        store: false,
        max_output_tokens: 1_024,
        input: [
          { role: "system", content: SUPPORT_KNOWLEDGE },
          ...history,
        ],
      }),
      // A strict provider deadline also aborts response body consumption.
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return guide();
    }
    const replyBytes = await readLimitedBody(new Request("http://internal/assistant", {
      method: "POST", body: response.body, duplex: "half", signal: request.signal,
    } as RequestInit & { duplex: "half" }), 256_000);
    const payload: unknown = JSON.parse(new TextDecoder().decode(replyBytes));
    const reply = readText(payload).slice(0, 4_000);
    if (!reply) return guide();
    const links = findSupportPages(`${previousQuestion} ${question} ${reply}`, 4, accessMode)
      .map((page) => ({ title: page.title, url: page.url }));
    return Response.json({ reply, links, source: "assistant" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Quota was already consumed; provider errors are never retried automatically.
    return guide();
  }
}

export const POST = withRateLimit({
  name: "support-chat",
  perMinute: 6,
  perDay: 100,
  globalPerMinute: 30,
  globalPerDay: 1_000,
}, chat);
