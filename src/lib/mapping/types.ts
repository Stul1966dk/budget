export type MatchType = "prefix" | "contains" | "exact";

export type MappingRule = {
  id: string;
  matchPattern: string;
  matchType: MatchType;
  comment: string | null;
  categoryId: string | null;
};

export type MappableTransaction = {
  id: string;
  rawText: string;
  comment: string | null;
  categoryId: string | null;
  mappingId: string | null;
};
