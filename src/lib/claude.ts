import { AI } from "@raycast/api";
import { RecordType, Analysis } from "./types";
import { buildPrompt } from "./prompts";

interface ClaudeResponse {
  result: string;
  analysis: Analysis;
}

export async function callClaude(type: RecordType, input: string): Promise<ClaudeResponse> {
  const prompt = buildPrompt(type, input);

  const text = await AI.ask(prompt, {
    model: AI.Model["Anthropic_Claude_Haiku"],
    creativity: "low",
  });

  const parsed = JSON.parse(text) as ClaudeResponse;
  return parsed;
}
