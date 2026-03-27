# English Review Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Raycast extension that records English learning interactions (translation, correction, explanation, confirmation) via 4 commands, stores them in JSON on iCloud Drive, and generates rich HTML review pages daily/weekly via launchd.

**Architecture:** Raycast Extension (TypeScript) calls Claude API directly for translation/correction/explanation/confirmation + background weakness analysis. Data is stored as monthly JSON files in iCloud Drive. A Node.js script run by launchd generates static HTML review pages (daily + weekly) into the same iCloud folder.

**Tech Stack:** Raycast Extension API, TypeScript, Anthropic Claude API (`@anthropic-ai/sdk`), Node.js `fs`, macOS launchd

**Project Directory:** `~/Programming/english-review/`

**iCloud Drive Base:** `$HOME/Library/Mobile Documents/com~apple~CloudDocs/EnglishReview/`

---

## File Structure

```
english-review/
├── package.json                    # Raycast extension manifest + npm config
├── tsconfig.json                   # TypeScript config
├── src/
│   ├── translate.tsx               # Translate command (JP → EN)
│   ├── correct.tsx                 # Correct command (fix my English)
│   ├── explain.tsx                 # Explain command (what does this mean?)
│   ├── confirm.tsx                 # Confirm command (check my understanding)
│   ├── lib/
│   │   ├── claude.ts               # Claude API client wrapper
│   │   ├── storage.ts              # JSON read/write to iCloud Drive
│   │   ├── prompts.ts              # System prompts for each command type
│   │   └── types.ts                # Shared TypeScript types
├── scripts/
│   ├── generate-daily.ts           # Daily HTML generation script
│   ├── generate-weekly.ts          # Weekly HTML generation script
│   ├── templates/
│   │   ├── daily.html              # Daily HTML template
│   │   ├── weekly.html             # Weekly HTML template
│   │   └── style.css               # Shared CSS for HTML pages
│   └── tsconfig.json               # TypeScript config for scripts
├── launchd/
│   ├── com.english-review.daily.plist    # launchd job for daily generation
│   └── com.english-review.weekly.plist   # launchd job for weekly generation
├── assets/
│   └── icon.png                    # Extension icon (512x512)
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-03-26-english-review-design.md
        └── plans/
            └── 2026-03-26-english-review.md
```

---

## Task 1: Project Scaffolding & Types

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/lib/types.ts`
- Create: `assets/icon.png` (placeholder)

- [ ] **Step 1: Initialize the Raycast extension project**

Create `package.json`:

```json
{
  "$schema": "https://www.raycast.com/schemas/extension.json",
  "name": "english-review",
  "title": "English Review",
  "description": "Record and review English learning interactions with AI analysis",
  "icon": "icon.png",
  "author": "ji",
  "categories": ["Productivity"],
  "license": "MIT",
  "commands": [
    {
      "name": "translate",
      "title": "Translate",
      "description": "Translate Japanese to English",
      "mode": "view"
    },
    {
      "name": "correct",
      "title": "Correct",
      "description": "Correct my English writing",
      "mode": "view"
    },
    {
      "name": "explain",
      "title": "Explain",
      "description": "Explain an English expression",
      "mode": "view"
    },
    {
      "name": "confirm",
      "title": "Confirm",
      "description": "Confirm my understanding of English",
      "mode": "view"
    }
  ],
  "preferences": [
    {
      "name": "anthropicApiKey",
      "type": "password",
      "title": "Anthropic API Key",
      "description": "Your Anthropic API key for Claude",
      "required": true,
      "placeholder": "sk-ant-..."
    },
    {
      "name": "claudeModel",
      "type": "dropdown",
      "title": "Claude Model",
      "description": "Which Claude model to use",
      "required": true,
      "data": [
        { "title": "Claude Sonnet 4.6", "value": "claude-sonnet-4-6-20250514" },
        { "title": "Claude Haiku 4.5", "value": "claude-haiku-4-5-20251001" }
      ]
    }
  ],
  "dependencies": {
    "@raycast/api": "^1.93.3",
    "@raycast/utils": "^1.19.1",
    "@anthropic-ai/sdk": "^0.39.0"
  },
  "devDependencies": {
    "@raycast/eslint-config": "^1.0.11",
    "typescript": "^5.8.2"
  },
  "scripts": {
    "build": "ray build",
    "dev": "ray develop",
    "fix-lint": "ray lint --fix",
    "lint": "ray lint"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@raycast/eslint-config/tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "module": "Node16",
    "moduleResolution": "Node16",
    "resolveJsonModule": true,
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create shared types**

Create `src/lib/types.ts`:

```typescript
export type RecordType = "translation" | "correction" | "explanation" | "confirmation";

export type Difficulty = "basic" | "intermediate" | "advanced";

export interface Analysis {
  reason: string;
  key_point: string;
  categories: string[];
  difficulty: Difficulty;
}

export interface LearningRecord {
  id: string;
  type: RecordType;
  input: string;
  output: string;
  analysis: Analysis;
  created_at: string;
  review_count: number;
}

export interface MonthlyData {
  records: LearningRecord[];
}

export interface CategoryEntry {
  name: string;
  group: "grammar" | "expression" | "vocabulary";
  count: number;
}

export interface CategoriesData {
  categories: CategoryEntry[];
  updated_at: string;
}
```

- [ ] **Step 4: Create a placeholder icon**

Create a 512x512 PNG at `assets/icon.png`. For now, use any solid-color square image. You can generate one with:

```bash
cd ~/Programming/english-review
mkdir -p assets
sips -z 512 512 --setProperty format png /System/Library/Desktop\ Pictures/*.heic --out assets/icon.png 2>/dev/null || python3 -c "
from PIL import Image
img = Image.new('RGB', (512, 512), '#4A90D9')
img.save('assets/icon.png')
" 2>/dev/null || echo "Create a 512x512 icon.png manually in assets/"
```

If neither works, create `assets/icon.png` as any 512x512 PNG.

- [ ] **Step 5: Install dependencies**

```bash
cd ~/Programming/english-review
npm install
```

Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 6: Commit**

```bash
cd ~/Programming/english-review
git init
echo "node_modules/\ndist/\n.DS_Store" > .gitignore
git add .
git commit -m "feat: scaffold Raycast extension project with types"
```

---

## Task 2: Storage Layer (JSON on iCloud Drive)

**Files:**
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Implement the storage module**

Create `src/lib/storage.ts`:

```typescript
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
```

- [ ] **Step 2: Verify the module compiles**

```bash
cd ~/Programming/english-review
npx tsc --noEmit src/lib/storage.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Programming/english-review
git add src/lib/storage.ts
git commit -m "feat: add storage layer for JSON on iCloud Drive"
```

---

## Task 3: Claude API Client & Prompts

**Files:**
- Create: `src/lib/claude.ts`
- Create: `src/lib/prompts.ts`

- [ ] **Step 1: Create the prompts module**

Create `src/lib/prompts.ts`:

```typescript
import { RecordType } from "./types";

export function getSystemPrompt(type: RecordType): string {
  const base = `You are an English language tutor helping a Japanese speaker improve their English. Always respond in the following JSON format:

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
    translation: `
The user will provide Japanese text they couldn't express in English.
Translate it to natural English. Explain WHY this English expression works and what nuances it carries. If there are multiple ways to say it, show the most natural one as the main result and briefly mention alternatives.`,

    correction: `
The user will provide English text they wrote but aren't sure is correct.
Correct the English. Show clearly what changed and WHY each change was needed. If the original is actually correct, say so and explain why it works. Focus on making the correction educational - don't just fix it, explain the underlying rule.`,

    explanation: `
The user will provide an English expression they don't understand.
Explain what it means, when it's used, and give 2-3 example sentences. Explain the nuance and register (formal/casual/slang). If it's an idiom, explain the origin if helpful.`,

    confirmation: `
The user will provide English text they think they understand and want to verify.
Confirm whether their understanding seems correct based on context. If the text has nuances they might be missing, point those out. Be concise - they probably have a rough understanding already, so focus on what they might be missing.`,
  };

  return base + typeSpecific[type];
}

export function getUserPrompt(type: RecordType, input: string): string {
  const prefixes: Record<RecordType, string> = {
    translation: "以下の日本語を自然な英語に翻訳してください:\n\n",
    correction: "以下の英文を訂正してください:\n\n",
    explanation: "以下の英語表現の意味を教えてください:\n\n",
    confirmation: "以下の英語表現の理解が合っているか確認してください:\n\n",
  };

  return prefixes[type] + input;
}
```

- [ ] **Step 2: Create the Claude API client**

Create `src/lib/claude.ts`:

```typescript
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
```

- [ ] **Step 3: Verify compilation**

```bash
cd ~/Programming/english-review
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd ~/Programming/english-review
git add src/lib/claude.ts src/lib/prompts.ts
git commit -m "feat: add Claude API client and prompt templates"
```

---

## Task 4: Translate Command

**Files:**
- Create: `src/translate.tsx`

- [ ] **Step 1: Implement the Translate command**

Create `src/translate.tsx`:

```tsx
import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { useState } from "react";
import { callClaude } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

export default function TranslateCommand() {
  const [result, setResult] = useState<{ markdown: string; record: LearningRecord } | null>(null);

  if (result) {
    return (
      <Detail
        markdown={result.markdown}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Translation" content={result.record.output} />
            <Action title="New Translation" onAction={() => setResult(null)} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Translate"
            onSubmit={async (values: { input: string }) => {
              if (!values.input.trim()) {
                await showToast({ style: Toast.Style.Failure, title: "Input is empty" });
                return;
              }

              const toast = await showToast({ style: Toast.Style.Animated, title: "Translating..." });

              try {
                const response = await callClaude("translation", values.input);

                const record: LearningRecord = {
                  id: randomUUID(),
                  type: "translation",
                  input: values.input,
                  output: response.result,
                  analysis: response.analysis,
                  created_at: new Date().toISOString(),
                  review_count: 0,
                };

                await Clipboard.copy(response.result);

                const markdown = formatTranslationResult(values.input, response.result, response.analysis);
                setResult({ markdown, record });

                toast.style = Toast.Style.Success;
                toast.title = "Translated & copied";

                // Background: save record + update categories
                appendRecord(record).catch(console.error);
                updateCategories(response.analysis.categories).catch(console.error);
              } catch (error) {
                toast.style = Toast.Style.Failure;
                toast.title = "Translation failed";
                toast.message = String(error);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea id="input" title="Japanese" placeholder="翻訳したい日本語を入力..." />
    </Form>
  );
}

function formatTranslationResult(input: string, output: string, analysis: { reason: string; key_point: string; categories: string[]; difficulty: string }): string {
  const categories = analysis.categories.map((c) => `\`${c}\``).join(" ");
  return `## Translation

**Input:** ${input}

**English:** ${output}

---

### Why this expression?
${analysis.reason}

### Key Point
${analysis.key_point}

### Categories
${categories}

### Difficulty
${analysis.difficulty}`;
}
```

- [ ] **Step 2: Run in development mode and test manually**

```bash
cd ~/Programming/english-review
npm run dev
```

Open Raycast, search for "Translate". Enter a Japanese phrase (e.g., "その件はまだ揉んでる最中です"). Verify:
1. The translation result appears
2. The result is copied to clipboard
3. A JSON file is created at `~/Library/Mobile Documents/com~apple~CloudDocs/EnglishReview/data/2026-03.json`

- [ ] **Step 3: Commit**

```bash
cd ~/Programming/english-review
git add src/translate.tsx
git commit -m "feat: add Translate command (JP -> EN with auto-record)"
```

---

## Task 5: Correct Command

**Files:**
- Create: `src/correct.tsx`

- [ ] **Step 1: Implement the Correct command**

Create `src/correct.tsx`:

```tsx
import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { useState } from "react";
import { callClaude } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

export default function CorrectCommand() {
  const [result, setResult] = useState<{ markdown: string; record: LearningRecord } | null>(null);

  if (result) {
    return (
      <Detail
        markdown={result.markdown}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Corrected Text" content={result.record.output} />
            <Action title="New Correction" onAction={() => setResult(null)} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Correct"
            onSubmit={async (values: { input: string }) => {
              if (!values.input.trim()) {
                await showToast({ style: Toast.Style.Failure, title: "Input is empty" });
                return;
              }

              const toast = await showToast({ style: Toast.Style.Animated, title: "Correcting..." });

              try {
                const response = await callClaude("correction", values.input);

                const record: LearningRecord = {
                  id: randomUUID(),
                  type: "correction",
                  input: values.input,
                  output: response.result,
                  analysis: response.analysis,
                  created_at: new Date().toISOString(),
                  review_count: 0,
                };

                await Clipboard.copy(response.result);

                const markdown = formatCorrectionResult(values.input, response.result, response.analysis);
                setResult({ markdown, record });

                toast.style = Toast.Style.Success;
                toast.title = "Corrected & copied";

                appendRecord(record).catch(console.error);
                updateCategories(response.analysis.categories).catch(console.error);
              } catch (error) {
                toast.style = Toast.Style.Failure;
                toast.title = "Correction failed";
                toast.message = String(error);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea id="input" title="Your English" placeholder="訂正したい英文を入力..." />
    </Form>
  );
}

function formatCorrectionResult(input: string, output: string, analysis: { reason: string; key_point: string; categories: string[]; difficulty: string }): string {
  const categories = analysis.categories.map((c) => `\`${c}\``).join(" ");
  return `## Correction

**Original:** ${input}

**Corrected:** ${output}

---

### What was wrong?
${analysis.reason}

### Key Point
${analysis.key_point}

### Categories
${categories}

### Difficulty
${analysis.difficulty}`;
}
```

- [ ] **Step 2: Test manually in Raycast**

With `npm run dev` still running, search for "Correct" in Raycast. Enter an English sentence with errors (e.g., "I have went to the store yesterday"). Verify:
1. The corrected result appears with explanation
2. The result is copied to clipboard
3. The record is appended to the monthly JSON

- [ ] **Step 3: Commit**

```bash
cd ~/Programming/english-review
git add src/correct.tsx
git commit -m "feat: add Correct command (English correction with auto-record)"
```

---

## Task 6: Explain Command

**Files:**
- Create: `src/explain.tsx`

- [ ] **Step 1: Implement the Explain command**

Create `src/explain.tsx`:

```tsx
import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { useState } from "react";
import { callClaude } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

export default function ExplainCommand() {
  const [result, setResult] = useState<{ markdown: string; record: LearningRecord } | null>(null);

  if (result) {
    return (
      <Detail
        markdown={result.markdown}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Explanation" content={result.record.output} />
            <Action title="New Explanation" onAction={() => setResult(null)} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Explain"
            onSubmit={async (values: { input: string }) => {
              if (!values.input.trim()) {
                await showToast({ style: Toast.Style.Failure, title: "Input is empty" });
                return;
              }

              const toast = await showToast({ style: Toast.Style.Animated, title: "Explaining..." });

              try {
                const response = await callClaude("explanation", values.input);

                const record: LearningRecord = {
                  id: randomUUID(),
                  type: "explanation",
                  input: values.input,
                  output: response.result,
                  analysis: response.analysis,
                  created_at: new Date().toISOString(),
                  review_count: 0,
                };

                await Clipboard.copy(response.result);

                const markdown = formatExplanationResult(values.input, response.result, response.analysis);
                setResult({ markdown, record });

                toast.style = Toast.Style.Success;
                toast.title = "Explained & copied";

                appendRecord(record).catch(console.error);
                updateCategories(response.analysis.categories).catch(console.error);
              } catch (error) {
                toast.style = Toast.Style.Failure;
                toast.title = "Explanation failed";
                toast.message = String(error);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea id="input" title="English Expression" placeholder="わからない英語表現を入力..." />
    </Form>
  );
}

function formatExplanationResult(input: string, output: string, analysis: { reason: string; key_point: string; categories: string[]; difficulty: string }): string {
  const categories = analysis.categories.map((c) => `\`${c}\``).join(" ");
  return `## Explanation

**Expression:** ${input}

---

${output}

---

### Why this is worth learning
${analysis.reason}

### Key Point
${analysis.key_point}

### Categories
${categories}

### Difficulty
${analysis.difficulty}`;
}
```

- [ ] **Step 2: Test manually in Raycast**

Search for "Explain" in Raycast. Enter an expression (e.g., "break the ice"). Verify the explanation appears and is recorded.

- [ ] **Step 3: Commit**

```bash
cd ~/Programming/english-review
git add src/explain.tsx
git commit -m "feat: add Explain command (English expression explanation with auto-record)"
```

---

## Task 7: Confirm Command

**Files:**
- Create: `src/confirm.tsx`

- [ ] **Step 1: Implement the Confirm command**

Create `src/confirm.tsx`:

```tsx
import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { useState } from "react";
import { callClaude } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

export default function ConfirmCommand() {
  const [result, setResult] = useState<{ markdown: string; record: LearningRecord } | null>(null);

  if (result) {
    return (
      <Detail
        markdown={result.markdown}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Confirmation" content={result.record.output} />
            <Action title="New Confirmation" onAction={() => setResult(null)} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Confirm"
            onSubmit={async (values: { input: string }) => {
              if (!values.input.trim()) {
                await showToast({ style: Toast.Style.Failure, title: "Input is empty" });
                return;
              }

              const toast = await showToast({ style: Toast.Style.Animated, title: "Confirming..." });

              try {
                const response = await callClaude("confirmation", values.input);

                const record: LearningRecord = {
                  id: randomUUID(),
                  type: "confirmation",
                  input: values.input,
                  output: response.result,
                  analysis: response.analysis,
                  created_at: new Date().toISOString(),
                  review_count: 0,
                };

                await Clipboard.copy(response.result);

                const markdown = formatConfirmationResult(values.input, response.result, response.analysis);
                setResult({ markdown, record });

                toast.style = Toast.Style.Success;
                toast.title = "Confirmed & copied";

                appendRecord(record).catch(console.error);
                updateCategories(response.analysis.categories).catch(console.error);
              } catch (error) {
                toast.style = Toast.Style.Failure;
                toast.title = "Confirmation failed";
                toast.message = String(error);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea id="input" title="English to Confirm" placeholder="確認したい英語表現を入力..." />
    </Form>
  );
}

function formatConfirmationResult(input: string, output: string, analysis: { reason: string; key_point: string; categories: string[]; difficulty: string }): string {
  const categories = analysis.categories.map((c) => `\`${c}\``).join(" ");
  return `## Confirmation

**Expression:** ${input}

---

${output}

---

### Nuance you might miss
${analysis.reason}

### Key Point
${analysis.key_point}

### Categories
${categories}

### Difficulty
${analysis.difficulty}`;
}
```

- [ ] **Step 2: Test manually in Raycast**

Search for "Confirm" in Raycast. Enter text (e.g., "Let's circle back on this"). Verify the confirmation appears and is recorded.

- [ ] **Step 3: Commit**

```bash
cd ~/Programming/english-review
git add src/confirm.tsx
git commit -m "feat: add Confirm command (understanding confirmation with auto-record)"
```

---

## Task 8: Daily HTML Generator

**Files:**
- Create: `scripts/tsconfig.json`
- Create: `scripts/templates/style.css`
- Create: `scripts/templates/daily.html`
- Create: `scripts/generate-daily.ts`

- [ ] **Step 1: Create scripts tsconfig**

Create `scripts/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true
  },
  "include": ["*.ts", "../src/lib/types.ts"]
}
```

- [ ] **Step 2: Create shared CSS**

Create `scripts/templates/style.css`:

```css
:root {
  --bg: #1a1a2e;
  --card-bg: #16213e;
  --text: #e0e0e0;
  --text-muted: #8892a4;
  --accent: #0f3460;
  --success: #4ecca3;
  --error: #e74c3c;
  --warning: #f39c12;
  --info: #3498db;
  --tag-grammar: #e74c3c;
  --tag-expression: #f39c12;
  --tag-vocabulary: #3498db;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  color: var(--success);
}

.subtitle {
  color: var(--text-muted);
  margin-bottom: 2rem;
  font-size: 0.9rem;
}

.stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.stat-card {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 1rem 1.5rem;
  flex: 1;
  min-width: 120px;
  text-align: center;
}

.stat-card .number {
  font-size: 2rem;
  font-weight: bold;
  color: var(--success);
}

.stat-card .label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.section-title {
  font-size: 1.2rem;
  color: var(--info);
  margin: 2rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--accent);
}

.record-card {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  border-left: 4px solid var(--info);
}

.record-card.correction { border-left-color: var(--error); }
.record-card.translation { border-left-color: var(--success); }
.record-card.explanation { border-left-color: var(--info); }
.record-card.confirmation { border-left-color: var(--warning); }

.record-card .input {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.record-card .output {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.record-card .analysis {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 1rem;
  font-size: 0.9rem;
}

.record-card .analysis h4 {
  color: var(--warning);
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
  text-transform: uppercase;
}

.record-card .analysis p {
  margin-bottom: 0.8rem;
}

.record-card .analysis p:last-child {
  margin-bottom: 0;
}

.tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.8rem;
}

.tag {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-weight: 500;
}

.tag.grammar { background: rgba(231, 76, 60, 0.2); color: var(--tag-grammar); }
.tag.expression { background: rgba(243, 156, 18, 0.2); color: var(--tag-expression); }
.tag.vocabulary { background: rgba(52, 152, 219, 0.2); color: var(--tag-vocabulary); }

.difficulty {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 4rem 0;
  font-size: 1.1rem;
}

@media (max-width: 600px) {
  body { padding: 1rem; }
  .stats { flex-direction: column; }
}
```

- [ ] **Step 3: Create daily HTML template**

Create `scripts/templates/daily.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>English Review - {{date}}</title>
  <link rel="stylesheet" href="../assets/style.css">
</head>
<body>
  <h1>English Review</h1>
  <p class="subtitle">{{date}} - {{count}} items</p>

  <div class="stats">
    <div class="stat-card">
      <div class="number">{{translationCount}}</div>
      <div class="label">Translations</div>
    </div>
    <div class="stat-card">
      <div class="number">{{correctionCount}}</div>
      <div class="label">Corrections</div>
    </div>
    <div class="stat-card">
      <div class="number">{{explanationCount}}</div>
      <div class="label">Explanations</div>
    </div>
    <div class="stat-card">
      <div class="number">{{confirmationCount}}</div>
      <div class="label">Confirmations</div>
    </div>
  </div>

  {{records}}
</body>
</html>
```

- [ ] **Step 4: Implement the daily HTML generator script**

Create `scripts/generate-daily.ts`:

```typescript
import { readFile, writeFile, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface Analysis {
  reason: string;
  key_point: string;
  categories: string[];
  difficulty: string;
}

interface LearningRecord {
  id: string;
  type: string;
  input: string;
  output: string;
  analysis: Analysis;
  created_at: string;
  review_count: number;
}

interface MonthlyData {
  records: LearningRecord[];
}

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
const TEMPLATES_DIR = join(__dirname, "templates");

const GRAMMAR_KEYWORDS = [
  "冠詞", "時制", "前置詞", "単数", "複数", "関係代名詞",
  "助動詞", "受動態", "能動態", "主語", "目的語", "接続詞",
];
const EXPRESSION_KEYWORDS = [
  "直訳", "語順", "フォーマル", "カジュアル", "冗長", "不自然",
];

function getTagClass(category: string): string {
  const lower = category.toLowerCase();
  if (GRAMMAR_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return "grammar";
  if (EXPRESSION_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return "expression";
  return "vocabulary";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRecord(record: LearningRecord): string {
  const tags = record.analysis.categories
    .map((c) => `<span class="tag ${getTagClass(c)}">${escapeHtml(c)}</span>`)
    .join("");

  const typeLabels: Record<string, string> = {
    translation: "Translation",
    correction: "Correction",
    explanation: "Explanation",
    confirmation: "Confirmation",
  };

  return `
    <div class="record-card ${record.type}">
      <div class="input">${escapeHtml(record.input)}</div>
      <div class="output">${escapeHtml(record.output)}</div>
      <div class="analysis">
        <h4>Why?</h4>
        <p>${escapeHtml(record.analysis.reason)}</p>
        <h4>Key Point</h4>
        <p>${escapeHtml(record.analysis.key_point)}</p>
      </div>
      <div class="tags">${tags}</div>
      <div class="difficulty">${typeLabels[record.type] || record.type} - ${record.analysis.difficulty}</div>
    </div>`;
}

async function main() {
  // Target date: yesterday (or pass as argument)
  const arg = process.argv[2];
  const targetDate = arg ? new Date(arg) : new Date(Date.now() - 86400000);
  const dateStr = targetDate.toISOString().slice(0, 10);
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");

  // Ensure output directories
  for (const dir of [DAILY_DIR, ASSETS_DIR]) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  // Copy CSS to iCloud assets
  const cssSource = join(TEMPLATES_DIR, "style.css");
  const cssDest = join(ASSETS_DIR, "style.css");
  await copyFile(cssSource, cssDest);

  // Read monthly data
  const monthlyFile = join(DATA_DIR, `${year}-${month}.json`);
  if (!existsSync(monthlyFile)) {
    console.log(`No data file for ${year}-${month}. Skipping.`);
    return;
  }

  const raw = await readFile(monthlyFile, "utf-8");
  const data = JSON.parse(raw) as MonthlyData;
  const records = data.records.filter((r) => r.created_at.slice(0, 10) === dateStr);

  if (records.length === 0) {
    console.log(`No records for ${dateStr}. Skipping.`);
    return;
  }

  // Count by type
  const counts = { translation: 0, correction: 0, explanation: 0, confirmation: 0 };
  for (const r of records) {
    if (r.type in counts) {
      counts[r.type as keyof typeof counts] += 1;
    }
  }

  // Read template
  const template = await readFile(join(TEMPLATES_DIR, "daily.html"), "utf-8");

  // Render records HTML
  const recordsHtml = records.map(renderRecord).join("\n");

  // Fill template
  const html = template
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{count\}\}/g, String(records.length))
    .replace(/\{\{translationCount\}\}/g, String(counts.translation))
    .replace(/\{\{correctionCount\}\}/g, String(counts.correction))
    .replace(/\{\{explanationCount\}\}/g, String(counts.explanation))
    .replace(/\{\{confirmationCount\}\}/g, String(counts.confirmation))
    .replace(/\{\{records\}\}/g, recordsHtml);

  // Write output
  const outputPath = join(DAILY_DIR, `${dateStr}.html`);
  await writeFile(outputPath, html, "utf-8");
  console.log(`Generated: ${outputPath}`);
}

main().catch((err) => {
  console.error("Failed to generate daily HTML:", err);
  process.exit(1);
});
```

- [ ] **Step 5: Test the daily generator with sample data**

First, create a sample JSON data file to test with:

```bash
mkdir -p "$HOME/Library/Mobile Documents/com~apple~CloudDocs/EnglishReview/data"
cat > "$HOME/Library/Mobile Documents/com~apple~CloudDocs/EnglishReview/data/2026-03.json" << 'EOF'
{
  "records": [
    {
      "id": "test-1",
      "type": "correction",
      "input": "I have went to the store yesterday",
      "output": "I went to the store yesterday",
      "analysis": {
        "reason": "yesterdayがあるので過去形を使う。have+過去分詞は現在完了で、明確な過去の時点を示す語とは一緒に使えない。",
        "key_point": "明確な過去の時点 (yesterday, last week等) → 過去形。現在完了は「いつ」を特定しない。",
        "categories": ["時制", "現在完了 vs 過去形"],
        "difficulty": "basic"
      },
      "created_at": "2026-03-25T10:30:00Z",
      "review_count": 0
    },
    {
      "id": "test-2",
      "type": "translation",
      "input": "その件はまだ揉んでる最中です",
      "output": "We're still hashing it out.",
      "analysis": {
        "reason": "hash outは議論して解決するという意味のイディオム。カジュアルなビジネス表現。",
        "key_point": "hash out = 議論して解決する。フォーマルには still under discussion も可。",
        "categories": ["イディオム", "ビジネス表現"],
        "difficulty": "intermediate"
      },
      "created_at": "2026-03-25T11:00:00Z",
      "review_count": 0
    }
  ]
}
EOF
```

Then run the generator:

```bash
cd ~/Programming/english-review
npx tsx scripts/generate-daily.ts 2026-03-25
```

Expected: `Generated: .../EnglishReview/daily/2026-03-25.html`

Open the generated HTML in a browser:

```bash
open "$HOME/Library/Mobile Documents/com~apple~CloudDocs/EnglishReview/daily/2026-03-25.html"
```

Verify: Dark-themed page with two record cards, properly styled.

- [ ] **Step 6: Commit**

```bash
cd ~/Programming/english-review
git add scripts/
git commit -m "feat: add daily HTML review generator with dark theme"
```

---

## Task 9: Weekly HTML Generator

**Files:**
- Create: `scripts/templates/weekly.html`
- Create: `scripts/generate-weekly.ts`

- [ ] **Step 1: Create weekly HTML template**

Create `scripts/templates/weekly.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly English Review - {{weekLabel}}</title>
  <link rel="stylesheet" href="../assets/style.css">
  <style>
    .bar-chart { margin: 1rem 0; }
    .bar-row {
      display: flex;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .bar-label {
      width: 180px;
      font-size: 0.85rem;
      text-align: right;
      padding-right: 1rem;
      color: var(--text-muted);
    }
    .bar-track {
      flex: 1;
      height: 24px;
      background: var(--accent);
      border-radius: 4px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 4px;
      display: flex;
      align-items: center;
      padding-left: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;
      min-width: fit-content;
    }
    .bar-fill.grammar { background: var(--tag-grammar); }
    .bar-fill.expression { background: var(--tag-expression); }
    .bar-fill.vocabulary { background: var(--tag-vocabulary); }
    .top-mistakes { list-style: none; }
    .top-mistakes li {
      background: var(--card-bg);
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 0.5rem;
    }
    .top-mistakes .count {
      color: var(--error);
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>Weekly Review</h1>
  <p class="subtitle">{{weekLabel}} - {{totalCount}} items</p>

  <div class="stats">
    <div class="stat-card">
      <div class="number">{{totalCount}}</div>
      <div class="label">Total</div>
    </div>
    <div class="stat-card">
      <div class="number">{{uniqueCategories}}</div>
      <div class="label">Categories</div>
    </div>
  </div>

  <h2 class="section-title">Weakness Categories</h2>
  <div class="bar-chart">
    {{categoryBars}}
  </div>

  <h2 class="section-title">Most Repeated Mistakes</h2>
  <ol class="top-mistakes">
    {{topMistakes}}
  </ol>

  <h2 class="section-title">All Records This Week</h2>
  {{records}}
</body>
</html>
```

- [ ] **Step 2: Implement the weekly HTML generator**

Create `scripts/generate-weekly.ts`:

```typescript
import { readFile, writeFile, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface Analysis {
  reason: string;
  key_point: string;
  categories: string[];
  difficulty: string;
}

interface LearningRecord {
  id: string;
  type: string;
  input: string;
  output: string;
  analysis: Analysis;
  created_at: string;
  review_count: number;
}

interface MonthlyData {
  records: LearningRecord[];
}

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
const TEMPLATES_DIR = join(__dirname, "templates");

const GRAMMAR_KEYWORDS = [
  "冠詞", "時制", "前置詞", "単数", "複数", "関係代名詞",
  "助動詞", "受動態", "能動態", "主語", "目的語", "接続詞",
];
const EXPRESSION_KEYWORDS = [
  "直訳", "語順", "フォーマル", "カジュアル", "冗長", "不自然",
];

function getTagClass(category: string): string {
  const lower = category.toLowerCase();
  if (GRAMMAR_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return "grammar";
  if (EXPRESSION_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return "expression";
  return "vocabulary";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil((diff / oneWeek + start.getDay() + 1) / 7);
}

function renderRecord(record: LearningRecord): string {
  const tags = record.analysis.categories
    .map((c) => `<span class="tag ${getTagClass(c)}">${escapeHtml(c)}</span>`)
    .join("");

  return `
    <div class="record-card ${record.type}">
      <div class="input">${escapeHtml(record.input)}</div>
      <div class="output">${escapeHtml(record.output)}</div>
      <div class="analysis">
        <h4>Why?</h4>
        <p>${escapeHtml(record.analysis.reason)}</p>
        <h4>Key Point</h4>
        <p>${escapeHtml(record.analysis.key_point)}</p>
      </div>
      <div class="tags">${tags}</div>
    </div>`;
}

async function loadRecordsForDateRange(startDate: Date, endDate: Date): Promise<LearningRecord[]> {
  const records: LearningRecord[] = [];
  const months = new Set<string>();

  const current = new Date(startDate);
  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    months.add(`${year}-${month}`);
    current.setDate(current.getDate() + 1);
  }

  for (const monthKey of months) {
    const filePath = join(DATA_DIR, `${monthKey}.json`);
    if (!existsSync(filePath)) continue;

    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as MonthlyData;

    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    const filtered = data.records.filter((r) => {
      const d = r.created_at.slice(0, 10);
      return d >= startStr && d <= endStr;
    });

    records.push(...filtered);
  }

  return records;
}

async function main() {
  // End date: yesterday (or pass as argument)
  const arg = process.argv[2];
  const endDate = arg ? new Date(arg) : new Date(Date.now() - 86400000);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const weekNum = getWeekNumber(endDate);
  const weekLabel = `${endDate.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  const dateRange = `${startDate.toISOString().slice(0, 10)} ~ ${endDate.toISOString().slice(0, 10)}`;

  // Ensure output directories
  for (const dir of [WEEKLY_DIR, ASSETS_DIR]) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  // Copy CSS
  const cssSource = join(TEMPLATES_DIR, "style.css");
  const cssDest = join(ASSETS_DIR, "style.css");
  await copyFile(cssSource, cssDest);

  // Load records
  const records = await loadRecordsForDateRange(startDate, endDate);

  if (records.length === 0) {
    console.log(`No records for week ${weekLabel}. Skipping.`);
    return;
  }

  // Count categories
  const categoryCounts = new Map<string, number>();
  for (const r of records) {
    for (const cat of r.analysis.categories) {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
  }

  const sortedCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxCount = sortedCategories.length > 0 ? sortedCategories[0][1] : 1;

  // Render category bars
  const categoryBars = sortedCategories
    .map(([name, count]) => {
      const width = Math.max((count / maxCount) * 100, 15);
      const tagClass = getTagClass(name);
      return `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(name)}</div>
        <div class="bar-track">
          <div class="bar-fill ${tagClass}" style="width: ${width}%">${count}</div>
        </div>
      </div>`;
    })
    .join("");

  // Top repeated mistakes (categories that appear 3+ times)
  const topMistakes = sortedCategories
    .filter(([, count]) => count >= 2)
    .slice(0, 5)
    .map(([name, count]) => `<li><span class="count">${count}x</span> ${escapeHtml(name)}</li>`)
    .join("");

  // Render all records
  const recordsHtml = records.map(renderRecord).join("\n");

  // Read template
  const template = await readFile(join(TEMPLATES_DIR, "weekly.html"), "utf-8");

  // Fill template
  const html = template
    .replace(/\{\{weekLabel\}\}/g, `${weekLabel} (${dateRange})`)
    .replace(/\{\{totalCount\}\}/g, String(records.length))
    .replace(/\{\{uniqueCategories\}\}/g, String(categoryCounts.size))
    .replace(/\{\{categoryBars\}\}/g, categoryBars)
    .replace(/\{\{topMistakes\}\}/g, topMistakes || "<li>No repeated patterns yet</li>")
    .replace(/\{\{records\}\}/g, recordsHtml);

  // Write output
  const outputPath = join(WEEKLY_DIR, `${weekLabel}.html`);
  await writeFile(outputPath, html, "utf-8");
  console.log(`Generated: ${outputPath}`);
}

main().catch((err) => {
  console.error("Failed to generate weekly HTML:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Test the weekly generator**

```bash
cd ~/Programming/english-review
npx tsx scripts/generate-weekly.ts 2026-03-25
```

Expected: `Generated: .../EnglishReview/weekly/2026-W13.html`

Open and verify:

```bash
open "$HOME/Library/Mobile Documents/com~apple~CloudDocs/EnglishReview/weekly/2026-W13.html"
```

Verify: Category bar chart, top mistakes list, all records displayed.

- [ ] **Step 4: Commit**

```bash
cd ~/Programming/english-review
git add scripts/templates/weekly.html scripts/generate-weekly.ts
git commit -m "feat: add weekly HTML review generator with category charts"
```

---

## Task 10: launchd Scheduled Jobs

**Files:**
- Create: `launchd/com.english-review.daily.plist`
- Create: `launchd/com.english-review.weekly.plist`

- [ ] **Step 1: Create daily launchd plist**

Create `launchd/com.english-review.daily.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.english-review.daily</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npx</string>
        <string>tsx</string>
        <string>~/Programming/english-review/scripts/generate-daily.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>~/Programming/english-review</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/english-review-daily.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/english-review-daily.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
```

- [ ] **Step 2: Create weekly launchd plist**

Create `launchd/com.english-review.weekly.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.english-review.weekly</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npx</string>
        <string>tsx</string>
        <string>~/Programming/english-review/scripts/generate-weekly.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>~/Programming/english-review</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>1</integer>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/english-review-weekly.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/english-review-weekly.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
```

- [ ] **Step 3: Verify npx path and install the jobs**

First, find the correct npx path:

```bash
which npx
```

If it's not `/usr/local/bin/npx`, update the `ProgramArguments` in both plist files with the correct path.

Then install:

```bash
cp ~/Programming/english-review/launchd/com.english-review.daily.plist ~/Library/LaunchAgents/
cp ~/Programming/english-review/launchd/com.english-review.weekly.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.english-review.daily.plist
launchctl load ~/Library/LaunchAgents/com.english-review.weekly.plist
```

Verify they're loaded:

```bash
launchctl list | grep english-review
```

Expected: Two entries listed.

- [ ] **Step 4: Test the daily job manually**

```bash
launchctl start com.english-review.daily
cat /tmp/english-review-daily.log
```

Expected: Log shows "Generated: ..." or "No records for ...".

- [ ] **Step 5: Commit**

```bash
cd ~/Programming/english-review
git add launchd/
git commit -m "feat: add launchd jobs for daily and weekly HTML generation"
```

---

## Task 11: End-to-End Test

This task verifies the full flow works from Raycast command through to HTML generation.

- [ ] **Step 1: Start the extension in dev mode**

```bash
cd ~/Programming/english-review
npm run dev
```

- [ ] **Step 2: Use each Raycast command**

Open Raycast and test each command:

1. **Translate**: Enter "会議を来週に延期したい" → Verify English translation appears, result is copied to clipboard
2. **Correct**: Enter "I have went to meeting yesterday" → Verify correction appears
3. **Explain**: Enter "let's circle back" → Verify explanation appears
4. **Confirm**: Enter "I'll get back to you by EOD" → Verify confirmation appears

- [ ] **Step 3: Verify JSON data was recorded**

```bash
cat "$HOME/Library/Mobile Documents/com~apple~CloudDocs/EnglishReview/data/2026-03.json" | python3 -m json.tool | head -50
```

Expected: JSON with 4 records, each containing `input`, `output`, `analysis` with categories.

- [ ] **Step 4: Generate today's daily HTML**

```bash
cd ~/Programming/english-review
npx tsx scripts/generate-daily.ts $(date +%Y-%m-%d)
open "$HOME/Library/Mobile Documents/com~apple~CloudDocs/EnglishReview/daily/$(date +%Y-%m-%d).html"
```

Expected: Rich HTML page with all 4 records, properly styled with dark theme, category tags, and analysis sections.

- [ ] **Step 5: Commit final state**

```bash
cd ~/Programming/english-review
git add -A
git commit -m "feat: complete English Review Tool MVP"
```
