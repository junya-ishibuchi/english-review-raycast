import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { LearningRecord, MonthlyData, CategoriesData, CategoryEntry } from "./types";

const ICLOUD_BASE = join(
  homedir(),
  "Library",
  "Mobile Documents",
  "com~apple~CloudDocs",
  "EnglishReview"
);

const DATA_DIR = join(ICLOUD_BASE, "data");
const DAILY_DIR = join(ICLOUD_BASE, "daily");
const WEEKLY_DIR = join(ICLOUD_BASE, "weekly");
const ASSETS_DIR = join(ICLOUD_BASE, "assets");

export async function ensureDirectories(): Promise<void> {
  for (const dir of [DATA_DIR, DAILY_DIR, WEEKLY_DIR, ASSETS_DIR]) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

function monthlyFilePath(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return join(DATA_DIR, `${year}-${month}.json`);
}

function categoriesFilePath(): string {
  return join(DATA_DIR, "categories.json");
}

export async function readMonthlyData(date: Date): Promise<MonthlyData> {
  const filePath = monthlyFilePath(date);
  if (!existsSync(filePath)) {
    return { records: [] };
  }
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as MonthlyData;
}

export async function appendRecord(record: LearningRecord): Promise<void> {
  await ensureDirectories();
  const date = new Date(record.created_at);
  const data = await readMonthlyData(date);
  data.records.push(record);
  await writeFile(monthlyFilePath(date), JSON.stringify(data, null, 2), "utf-8");
}

export async function readCategories(): Promise<CategoriesData> {
  const filePath = categoriesFilePath();
  if (!existsSync(filePath)) {
    return { categories: [], updated_at: new Date().toISOString() };
  }
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as CategoriesData;
}

export async function updateCategories(newCategories: string[]): Promise<void> {
  await ensureDirectories();
  const data = await readCategories();

  for (const catName of newCategories) {
    const existing = data.categories.find((c) => c.name === catName);
    if (existing) {
      existing.count += 1;
    } else {
      const group = inferCategoryGroup(catName);
      data.categories.push({ name: catName, group, count: 1 });
    }
  }

  data.updated_at = new Date().toISOString();
  await writeFile(categoriesFilePath(), JSON.stringify(data, null, 2), "utf-8");
}

function inferCategoryGroup(name: string): "grammar" | "expression" | "vocabulary" {
  const grammarKeywords = [
    "冠詞", "時制", "前置詞", "単数", "複数", "関係代名詞",
    "助動詞", "受動態", "能動態", "主語", "目的語", "接続詞",
    "article", "tense", "preposition", "plural", "singular",
  ];
  const expressionKeywords = [
    "直訳", "語順", "フォーマル", "カジュアル", "冗長",
    "不自然", "literal", "word order", "formal", "informal",
  ];

  const lower = name.toLowerCase();
  if (grammarKeywords.some((k) => lower.includes(k.toLowerCase()))) return "grammar";
  if (expressionKeywords.some((k) => lower.includes(k.toLowerCase()))) return "expression";
  return "vocabulary";
}

export async function getRecordsForDate(targetDate: Date): Promise<LearningRecord[]> {
  const data = await readMonthlyData(targetDate);
  const dateStr = targetDate.toISOString().slice(0, 10);
  return data.records.filter((r) => r.created_at.slice(0, 10) === dateStr);
}

export async function getRecordsForWeek(endDate: Date): Promise<LearningRecord[]> {
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

export { ICLOUD_BASE, DATA_DIR, DAILY_DIR, WEEKLY_DIR, ASSETS_DIR };
