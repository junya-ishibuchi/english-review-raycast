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

export function buildFollowUpPrompt(type: RecordType, originalInput: string, previousResult: string, followUp: string): string {
  const typeContext: Record<RecordType, string> = {
    translation: "You translated the user's Japanese text to English.",
    correction: "You corrected the user's English text.",
    toJapanese: "You translated the user's English text to Japanese.",
  };

  return `${typeContext[type]}

Original input: ${originalInput}
Your previous result: ${previousResult}

The user has a follow-up request. Revise your result based on their feedback.
Respond with ONLY the revised result text, no JSON, no extra formatting. Do not include any explanation.

User's follow-up: ${followUp}`;
}

export function buildAnalysisPrompt(type: RecordType, input: string, result: string): string {
  const typeLabels: Record<RecordType, string> = {
    translation: "translation (Japanese → English)",
    correction: "English correction",
    toJapanese: "translation (English → Japanese)",
  };

  const typeInstructions: Record<RecordType, string> = {
    correction: `The user (a Japanese speaker) wrote English and had it corrected. Analyze what was wrong.
- "original" = the user's original sentence
- "corrected" = the corrected version
- "reason" = 2つの観点で書くこと（日本語で）:
  (1) 日本語話者がなぜこう書いてしまうのか（母語の干渉、日本語の発想からの直訳、日本語にはない概念など根本原因を分析）
  (2) この文が使われている文脈（ビジネス、カジュアル、技術的など）を踏まえて、なぜ訂正後の表現がより適切かを説明
- "key_point" = この文法・表現のルールや覚えるべきポイント（日本語で）
- If a sentence has no issues, set reason to "問題なし" and key_point to ""`,

    translation: `The user (a Japanese speaker) couldn't express something in English and needed a translation from Japanese. Analyze the English result to help them learn.
- "original" = the user's Japanese input
- "corrected" = the English translation
- "reason" = 2つの観点で書くこと（日本語で）:
  (1) なぜ日本語話者がこの英語表現を思いつきにくいのか（日本語と英語の発想・構造の違い、直訳ではダメな理由）
  (2) この文が使われている文脈を踏まえて、なぜこの英語表現が自然なのか
- "key_point" = この英語表現を覚えるためのポイント、使えるシチュエーション（日本語で）`,

    toJapanese: `The user (a Japanese speaker) couldn't understand the English text and needed a Japanese translation. This means the user had difficulty reading this English. Analyze WHY this English was hard to read.
- "original" = the English sentence the user couldn't read
- "corrected" = the Japanese translation
- "reason" = 2つの観点で書くこと（日本語で）:
  (1) なぜ日本語話者にとってこの英語が読みにくいのか（日本語にない構文パターン、多義語、省略、文化的背景など根本原因）
  (2) この文が使われている文脈（ビジネスメール、技術文書、カジュアルなチャットなど）を踏まえた読解のコツ
- "key_point" = この英文を読めるようになるために覚えるべきこと（単語、文法パターン、構文など）（日本語で）
- "idioms" = この文に含まれるイディオム、句動詞、慣用表現。各イディオムは {"phrase": "英語表現", "meaning": "日本語での意味の説明", "example": "例文（英語）"} の形式。なければ空配列[]`,
  };

  return `You are an English language learning analyst helping a Japanese speaker. Analyze the following ${typeLabels[type]} interaction and provide a learning analysis.

User input: ${input}
AI result: ${result}

IMPORTANT RULES:
- Split the input into individual sentences and analyze EACH sentence separately
${typeInstructions[type]}
- Be specific — quote the exact phrase that caused difficulty

You MUST respond ONLY with valid JSON in the following format, with no other text before or after:

{
  "sentences": [
    {
      "original": "the user's original sentence",
      "corrected": "the corrected/translated sentence",
      "reason": "なぜこの訂正が必要だったか（日本語で）",
      "key_point": "この文の学習ポイント（日本語で）",
      "idioms": [{"phrase": "break the ice", "meaning": "緊張をほぐす", "example": "He told a joke to break the ice."}]
    }
  ],
  "categories": ["category1", "category2"],
  "difficulty": "basic|intermediate|advanced"
}

For categories, use specific labels like: 冠詞, 時制, 前置詞, 単数/複数, 関係代名詞, 助動詞, 受動態/能動態, 直訳的, フォーマル/カジュアル, 語順, 冗長な表現, 類義語, コロケーション, イディオム. If none fit, create a new descriptive category name in Japanese.`;
}
