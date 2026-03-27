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
