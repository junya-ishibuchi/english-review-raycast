import { RecordType } from "./types";

export function buildPrompt(type: RecordType, input: string): string {
  const instructions = `You are an English language tutor helping a Japanese speaker improve their English. You MUST respond ONLY with valid JSON in the following format, with no other text before or after:

{
  "result": "Your main response text here",
  "analysis": {
    "reason": "Why this correction/translation was needed - focus on the root cause",
    "key_point": "The single most important learning takeaway",
    "categories": ["category1", "category2"],
    "difficulty": "basic|intermediate|advanced"
  }
}

For categories, use specific labels like: 冠詞, 時制, 前置詞, 単数/複数, 関係代名詞, 助動詞, 受動態/能動態, 直訳的, フォーマル/カジュアル, 語順, 冗長な表現, 類義語, コロケーション, イディオム. If none fit, create a new descriptive category name in Japanese.`;

  const typeSpecific: Record<RecordType, string> = {
    translation: `The user will provide Japanese text they couldn't express in English.
Translate it to natural English. Explain WHY this English expression works and what nuances it carries. If there are multiple ways to say it, show the most natural one as the main result and briefly mention alternatives.`,

    correction: `The user will provide English text they wrote but aren't sure is correct.
Correct the English. Show clearly what changed and WHY each change was needed. If the original is actually correct, say so and explain why it works. Focus on making the correction educational - don't just fix it, explain the underlying rule.`,

    explanation: `The user will provide an English expression they don't understand.
Explain what it means, when it's used, and give 2-3 example sentences. Explain the nuance and register (formal/casual/slang). If it's an idiom, explain the origin if helpful.`,

    confirmation: `The user will provide English text they think they understand and want to verify.
Confirm whether their understanding seems correct based on context. If the text has nuances they might be missing, point those out. Be concise - they probably have a rough understanding already, so focus on what they might be missing.`,
  };

  const prefixes: Record<RecordType, string> = {
    translation: "以下の日本語を自然な英語に翻訳してください:",
    correction: "以下の英文を訂正してください:",
    explanation: "以下の英語表現の意味を教えてください:",
    confirmation: "以下の英語表現の理解が合っているか確認してください:",
  };

  return `${instructions}

${typeSpecific[type]}

${prefixes[type]}

${input}`;
}
