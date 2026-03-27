import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { useState } from "react";
import { callFast, analyzeInBackground } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

export default function CorrectCommand() {
  const [result, setResult] = useState<{ markdown: string; output: string } | null>(null);

  if (result) {
    return (
      <Detail
        markdown={result.markdown}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Corrected Text" content={result.output} />
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
                const { result: output } = await callFast("correction", values.input);

                await Clipboard.copy(output);

                const markdown = `## Correction\n\n**Original:** ${values.input}\n\n**Corrected:** ${output}`;
                setResult({ markdown, output });

                toast.style = Toast.Style.Success;
                toast.title = "Corrected & copied";

                analyzeInBackground("correction", values.input, output)
                  .then((analysis) => {
                    const record: LearningRecord = {
                      id: randomUUID(),
                      type: "correction",
                      input: values.input,
                      output,
                      analysis,
                      created_at: new Date().toISOString(),
                      review_count: 0,
                    };
                    appendRecord(record).catch(console.error);
                    updateCategories(analysis.categories).catch(console.error);
                  })
                  .catch(console.error);
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
