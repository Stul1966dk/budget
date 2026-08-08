export type MatchType = "prefix" | "contains" | "exact";

export type MappingRule = {
  id: string;
  matchPattern: string;
  matchType: MatchType;
  comment: string | null;
  categoryId: string | null;
  /** Absolut beløbsinterval (uden fortegn) posteringen skal falde inden for,
   * ud over tekst-mønsteret. Begge felter er valgfrie. Bruges til at skelne
   * flere forskellige poster der deler identisk banktekst. */
  minAmount: number | null;
  maxAmount: number | null;
};

export type MappableTransaction = {
  id: string;
  rawText: string;
  amount: number;
  comment: string | null;
  categoryId: string | null;
  mappingId: string | null;
};
