import { NextResponse } from "next/server";
import { z } from "zod";
import { createHermesChatClient, readBoundedBody } from "@/lib/chat";
import { readDashboardConfig } from "@/lib/config";
import { createDefaultDashboardService } from "@/lib/dashboard";
import { resolveProjectPath } from "@/lib/workspace";

const chatMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) });
const requestSchema = z.object({
  projectId: z.string().min(1).max(300),
  message: z.string().trim().min(1).max(4000),
  history: z.array(chatMessageSchema).max(20).default([])
});

export async function POST(request: Request) {
  try {
    const rawRequest = await readBoundedBody(request, 100_000, "Chat request is too large");
    const input = requestSchema.parse(JSON.parse(rawRequest));
    const config = readDashboardConfig();
    const project = await createDefaultDashboardService().getProject(input.projectId);
    const projectPath = await resolveProjectPath(config.workspaceRoot, input.projectId);
    const reply = await createHermesChatClient({ apiUrl: config.hermesApiUrl, apiKey: config.hermesApiKey }).send(project.name, input.message, projectPath, input.history);
    return NextResponse.json({ reply }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Hermes chat is unavailable or the request is invalid." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
