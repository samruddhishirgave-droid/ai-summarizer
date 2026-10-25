
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

const MIN_CHARS = 50;
const MAX_CHARS = 8000;

const STYLES = {
  bullets: "Summarise as 4-6 concise bullet points.",
  short: "Summarise in 2-3 sentences.",
  detailed: "Write a clear summary of about 150 words with a short title.",
};

export async function POST(req) {
  let body;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (body.text || "").trim();
  const style =
    body.style && STYLES[body.style] ? body.style : "bullets";

  if (!text) {
    return Response.json(
      { error: "Please paste some text to summarise." },
      { status: 400 }
    );
  }

  if (text.length < MIN_CHARS) {
    return Response.json(
      {
        error: `Text is too short. Enter at least ${MIN_CHARS} characters.`,
      },
      { status: 400 }
    );
  }

  if (text.length > MAX_CHARS) {
    return Response.json(
      { error: `Text is too long. The limit is ${MAX_CHARS} characters.` },
      { status: 413 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "Server is not configured." },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  let result;

  try {
    result = await ai.models.generateContentStream({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      contents: `Text to summarise:\n\n${text}`,
      config: {
        systemInstruction:
          "You are a precise summariser. Use only the information in the text. " +
          "Do not add facts. Reply in the same language as the text. " +
          STYLES[style],
      },
    });
  } catch (e) {
    console.error("Gemini error:", e);

    const status = e?.status === 429 ? 429 : 502;

    const msg =
      status === 429
        ? "Too many requests right now. Please wait a moment and try again."
        : "The AI service had a problem. Please try again.";

    return Response.json({ error: msg }, { status });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result) {
          if (chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          }
        }
      } catch (e) {
        console.error("Stream error:", e);

        controller.enqueue(
          encoder.encode(
            "\n\n[The response was interrupted. Please try again.]"
          )
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
