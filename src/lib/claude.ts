import { AI } from "@raycast/api";
import { RecordType, Analysis } from "./types";
import { buildResultPrompt, buildFollowUpPrompt, buildAnalysisPrompt } from "./prompts";

const FAST_MODEL = AI.Model["Google_Gemini_3.1_Flash_Lite"];
const SMART_MODEL = AI.Model["Anthropic_Claude_4.6_Sonnet"];

export interface AiResult {
  result: string;
}

export async function callFast(type: RecordType, input: string): Promise<AiResult> {
  const prompt = buildResultPrompt(type, input);

  const result = await AI.ask(prompt, {
    model: FAST_MODEL,
    creativity: "low",
  });

  return { result };
}

export async function callFollowUp(type: RecordType, originalInput: string, previousResult: string, followUp: string): Promise<AiResult> {
  const prompt = buildFollowUpPrompt(type, originalInput, previousResult, followUp);

  const result = await AI.ask(prompt, {
    model: FAST_MODEL,
    creativity: "low",
  });

  return { result };
}

export async function analyzeInBackground(type: RecordType, input: string, result: string): Promise<Analysis> {
  const prompt = buildAnalysisPrompt(type, input, result);

  const text = await AI.ask(prompt, {
    model: SMART_MODEL,
    creativity: "low",
  });

  return parseJson<Analysis>(text);
}

function parseJson<T>(text: string): T {
  // Strip markdown code fences if present (e.g. ```json ... ```)
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}
