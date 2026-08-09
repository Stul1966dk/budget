import Anthropic from "@anthropic-ai/sdk";
import { formatMonthDa } from "@/lib/format";
import { ADVISOR_MODEL } from "./generateAdvice";
import type { BudgetSnapshot } from "./buildBudgetSnapshot";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Løbende samtale med rådgiveren, oven på det samme talgrundlag som den
 * korte anbefaling - men med fuld kategori/måned-detalje og seneste
 * bemærkninger, så "hvorfor"-spørgsmål kan besvares konkret i stedet for med
 * kun en månedstotal.
 */
export async function chatWithAdvisor(
  snapshot: BudgetSnapshot,
  history: ChatMessage[],
): Promise<string> {
  const client = new Anthropic();

  const summary = {
    nuvaerende_saldo:
      snapshot.currentBalance !== null ? Math.round(snapshot.currentBalance) : "ukendt",
    manuel_indbetaling_override: snapshot.incomeOverride,
    seneste_maaneder: snapshot.savings.map((s) => ({
      maaned: formatMonthDa(s.monthKey),
      indtaegt: Math.round(s.income),
      udgifter: Math.round(Math.abs(s.expenses)),
      resultat: Math.round(s.result),
      opsparing: Math.round(s.savings),
    })),
    prognose_kommende_maaneder: snapshot.forecast.map((f, i) => ({
      maaned: formatMonthDa(f.monthKey),
      forventet_indbetaling: Math.round(f.recurringIncome),
      forventede_faste_udgifter: Math.round(f.recurringTotal),
      forventede_ovrige_udgifter: Math.round(f.averageUnmappedTotal),
      forventet_total_udgift: Math.round(f.projectedTotal),
      forventet_nettoresultat: Math.round(f.projectedNetResult),
      forventet_saldo_ved_maanedens_slutning: Math.round(snapshot.projectedBalances[i]),
    })),
    kategori_pr_maaned: snapshot.trends.map((t) => ({
      kategori: t.categoryName,
      pr_maaned: t.monthlyTotals.map((m) => ({
        maaned: formatMonthDa(m.monthKey),
        beloeb: Math.round(m.total),
      })),
      aendring_procent_seneste_periode: t.percentChange,
      retning: t.direction === "increasing" ? "stigende" : t.direction === "decreasing" ? "faldende" : "stabil",
    })),
    seneste_bemaerkninger: snapshot.recentAlertMessages,
  };

  const supportsEffort = !ADVISOR_MODEL.includes("haiku");

  const baseSystemPrompt =
    "Du er en budget-sparringspartner for en dansk husstand, i en løbende samtale - ikke en engangsrapport. Du får strukturerede tal fra husstandens eget budget-app. " +
    "Brug KUN de tal du får - opfind aldrig tal, og lav aldrig antagelser om ting der ikke fremgår af dataen. " +
    "'kategori_pr_maaned' viser hvert kategoris faktiske beløb måned for måned - brug den til at forklare konkret HVORFOR en given måned var dyrere eller billigere end normalt, fremfor at gætte. " +
    "'forventet_saldo_ved_maanedens_slutning' er allerede beregnet som nuværende saldo plus det akkumulerede forventede nettoresultat måned for måned - brug DEN direkte til at svare på spørgsmål om hvornår/om saldoen bliver negativ, fremfor selv at lægge tal sammen på tværs af måneder. " +
    "'seneste_bemaerkninger' er konkrete observationer appen allerede har fundet (prisstigninger, usædvanlige beløb, manglende poster) - brug dem som grundlag når de er relevante for spørgsmålet. " +
    "Ekstraordinære engangsposter (fx hussalg, store udlæg, éngangsoverførsler) er allerede fjernet fra alle tallene - et negativt resultat er derfor det reelle billede EKSKLUSIVE den slags, ikke udlignet af noget udenfor dataen. " +
    "Hvis et spørgsmål kræver data du ikke har fået (fx en bestemt enkelt-postering, eller perioder udenfor tallene ovenfor), så sig det tydeligt i stedet for at gætte eller opfinde et svar. " +
    "Når det er relevant, kan du pege på konkrete steder i appen - fx at 'Forventet månedlig indbetaling' kan justeres manuelt under Rådgiver-siden, hvis I overvejer at ændre det budgetterede beløb. " +
    "Dette er budgetrådgivning ud fra husstandens egne tal - ikke investeringsrådgivning. " +
    "Svar kort og konkret som i en samtale, ikke som en rapport - typisk et par sætninger, medmindre spørgsmålet kræver en punktliste. " +
    "Ren tekst uden markdown-formatering - ingen ** for fed skrift eller andre markdown-tegn.";

  const system = snapshot.advisorNotes?.trim()
    ? `${baseSystemPrompt}\n\nHusstanden har selv tilføjet denne faste kontekst/instruks - tag højde for den: ${snapshot.advisorNotes.trim()}\n\nHusstandens tal:\n${JSON.stringify(summary, null, 2)}`
    : `${baseSystemPrompt}\n\nHusstandens tal:\n${JSON.stringify(summary, null, 2)}`;

  const response = await client.messages.create({
    model: ADVISOR_MODEL,
    max_tokens: 1024,
    ...(supportsEffort ? { output_config: { effort: "medium" as const } } : {}),
    system,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
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
