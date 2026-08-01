import Anthropic from "@anthropic-ai/sdk";
import { formatMonthDa } from "@/lib/format";
import type { MonthlySavings } from "@/lib/forecast/computeSavingsRate";
import type { ForecastMonth } from "@/lib/forecast/computeExpenseForecast";
import type { CategoryTrend } from "@/lib/forecast/computeCategoryTrends";

export const ADVISOR_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

export async function generateAdvice(input: {
  currentBalance: number | null;
  savings: MonthlySavings[];
  forecast: ForecastMonth[];
  trends: CategoryTrend[];
}): Promise<string> {
  const client = new Anthropic();

  const summary = {
    nuvaerende_saldo:
      input.currentBalance !== null ? Math.round(input.currentBalance) : "ukendt",
    seneste_maaneder: input.savings.map((s) => ({
      maaned: formatMonthDa(s.monthKey),
      indtaegt: Math.round(s.income),
      udgifter: Math.round(Math.abs(s.expenses)),
      resultat: Math.round(s.result),
      opsparing: Math.round(s.savings),
    })),
    prognose_kommende_maaneder: input.forecast.map((f) => ({
      maaned: formatMonthDa(f.monthKey),
      forventet_indbetaling: Math.round(f.recurringIncome),
      forventede_faste_udgifter: Math.round(f.recurringTotal),
      forventede_ovrige_udgifter: Math.round(f.averageUnmappedTotal),
      forventet_total_udgift: Math.round(f.projectedTotal),
      forventet_nettoresultat: Math.round(f.projectedNetResult),
    })),
    kategori_trends: input.trends
      .filter((t) => t.direction !== "stable")
      .slice(0, 5)
      .map((t) => ({
        kategori: t.categoryName,
        aendring_procent: t.percentChange,
        retning: t.direction === "increasing" ? "stigende" : "faldende",
      })),
  };

  // `effort` er kun understøttet af nyere modeller (fx claude-opus-5) - ikke
  // af claude-haiku-4-5, som appen også kan konfigureres til via
  // ANTHROPIC_MODEL. Udelades derfor i stedet for at fejle på ældre modeller.
  const supportsEffort = !ADVISOR_MODEL.includes("haiku");

  const response = await client.messages.create({
    model: ADVISOR_MODEL,
    max_tokens: 1024,
    ...(supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
    system:
      "Du er en budgetrådgiver for en dansk husstand. Du får strukturerede tal fra husstandens eget budget-app og skal give 2-4 korte, konkrete anbefalinger på dansk. " +
      "Brug KUN de tal du får - opfind aldrig tal, og lav aldrig antagelser om ting der ikke fremgår af dataen. " +
      "Fokusér på: om opsparingen (kolonnen 'opsparing') ser tilstrækkelig ud i forhold til resultatet, om nogen udgiftskategorier vokser bekymrende, og hvad prognosen for de kommende måneder betyder for husstandens økonomi. " +
      "'forventet_nettoresultat' pr. måned i prognosen er allerede beregnet som forventet indbetaling minus forventede udgifter - brug DEN til at vurdere om saldoen vokser eller svinder, fremfor selv at regne det ud fra andre tal. " +
      "Bemærk at 'forventede_faste_udgifter' KAN variere fra måned til måned, fordi nogle poster kun forfalder kvartalsvist eller halvårligt (fx bilafgift) - det er ikke en fejl, en enkelt måned kan derfor ramme markant hårdere end de andre. " +
      "Inddrag 'nuvaerende_saldo' som kontekst: hvis flere måneder har negativt nettoresultat, kan du lægge dem sammen ud fra de faktiske tal for at vurdere hvornår bufferen er brugt op - men brug kun de tal du har fået, opfind aldrig et præcist fremtidigt tal du ikke kan udlede direkte. " +
      "Dette er budgetrådgivning baseret på husstandens egne tal - ikke investeringsrådgivning. " +
      "Skriv som en kort punktliste, konkret og uden fyld. Ingen indledning, ingen afslutning, ingen overskrifter. " +
      "Ren tekst uden markdown-formatering - ingen ** for fed skrift eller andre markdown-tegn.",
    messages: [
      {
        role: "user",
        content: `Her er husstandens budgetdata:\n\n${JSON.stringify(summary, null, 2)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude afviste anmodningen.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("Intet tekstsvar fra Claude.");
  }

  return textBlock.text.trim();
}
