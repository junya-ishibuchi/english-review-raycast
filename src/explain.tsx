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
