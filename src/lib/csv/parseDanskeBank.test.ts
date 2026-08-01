import { describe, expect, it } from "vitest";
import { parseDanskeBankCsv, parseDanskeBankFile } from "./parseDanskeBank";

const SAMPLE_CSV = [
  `"Dato";"Tekst";"Beløb";"Saldo";"Status";"Afstemt"`,
  `"02.01.2026";"Det Faglige Hus";"-607,00";"11.050,35";"Udført";"Nej"`,
  `"02.01.2026";"Oister             NIXGG";"-99,00";"-186,91";"Udført";"Nej"`,
  `"09.01.2026";"Spotify P3E2F6BC7E\\ \\Stockh...";"-199,00";"12.819,09";"Udført";"Nej"`,
  `"26.01.2026";"FRA: 3552083466";"10.550,00";"22.896,67";"Udført";"Nej"`,
  `"17.06.2026";"Rest hussalg";"-217.000,00";"7.565,59";"Udført";"Nej"`,
].join("\r\n");

describe("parseDanskeBankCsv", () => {
  it("springer header-linjen over og parser resten af rækkerne", () => {
    const { rows, errors } = parseDanskeBankCsv(SAMPLE_CSV);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(5);
  });

  it("parser dato, tekst og beløb korrekt for en almindelig række", () => {
    const { rows } = parseDanskeBankCsv(SAMPLE_CSV);
    expect(rows[0]).toMatchObject({
      date: "2026-01-02",
      rawText: "Det Faglige Hus",
      amount: -607,
      balance: 11050.35,
      status: "Udført",
      reconciled: "Nej",
    });
  });

  it("bevarer backslashes og afkortede tekster uændret", () => {
    const { rows } = parseDanskeBankCsv(SAMPLE_CSV);
    const spotify = rows.find((r) => r.rawText.startsWith("Spotify"));
    expect(spotify?.rawText).toBe("Spotify P3E2F6BC7E\\ \\Stockh...");
  });

  it("parser store negative beløb (fx et hussalg)", () => {
    const { rows } = parseDanskeBankCsv(SAMPLE_CSV);
    const hussalg = rows.find((r) => r.rawText === "Rest hussalg");
    expect(hussalg?.amount).toBe(-217000);
  });

  it("giver hver række en row_hash til dublet-beskyttelse", () => {
    const { rows } = parseDanskeBankCsv(SAMPLE_CSV);
    const hashes = rows.map((r) => r.rowHash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("genererer samme row_hash hvis samme fil parses to gange (dublet-scenarie)", () => {
    const first = parseDanskeBankCsv(SAMPLE_CSV).rows;
    const second = parseDanskeBankCsv(SAMPLE_CSV).rows;
    expect(first.map((r) => r.rowHash)).toEqual(second.map((r) => r.rowHash));
  });

  it("rapporterer parse-fejl pr. række uden at stoppe hele parsingen", () => {
    const csvWithBadRow = [
      `"Dato";"Tekst";"Beløb";"Saldo";"Status";"Afstemt"`,
      `"02.01.2026";"Gyldig postering";"-100,00";"500,00";"Udført";"Nej"`,
      `"ikke-en-dato";"Ugyldig postering";"-100,00";"400,00";"Udført";"Nej"`,
    ].join("\r\n");

    const { rows, errors } = parseDanskeBankCsv(csvWithBadRow);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].rowNumber).toBe(3);
  });
});

describe("parseDanskeBankFile", () => {
  it("afkoder en windows-1252-kodet fil og parser i ét trin", () => {
    // "ø" = 0xF8 i windows-1252, hvilket er en ugyldig UTF-8-sekvens alene -
    // afkodning falder derfor tilbage til windows-1252 (se decode.test.ts).
    const row =
      '"26.01.2026";"2025-12 Vindst\xF8d VE";"14,58";"12.346,67";"Udf\xF8rt";"Nej"';
    const header = '"Dato";"Tekst";"Bel\xF8b";"Saldo";"Status";"Afstemt"';
    const bytes = [...`${header}\r\n${row}`].map((char) => char.charCodeAt(0));

    const result = parseDanskeBankFile(new Uint8Array(bytes).buffer);

    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].rawText).toBe("2025-12 Vindstød VE");
    expect(result.rows[0].status).toBe("Udført");
  });
});
