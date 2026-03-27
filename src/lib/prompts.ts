import { RecordType } from "./types";

export function buildResultPrompt(type: RecordType, input: string): string {
  const typeSpecific: Record<RecordType, string> = {
    translation: `You are an English language tutor helping a Japanese speaker. Translate the following Japanese text to natural English. If there are multiple ways to say it, show the most natural one.`,

    correction: `You are an English language tutor helping a Japanese speaker. Correct the following English text. Preserve the original sentence structure and style as much as possible — only change what is grammatically wrong or clearly unnatural. However, if the overall phrasing or structure itself is unnatural, feel free to restructure it. Do not force corrections on casual or informal tone — if the user writes casually, that's intentional. If the original is actually correct, say so.`,

    toJapanese: `You are a translator. Translate the following English text to natural Japanese.`,
  };

  const prefixes: Record<RecordType, string> = {
    translation: "以下の日本語を自然な英語に翻訳してください:",
    correction: "以下の英文を訂正してください:",
    toJapanese: "以下の英語を自然な日本語に翻訳してください:",
  };

  return `${typeSpecific[type]}

Respond with ONLY the result text, no JSON, no extra formatting. Do not include any explanation.

${prefixes[type]}

${input}`;
}

export function buildAnalysisPrompt(type: RecordType, input: string, result: string): string {
  const typeLabels: Record<RecordType, string> = {
    translation: "translation (Japanese → English)",
    correction: "English correction",
    toJapanese: "translation (English → Japanese)",
  };

  return `You are an English language learning analyst helping a Japanese speaker. Analyze the following ${typeLabels[type]} interaction and provide a learning analysis.

User input: ${input}
AI result: ${result}

IMPORTANT RULES:
- "reason" and "key_point" MUST be written in Japanese (日本語で書いてください)
- For long texts with multiple sentences, analyze EACH sentence individually. Point out specific errors per sentence, e.g. "1文目: 「a actual」→「an actual」母音の前ではanを使う。2文目: ..."
- Be specific — quote the exact problematic phrase and its correction

You MUST respond ONLY with valid JSON in the following format, with no other text before or after:

{
  "reason": "なぜこの訂正/翻訳が必要だったか — 一文ごとに具体的に解説（日本語で）",
  "key_point": "最も重要な学習ポイント（日本語で）",
  "categories": ["category1", "category2"],
  "difficulty": "basic|intermediate|advanced"
}

For categories, use specific labels like: 冠詞, 時制, 前置詞, 単数/複数, 関係代名詞, 助動詞, 受動態/能動態, 直訳的, フォーマル/カジュアル, 語順, 冗長な表現, 類義語, コロケーション, イディオム. If none fit, create a new descriptive category name in Japanese.`;
}
