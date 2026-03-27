#!/usr/bin/env npx tsx
/**
 * generate-weekly.ts
 * Generates a weekly HTML review page from iCloud JSON data.
 *
 * Usage:
 *   npx tsx scripts/generate-weekly.ts [YYYY-MM-DD]
 *   (end date, defaults to yesterday if not given; covers 7 days ending on that date)
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
  idioms?: { phrase: string; meaning: string; example: string }[];
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
const WEEKLY_DIR = join(ICLOUD_BASE, "weekly");
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

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function renderRecord(record: LearningRecord): string {
  const tags = record.analysis.categories
    .map((cat) => {
      const cls = getTagClass(cat);
      return `<span class="tag ${cls}">${escapeHtml(cat)}</span>`;
    })
    .join("");

  const difficulty = record.analysis.difficulty || "basic";

  const sentences = record.analysis.sentences || [];
  const sentencesHtml = sentences.map((s) => `
    <div class="sentence-summary">
      <div class="sentence-original">${escapeHtml(s.original)}</div>
      <div class="sentence-corrected">${escapeHtml(s.corrected)}</div>
    </div>`).join("");

  return `
<div class="record-card ${escapeHtml(record.type)}">
  <span class="record-type">${escapeHtml(record.type)}</span>
  <span class="record-time">${formatDate(record.created_at)} ${formatTime(record.created_at)}</span>
  <div class="analysis">${sentencesHtml}</div>
  <div class="tags">${tags}</div>
  <span class="difficulty ${difficulty}">${difficulty}</span>
</div>`.trim();
}

// ---------- Data reading ----------

async function ensureDirs(): Promise<void> {
  for (const dir of [DATA_DIR, WEEKLY_DIR, ASSETS_DIR]) {
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

async function getRecordsForWeek(endDate: Date): Promise<LearningRecord[]> {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const records: LearningRecord[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayRecords = await getRecordsForDate(current);
    records.push(...dayRecords);
    current.setDate(current.getDate() + 1);
  }

  return records;
}

// ---------- Category analysis ----------

interface CategoryCount {
  name: string;
  group: string;
  count: number;
}

function countCategories(records: LearningRecord[]): CategoryCount[] {
  const map = new Map<string, CategoryCount>();

  for (const record of records) {
    for (const cat of record.analysis.categories) {
      const existing = map.get(cat);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(cat, { name: cat, group: getTagClass(cat), count: 1 });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function renderCategoryBars(categories: CategoryCount[]): string {
  if (categories.length === 0) {
    return '<p style="color: var(--text-muted); font-size: 0.9rem;">No categories recorded.</p>';
  }

  const maxCount = categories[0].count;

  return categories
    .map((cat) => {
      const pct = maxCount > 0 ? Math.round((cat.count / maxCount) * 100) : 0;
      return `
<div class="bar-row">
  <div class="bar-label">${escapeHtml(cat.name)}</div>
  <div class="bar-track">
    <div class="bar-fill ${cat.group}" style="width: ${pct}%">${cat.count}</div>
  </div>
  <div class="bar-count">${cat.count}</div>
</div>`.trim();
    })
    .join("\n");
}

function renderTopMistakes(records: LearningRecord[]): string {
  // "Mistake" = correction records where the same input pattern recurs
  // Here we look at categories with 2+ occurrences across correction records
  const correctionCategories = new Map<string, number>();

  for (const record of records) {
    if (record.type === "correction") {
      for (const cat of record.analysis.categories) {
        correctionCategories.set(cat, (correctionCategories.get(cat) ?? 0) + 1);
      }
    }
  }

  const repeated = Array.from(correctionCategories.entries())
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a);

  if (repeated.length === 0) {
    return '<p style="color: var(--text-muted); font-size: 0.9rem;">No repeated mistakes this week. Great job!</p>';
  }

  return repeated
    .map(([name, count]) => {
      return `
<div class="mistake-item">
  <span class="mistake-count">${count}x</span>
  <span class="mistake-text">${escapeHtml(name)}</span>
</div>`.trim();
    })
    .join("\n");
}

// ---------- Main ----------

async function main(): Promise<void> {
  // Parse date argument or default to yesterday
  let endDate: Date;
  const arg = process.argv[2];
  if (arg) {
    endDate = new Date(arg + "T00:00:00Z");
    if (isNaN(endDate.getTime())) {
      console.error(`Invalid date: ${arg}. Use YYYY-MM-DD format.`);
      process.exit(1);
    }
  } else {
    endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    endDate = new Date(endDate.toISOString().slice(0, 10) + "T00:00:00Z");
  }

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);
  const weekLabel = `${startStr} – ${endStr}`;

  console.log(`Generating weekly review for: ${weekLabel}`);

  await ensureDirs();

  // Load records for the 7-day window
  const records = await getRecordsForWeek(endDate);
  console.log(`Found ${records.length} records.`);

  const totalCount = records.length;

  // Analyze categories
  const categories = countCategories(records);
  const uniqueCategories = categories.length;

  const categoryBarsHtml = renderCategoryBars(categories);
  const topMistakesHtml = renderTopMistakes(records);

  // Render all records HTML
  let recordsHtml: string;
  if (records.length === 0) {
    recordsHtml = `
<div class="empty-state">
  <div class="icon">📭</div>
  <p>No records found for this week.</p>
</div>`.trim();
  } else {
    recordsHtml = records.map(renderRecord).join("\n");
  }

  // Display dates
  const displayStart = startDate.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
  const displayEnd = endDate.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
  const displayWeekLabel = `${displayStart} – ${displayEnd}`;

  // Load and fill template
  const templatePath = join(TEMPLATE_DIR, "weekly.html");
  let html = await readFile(templatePath, "utf-8");
  html = html
    .replace(/\{\{weekLabel\}\}/g, escapeHtml(displayWeekLabel))
    .replace(/\{\{totalCount\}\}/g, String(totalCount))
    .replace(/\{\{uniqueCategories\}\}/g, String(uniqueCategories))
    .replace(/\{\{categoryBars\}\}/g, categoryBarsHtml)
    .replace(/\{\{topMistakes\}\}/g, topMistakesHtml)
    .replace(/\{\{records\}\}/g, recordsHtml);

  // Write output HTML
  const outputPath = join(WEEKLY_DIR, `${endStr}.html`);
  await writeFile(outputPath, html, "utf-8");
  console.log(`Weekly HTML written to: ${outputPath}`);

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
