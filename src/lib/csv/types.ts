export type DanskeBankRow = {
  date: string; // ISO-dato (YYYY-MM-DD)
  rawText: string;
  amount: number;
  balance: number | null;
  status: string | null;
  reconciled: string | null;
  rowHash: string;
};

export type ParseRowError = {
  rowNumber: number;
  message: string;
  raw: string[];
};

export type ParseResult = {
  rows: DanskeBankRow[];
  errors: ParseRowError[];
};
