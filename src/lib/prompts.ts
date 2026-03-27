import { RecordType } from "./types";

export function buildResultPrompt(type: RecordType, input: string): string {
  const typeSpecific: Record<RecordType, string> = {
    translation: `You are an English language tutor helping a Japanese speaker. Translate the following Japanese text to natural English. If there are multiple ways to say it, show the most natural one.`,

    correction: `You are an English language tutor helping a Japanese speaker. Correct the following English text. If the original is actually correct, say so.`,

    explanation: `You are an English language tutor helping a Japanese speaker. Explain what the following English expression means, when it's used, and give 2-3 example sentences. Explain the nuance and register (formal/casual/slang).`,

    confirmation: `You are an English language tutor helping a Japanese speaker. Confirm whether the following English expression is being understood correctly. Point out any nuances that might be missed. Be concise.`,
  };

  const prefixes: Record<RecordType, string> = {
    translation: "以下の日本語を自然な英語に翻訳してください:",
    correction: "以下の英文を訂正してください:",
    explanation: "以下の英語表現の意味を教えてください:",
    confirmation: "以下の英語表現の理解が合っているか確認してください:",
  };

  return `${typeSpecific[type]}

Respond with ONLY the result text, no JSON, no extra formatting.

${prefixes[type]}

${input}`;
}

export function buildAnalysisPrompt(type: RecordType, input: string, result: string): string {
  const typeLabels: Record<RecordType, string> = {
    translation: "translation (Japanese → English)",
    correction: "English correction",
    explanation: "English expression explanation",
    confirmation: "English comprehension confirmation",
  };

  return `You are an English language learning analyst. Analyze the following ${typeLabels[type]} interaction and provide a learning analysis.

User input: ${input}
AI result: ${result}

You MUST respond ONLY with valid JSON in the following format, with no other text before or after:

{
  "reason": "Why this correction/translation was needed - focus on the root cause of the learner's difficulty",
  "key_point": "The single most important learning takeaway",
  "categories": ["category1", "category2"],
  "difficulty": "basic|intermediate|advanced"
}

For categories, use specific labels like: 冠詞, 時制, 前置詞, 単数/複数, 関係代名詞, 助動詞, 受動態/能動態, 直訳的, フォーマル/カジュアル, 語順, 冗長な表現, 類義語, コロケーション, イディオム. If none fit, create a new descriptive category name in Japanese.`;
}
