import Anthropic from "@anthropic-ai/sdk";
import { getPreferenceValues } from "@raycast/api";
import { RecordType, Analysis } from "./types";
import { getSystemPrompt, getUserPrompt } from "./prompts";

interface Preferences {
  anthropicApiKey: string;
  claudeModel: string;
}

interface ClaudeResponse {
  result: string;
  analysis: Analysis;
}

export async function callClaude(type: RecordType, input: string): Promise<ClaudeResponse> {
  const { anthropicApiKey, claudeModel } = getPreferenceValues<Preferences>();

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const message = await client.messages.create({
    model: claudeModel,
    max_tokens: 1024,
    system: getSystemPrompt(type),
    messages: [
      {
        role: "user",
        content: getUserPrompt(type, input),
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsed = JSON.parse(text) as ClaudeResponse;
  return parsed;
}
