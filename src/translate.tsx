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
