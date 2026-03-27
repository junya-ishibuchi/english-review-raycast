#!/usr/bin/env npx tsx
/**
 * generate-daily.ts
 * Generates a daily HTML review page from iCloud JSON data.
 *
 * Usage:
 *   npx tsx scripts/generate-daily.ts [YYYY-MM-DD]
 *   (defaults to yesterday if no date given)
 */

import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ---------- Inline types (no Raycast imports) ----------

type RecordType = "translation" | "correction" | "toJapanese";
type Difficulty = "basic" | "intermediate" | "advanced";

interface SentenceAnalysis {
  original: string;
  corrected: string;
  reason: string;
  key_point: string;
}

interface Analysis {
  sentences: SentenceAnalysis[];
  categories: string[];
  difficulty: Difficulty;
}

interface LearningRecord {
  id: string;
  type: RecordType;
  input: string;
  output: string;
  analysis: Analysis;
  created_at: string;
  review_count: number;
}

interface MonthlyData {
  records: LearningRecord[];
}

// ---------- Path constants ----------

const ICLOUD_BASE = join(
  homedir(),
  "Library",
  "Mobile Documents",
  "com~apple~CloudDocs",
  "EnglishReview"
);

const DATA_DIR = join(ICLOUD_BASE, "data");
const DAILY_DIR = join(ICLOUD_BASE, "daily");
const ASSETS_DIR = join(ICLOUD_BASE, "assets");

const TEMPLATE_DIR = join(__dirname, "templates");

// ---------- Helpers ----------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GRAMMAR_KEYWORDS = [
  "冠詞", "時制", "前置詞", "単数", "複数", "関係代名詞",
  "助動詞", "受動態", "能動態", "主語", "目的語", "接続詞",
  "article", "tense", "preposition", "plural", "singular",
  "現在完了", "過去形", "進行形", "不定詞", "分詞",
];

const EXPRESSION_KEYWORDS = [
  "直訳", "語順", "フォーマル", "カジュアル", "冗長",
  "不自然", "literal", "word order", "formal", "informal",
  "イディオム", "idiom", "ビジネス", "表現", "ニュアンス",
];

function getTagClass(category: string): string {
  const lower = category.toLowerCase();
  if (GRAMMAR_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return "grammar";
  if (EXPRESSION_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return "expression";
  return "vocabulary";
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function highlightDiff(original: string, corrected: string): string {
  if (original === corrected) return escapeHtml(corrected);

  const origWords = original.split(/\s+/);
  const corrWords = corrected.split(/\s+/);
  const origSet = new Set(origWords.map((w) => w.toLowerCase()));

  return corrWords
    .map((word) => {
      if (!origSet.has(word.toLowerCase())) {
        return `<span class="diff-highlight">${escapeHtml(word)}</span>`;
      }
      return escapeHtml(word);
    })
    .join(" ");
}

function formatReason(reason: string): string {
  const lines = reason.split(/[。\n]/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return `<p>${escapeHtml(reason)}</p>`;
  return `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
}

function renderRecord(record: LearningRecord): string {
  const tags = record.analysis.categories
    .map((cat) => {
      const cls = getTagClass(cat);
      return `<span class="tag ${cls}">${escapeHtml(cat)}</span>`;
    })
    .join("");

  const difficulty = record.analysis.difficulty || "basic";
  const isCorrection = record.type === "correction";

  const sentences = record.analysis.sentences || [];
  const sentencesHtml = sentences.map((s) => {
    const correctedHtml = isCorrection ? highlightDiff(s.original, s.corrected) : escapeHtml(s.corrected);
    return `
    <div class="sentence-block">
      <div class="sentence-header">
        <span class="collapse-icon">▶</span>
        <div class="sentence-original">${escapeHtml(s.original)}</div>
      </div>
      <div class="sentence-body">
        <div class="sentence-corrected">${correctedHtml}</div>
        <div class="sentence-reason"><strong>Why:</strong> ${formatReason(s.reason)}</div>
        ${s.key_point ? `<div class="sentence-keypoint"><strong>Key Point:</strong> ${escapeHtml(s.key_point)}</div>` : ""}
      </div>
    </div>`;
  }).join("");

  return `
<div class="record-card ${escapeHtml(record.type)}">
  <span class="record-type">${escapeHtml(record.type)}</span>
  <span class="record-time">${formatTime(record.created_at)}</span>
  <div class="analysis">${sentencesHtml}</div>
  <div class="tags">${tags}</div>
  <span class="difficulty ${difficulty}">${difficulty}</span>
</div>`.trim();
}

// ---------- Data reading ----------

async function ensureDirs(): Promise<void> {
  for (const dir of [DATA_DIR, DAILY_DIR, ASSETS_DIR]) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

async function readMonthlyData(date: Date): Promise<MonthlyData> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const filePath = join(DATA_DIR, `${year}-${month}.json`);
  if (!existsSync(filePath)) {
    return { records: [] };
  }
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as MonthlyData;
}

async function getRecordsForDate(targetDate: Date): Promise<LearningRecord[]> {
  const data = await readMonthlyData(targetDate);
  const dateStr = targetDate.toISOString().slice(0, 10);
  return data.records.filter((r) => r.created_at.slice(0, 10) === dateStr);
}

// ---------- Main ----------

async function main(): Promise<void> {
  // Parse date argument or default to yesterday
  let targetDate: Date;
  const arg = process.argv[2];
  if (arg) {
    targetDate = new Date(arg + "T00:00:00Z");
    if (isNaN(targetDate.getTime())) {
      console.error(`Invalid date: ${arg}. Use YYYY-MM-DD format.`);
      process.exit(1);
    }
  } else {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1);
    // Normalize to midnight UTC
    targetDate = new Date(targetDate.toISOString().slice(0, 10) + "T00:00:00Z");
  }

  const dateStr = targetDate.toISOString().slice(0, 10);
  console.log(`Generating daily review for: ${dateStr}`);

  await ensureDirs();

  // Load records
  const records = await getRecordsForDate(targetDate);
  console.log(`Found ${records.length} records.`);

  // Count by type
  const count = records.length;
  const correctionCount = records.filter((r) => r.type === "correction").length;
  const translationCount = records.filter((r) => r.type === "translation").length;
  const toJapaneseCount = records.filter((r) => r.type === "toJapanese").length;

  // Render records HTML
  let recordsHtml: string;
  if (records.length === 0) {
    recordsHtml = `
<div class="empty-state">
  <div class="icon">📭</div>
  <p>No records found for this day.</p>
</div>`.trim();
  } else {
    recordsHtml = records.map(renderRecord).join("\n");
  }

  // Format display date
  const displayDate = targetDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "UTC",
  });

  // Load and fill template
  const templatePath = join(TEMPLATE_DIR, "daily.html");
  let html = await readFile(templatePath, "utf-8");
  html = html
    .replace(/\{\{date\}\}/g, escapeHtml(displayDate))
    .replace(/\{\{count\}\}/g, String(count))
    .replace(/\{\{correctionCount\}\}/g, String(correctionCount))
    .replace(/\{\{translationCount\}\}/g, String(translationCount))
    .replace(/\{\{toJapaneseCount\}\}/g, String(toJapaneseCount))
    .replace(/\{\{records\}\}/g, recordsHtml);

  // Write output HTML
  const outputPath = join(DAILY_DIR, `${dateStr}.html`);
  await writeFile(outputPath, html, "utf-8");
  console.log(`Daily HTML written to: ${outputPath}`);

  // Copy CSS to assets dir
  const cssSrc = join(TEMPLATE_DIR, "style.css");
  const cssDst = join(ASSETS_DIR, "style.css");
  await copyFile(cssSrc, cssDst);
  console.log(`CSS copied to: ${cssDst}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
