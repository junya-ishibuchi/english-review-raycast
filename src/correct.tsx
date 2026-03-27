import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard, getSelectedText } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { callFast, callFollowUp, analyzeInBackground } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

type State =
  | { mode: "loading" }
  | { mode: "form" }
  | { mode: "result"; input: string; markdown: string; output: string }
  | { mode: "followup"; input: string; output: string };

function saveRecord(input: string, output: string) {
  analyzeInBackground("correction", input, output)
    .then((analysis) => {
      const record: LearningRecord = {
        id: randomUUID(),
        type: "correction",
        input,
        output,
        analysis,
        created_at: new Date().toISOString(),
        review_count: 0,
      };
      appendRecord(record).catch(console.error);
      updateCategories(analysis.categories).catch(console.error);
    })
    .catch(console.error);
}

export default function CorrectCommand() {
  const [state, setState] = useState<State>({ mode: "loading" });
  const launched = useRef(false);

  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    (async () => {
      let input = "";
      try {
        input = (await getSelectedText()).trim();
      } catch {
        // no selection
      }
      if (input) {
        const toast = await showToast({ style: Toast.Style.Animated, title: "Correcting..." });
        try {
          const { result: output } = await callFast("correction", input);
          await Clipboard.copy(output);
          setState({ mode: "result", input, markdown: output, output });
          toast.style = Toast.Style.Success;
          toast.title = "Corrected & copied";
          saveRecord(input, output);
        } catch (error) {
          toast.style = Toast.Style.Failure;
          toast.title = "Correction failed";
          toast.message = String(error);
        }
      } else {
        setState({ mode: "form" });
      }
    })();
  }, []);

  if (state.mode === "loading") {
    return <Detail isLoading markdown="" />;
  }

  if (state.mode === "form") {
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
                const input = values.input.trim();
                const toast = await showToast({ style: Toast.Style.Animated, title: "Correcting..." });
                try {
                  const { result: output } = await callFast("correction", input);
                  await Clipboard.copy(output);
                  setState({ mode: "result", input, markdown: output, output });
                  toast.style = Toast.Style.Success;
                  toast.title = "Corrected & copied";
                  saveRecord(input, output);
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
        <Form.TextArea id="input" title="English" placeholder="訂正したい英文を入力..." />
      </Form>
    );
  }

  if (state.mode === "followup") {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Send Follow Up"
              onSubmit={async (values: { followup: string }) => {
                if (!values.followup.trim()) {
                  await showToast({ style: Toast.Style.Failure, title: "Input is empty" });
                  return;
                }
                const toast = await showToast({ style: Toast.Style.Animated, title: "Revising..." });
                try {
                  const { result: newOutput } = await callFollowUp("correction", state.input, state.output, values.followup.trim());
                  await Clipboard.copy(newOutput);
                  setState({ mode: "result", input: state.input, markdown: newOutput, output: newOutput });
                  toast.style = Toast.Style.Success;
                  toast.title = "Revised & copied";
                  saveRecord(state.input, newOutput);
                } catch (error) {
                  toast.style = Toast.Style.Failure;
                  toast.title = "Follow up failed";
                  toast.message = String(error);
                }
              }}
            />
          </ActionPanel>
        }
      >
        <Form.TextArea id="followup" title="Follow Up" placeholder="ニュアンスの追加や修正の指示..." />
      </Form>
    );
  }

  return (
    <Detail
      markdown={state.markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Corrected Text" content={state.output} />
          <Action title="Follow Up" onAction={() => setState({ mode: "followup", input: state.input, output: state.output })} />
        </ActionPanel>
      }
    />
  );
}
