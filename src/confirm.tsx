import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard } from "@raycast/api";
import { useState } from "react";
import { callFast, analyzeInBackground } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

export default function ConfirmCommand() {
  const [result, setResult] = useState<{ markdown: string; output: string } | null>(null);

  if (result) {
    return (
      <Detail
        markdown={result.markdown}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Confirmation" content={result.output} />
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
                const { result: output } = await callFast("confirmation", values.input);

                await Clipboard.copy(output);

                const markdown = output;
                setResult({ markdown, output });

                toast.style = Toast.Style.Success;
                toast.title = "Confirmed & copied";

                analyzeInBackground("confirmation", values.input, output)
                  .then((analysis) => {
                    const record: LearningRecord = {
                      id: randomUUID(),
                      type: "confirmation",
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
