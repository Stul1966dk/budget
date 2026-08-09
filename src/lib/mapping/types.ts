export type MatchType = "prefix" | "contains" | "exact";
export type DisplayMode = "grouped" | "individual";

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
  /** "grouped": matches deler reglens kommentar og vises som én post.
   * "individual": reglen sætter ikke kommentar på matches, så hver postering
   * vises for sig via sin rå tekst, indtil den evt. navngives manuelt. */
  displayMode: DisplayMode;
  /** Matches markeres automatisk som ekstraordinære og holdes dermed udenfor
   * opsparingsrate, prognose, kategori-trends og AI-rådgiver. */
  isExtraordinary: boolean;
};

export type MappableTransaction = {
  id: string;
  rawText: string;
  amount: number;
  comment: string | null;
  categoryId: string | null;
  mappingId: string | null;
};
