import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard, getSelectedText, popToRoot } from "@raycast/api";
import React, { useEffect, useRef, useState } from "react";
import { callFast, callFollowUp, analyzeInBackground, translateToJapanese } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

type State =
  | { mode: "loading" }
  | { mode: "form" }
  | { mode: "result"; input: string; markdown: string; output: string }
  | { mode: "followup"; input: string; output: string };

function addJapanese(output: string, setState: React.Dispatch<React.SetStateAction<State>>) {
  translateToJapanese(output)
    .then((japanese) => {
      setState((prev) => {
        if (prev.mode !== "result") return prev;
        return { ...prev, markdown: `${prev.output}\n\n---\n\n${japanese}` };
      });
    })
    .catch(console.error);
}

function saveRecord(input: string, output: string) {
  const id = randomUUID();
  const created_at = new Date().toISOString();

  analyzeInBackground("correction", input, output)
    .then((analysis) => {
      const record: LearningRecord = { id, type: "correction", input, output, analysis, created_at, review_count: 0 };
      appendRecord(record).catch(console.error);
      updateCategories(analysis.categories).catch(console.error);
    })
    .catch(() => {
      const fallback: LearningRecord = { id, type: "correction", input, output, analysis: { sentences: [], categories: [], difficulty: "basic" }, created_at, review_count: 0 };
      appendRecord(fallback).catch(console.error);
    });
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
          addJapanese(output, setState);
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
                  addJapanese(output, setState);
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
                  addJapanese(newOutput, setState);
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
