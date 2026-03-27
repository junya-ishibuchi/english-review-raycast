import { Detail, showToast, Toast } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { analyzeInBackground } from "./lib/claude";
import { updateRecord, updateCategories } from "./lib/storage";
import { LearningRecord, MonthlyData } from "./lib/types";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DATA_DIR = join(homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs", "EnglishReview", "data");

async function findUnanalyzedRecords(): Promise<{ records: LearningRecord[]; filePath: string }[]> {
  const results: { records: LearningRecord[]; filePath: string }[] = [];

  if (!existsSync(DATA_DIR)) return results;

  const { readdirSync } = await import("fs");
  const files = readdirSync(DATA_DIR).filter((f) => f.match(/^\d{4}-\d{2}\.json$/));

  for (const file of files) {
    const filePath = join(DATA_DIR, file);
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as MonthlyData;
    const unanalyzed = data.records.filter(
      (r) => r.output && (!r.analysis.sentences || r.analysis.sentences.length === 0)
    );
    if (unanalyzed.length > 0) {
      results.push({ records: unanalyzed, filePath });
    }
  }

  return results;
}

export default function ReanalyzeCommand() {
  const [status, setStatus] = useState("Searching for unanalyzed records...");
  const launched = useRef(false);

  useEffect(() => {
    if (launched.current) return;
    launched.current = true;

    (async () => {
      const groups = await findUnanalyzedRecords();
      const total = groups.reduce((sum, g) => sum + g.records.length, 0);

      if (total === 0) {
        setStatus("All records are analyzed. Nothing to do.");
        await showToast({ style: Toast.Style.Success, title: "All records analyzed" });
        return;
      }

      setStatus(`Found ${total} unanalyzed records. Analyzing...`);
      await showToast({ style: Toast.Style.Animated, title: `Analyzing ${total} records...` });

      let done = 0;
      let failed = 0;

      for (const group of groups) {
        for (const record of group.records) {
          try {
            const analysis = await analyzeInBackground(record.type, record.input, record.output);

            // Read fresh data and update in place
            const raw = await readFile(group.filePath, "utf-8");
            const data = JSON.parse(raw) as MonthlyData;
            const idx = data.records.findIndex((r) => r.id === record.id);
            if (idx >= 0) {
              data.records[idx].analysis = analysis;
              await writeFile(group.filePath, JSON.stringify(data, null, 2), "utf-8");
            }
            await updateCategories(analysis.categories);
            done++;
          } catch {
            failed++;
          }
          setStatus(`Analyzed ${done}/${total}${failed > 0 ? ` (${failed} failed)` : ""}...`);
        }
      }

      const msg = `Done: ${done} analyzed${failed > 0 ? `, ${failed} failed` : ""}`;
      setStatus(msg);
      await showToast({ style: Toast.Style.Success, title: msg });
    })();
  }, []);

  return <Detail markdown={`## Reanalyze\n\n${status}`} />;
}
