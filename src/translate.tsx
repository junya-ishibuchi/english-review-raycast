import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard, getSelectedText, popToRoot } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { callFast, callFollowUp, analyzeInBackground } from "./lib/claude";
import { appendRecord, updateRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

type State =
  | { mode: "loading" }
  | { mode: "form" }
  | { mode: "result"; input: string; markdown: string; output: string }
  | { mode: "followup"; input: string; output: string };

const emptyAnalysis = { sentences: [], categories: [], difficulty: "basic" as const };

function runAnalysis(recordId: string, input: string, output: string) {
  analyzeInBackground("translation", input, output)
    .then((analysis) => {
      updateRecord(recordId, { analysis }).catch(console.error);
      updateCategories(analysis.categories).catch(console.error);
    })
    .catch(console.error);
}

export default function TranslateCommand() {
  const [state, setState] = useState<State>({ mode: "loading" });
  const launched = useRef(false);
  const recordId = useRef(randomUUID());

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
        const record: LearningRecord = { id: recordId.current, type: "translation", input, output: "", analysis: emptyAnalysis, created_at: new Date().toISOString(), review_count: 0 };
        appendRecord(record).catch(console.error);

        const toast = await showToast({ style: Toast.Style.Animated, title: "Translating..." });
        try {
          const { result: output } = await callFast("translation", input);
          await Clipboard.copy(output);
          setState({ mode: "result", input, markdown: output, output });
          toast.style = Toast.Style.Success;
          toast.title = "Translated & copied";
          updateRecord(recordId.current, { output }).catch(console.error);
          runAnalysis(recordId.current, input, output);
        } catch (error) {
          toast.style = Toast.Style.Failure;
          toast.title = "Translation failed";
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
              title="Translate"
              onSubmit={async (values: { input: string }) => {
                if (!values.input.trim()) {
                  await showToast({ style: Toast.Style.Failure, title: "Input is empty" });
                  return;
                }
                const input = values.input.trim();
                recordId.current = randomUUID();
                const record: LearningRecord = { id: recordId.current, type: "translation", input, output: "", analysis: emptyAnalysis, created_at: new Date().toISOString(), review_count: 0 };
                appendRecord(record).catch(console.error);

                const toast = await showToast({ style: Toast.Style.Animated, title: "Translating..." });
                try {
                  const { result: output } = await callFast("translation", input);
                  await Clipboard.copy(output);
                  setState({ mode: "result", input, markdown: output, output });
                  toast.style = Toast.Style.Success;
                  toast.title = "Translated & copied";
                  updateRecord(recordId.current, { output }).catch(console.error);
                  runAnalysis(recordId.current, input, output);
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
                  const { result: newOutput } = await callFollowUp("translation", state.input, state.output, values.followup.trim());
                  await Clipboard.copy(newOutput);
                  setState({ mode: "result", input: state.input, markdown: newOutput, output: newOutput });
                  toast.style = Toast.Style.Success;
                  toast.title = "Revised & copied";
                  updateRecord(recordId.current, { output: newOutput }).catch(console.error);
                  runAnalysis(recordId.current, state.input, newOutput);
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
          <Action title="Paste & Close" onAction={async () => { await Clipboard.paste(state.output); popToRoot(); }} />
          <Action title="Follow Up" onAction={() => setState({ mode: "followup", input: state.input, output: state.output })} />
        </ActionPanel>
      }
    />
  );
}
