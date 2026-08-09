export type Category = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
};

export type TextMappingRow = {
  id: string;
  match_pattern: string;
  match_type: "prefix" | "contains" | "exact";
  comment: string | null;
  category_id: string | null;
  min_amount: number | null;
  max_amount: number | null;
  display_mode: "grouped" | "individual";
  is_extraordinary: boolean;
  active: boolean;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  date: string;
  raw_text: string;
  amount: number;
  balance: number | null;
  status: string | null;
  reconciled: string | null;
  row_hash: string;
  comment: string | null;
  category_id: string | null;
  is_extraordinary: boolean;
  mapping_id: string | null;
  import_seq: number;
  created_at: string;
};

export type UploadRow = {
  id: string;
  filename: string | null;
  uploaded_at: string;
  rows_imported: number;
  rows_skipped: number;
};

export type AlertType = "price_increase" | "missing_recurring" | "unusual_amount";

export type AlertRow = {
  id: string;
  type: AlertType;
  label: string;
  transaction_id: string | null;
  mapping_id: string | null;
  previous_amount: number | null;
  new_amount: number | null;
  month_key: string;
  typical_day: number | null;
  acknowledged: boolean;
  created_at: string;
};

export type AdvisorInsightRow = {
  id: string;
  content: string;
  model: string;
  created_at: string;
};

export type AdvisorMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type ForecastSettingsRow = {
  id: string;
  monthly_income_override: number | null;
  advisor_notes: string | null;
  updated_at: string;
};
