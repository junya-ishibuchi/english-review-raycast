import { Action, ActionPanel, Detail, Form, showToast, Toast, Clipboard, getSelectedText } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { callFast, analyzeInBackground } from "./lib/claude";
import { appendRecord, updateCategories } from "./lib/storage";
import { LearningRecord } from "./lib/types";
import { randomUUID } from "crypto";

type State = { mode: "loading" } | { mode: "form" } | { mode: "result"; markdown: string; output: string };

async function run(input: string, setState: (s: State) => void) {
  const toast = await showToast({ style: Toast.Style.Animated, title: "Translating..." });
  try {
    const { result: output } = await callFast("toJapanese", input);
    await Clipboard.copy(output);
    setState({ mode: "result", markdown: output, output });
    toast.style = Toast.Style.Success;
    toast.title = "Translated & copied";

    analyzeInBackground("toJapanese", input, output)
      .then((analysis) => {
        const record: LearningRecord = {
          id: randomUUID(),
          type: "toJapanese",
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
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Translation failed";
    toast.message = String(error);
  }
}

export default function ToJapaneseCommand() {
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
        await run(input, setState);
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
              title="Translate to Japanese"
              onSubmit={async (values: { input: string }) => {
                if (!values.input.trim()) {
                  await showToast({ style: Toast.Style.Failure, title: "Input is empty" });
                  return;
                }
                await run(values.input.trim(), setState);
              }}
            />
          </ActionPanel>
        }
      >
        <Form.TextArea id="input" title="English" placeholder="翻訳したい英文を入力..." />
      </Form>
    );
  }

  return (
    <Detail
      markdown={state.markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Translation" content={state.output} />
        </ActionPanel>
      }
    />
  );
}
