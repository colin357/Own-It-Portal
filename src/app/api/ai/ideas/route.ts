import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface GeneratedIdea {
  title: string;
  body: string;
}

/**
 * Generates content ideas for a client using OpenAI, seeded with the client's
 * name, tags, and recent content so suggestions don't repeat what exists.
 */
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI is not configured (missing OPENAI_API_KEY)." },
      { status: 503 }
    );
  }

  const decoded = await verifyRequest(req);
  if (!decoded) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { clientId?: string; topic?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const clientId = decoded.role === "admin" ? body.clientId : decoded.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "Client is required." }, { status: 400 });
  }
  if (decoded.role !== "admin" && decoded.clientId !== clientId) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const db = adminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }
  const client = clientSnap.data()!;

  const tagIds: string[] = client.tagIds ?? [];
  const tagNames: string[] = [];
  for (const id of tagIds.slice(0, 10)) {
    const tag = await db.collection("tags").doc(id).get();
    if (tag.exists) tagNames.push(tag.data()!.name);
  }

  const recentSnap = await db
    .collection("contentItems")
    .where("clientId", "==", clientId)
    .orderBy("createdAt", "desc")
    .limit(15)
    .get();
  const recentTitles = recentSnap.docs.map((d) => d.data().title).filter(Boolean);

  const prompt = [
    `You are a social media strategist at a marketing agency generating content ideas for a client.`,
    `Client business: ${client.name}`,
    tagNames.length ? `Client tags/categories: ${tagNames.join(", ")}` : null,
    recentTitles.length
      ? `Recent content (do NOT repeat these): ${recentTitles.join("; ")}`
      : null,
    body.topic?.trim() ? `Focus area requested: ${body.topic.trim()}` : null,
    ``,
    `Generate 5 fresh, specific content ideas (social posts, email blasts, or blog posts).`,
    `Respond with JSON only: {"ideas":[{"title":"...","body":"1-3 sentence description of the angle and hook"}]}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.9,
    }),
  });

  if (!aiRes.ok) {
    console.error("OpenAI error:", aiRes.status, await aiRes.text());
    return NextResponse.json(
      { error: "The AI service returned an error. Try again in a moment." },
      { status: 502 }
    );
  }

  const completion = await aiRes.json();
  let ideas: GeneratedIdea[] = [];
  try {
    const parsed = JSON.parse(completion.choices?.[0]?.message?.content ?? "{}");
    ideas = (parsed.ideas ?? [])
      .filter((i: GeneratedIdea) => i?.title)
      .slice(0, 8)
      .map((i: GeneratedIdea) => ({
        title: String(i.title).slice(0, 200),
        body: String(i.body ?? "").slice(0, 1000),
      }));
  } catch {
    return NextResponse.json(
      { error: "Could not parse AI response. Try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ideas });
}
