import { describe, expect, it } from "vitest";
import { decodeCsvBuffer } from "./decode";

function toArrayBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("decodeCsvBuffer", () => {
  it("afkoder windows-1252-bytes med danske specialtegn korrekt", () => {
    // "Vindstød" i windows-1252: 'ø' = 0xF8
    const bytes = [0x56, 0x69, 0x6e, 0x64, 0x73, 0x74, 0xf8, 0x64];
    expect(decodeCsvBuffer(toArrayBuffer(bytes))).toBe("Vindstød");
  });

  it("afkoder 'Beløb' korrekt fra windows-1252", () => {
    // 'B','e','l','ø'(0xF8),'b'
    const bytes = [0x42, 0x65, 0x6c, 0xf8, 0x62];
    expect(decodeCsvBuffer(toArrayBuffer(bytes))).toBe("Beløb");
  });

  it("afkoder gyldig UTF-8-tekst uændret", () => {
    const text = "Almindelig tekst uden specialtegn";
    const buffer = new TextEncoder().encode(text).buffer;
    expect(decodeCsvBuffer(buffer)).toBe(text);
  });
});
