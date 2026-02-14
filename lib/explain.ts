import { ActionCard, RiskScore, SpreadResult } from "./types";

/**
 * Build a human-readable explanation of the model inputs and decision.
 */
export function explainDecision(
  card: ActionCard,
  riskScore: RiskScore,
  spreadExplain: SpreadResult["explain"]
): string[] {
  const lines: string[] = [];

  lines.push(`--- ${card.type.toUpperCase()}: ${card.title} ---`);
  lines.push(`Confidence: ${card.confidence}`);
  lines.push(`Timing: ${card.timing}`);
  lines.push("");
  lines.push("Why:");
  card.why.forEach((w, i) => lines.push(`  ${i + 1}. ${w}`));
  lines.push("");
  lines.push(`Risk Score: ${riskScore.total}/100 (${riskScore.label})`);
  lines.push(
    `  Wind: ${riskScore.breakdown.windSeverity}/100 | Humidity: ${riskScore.breakdown.humiditySeverity}/100 | Time-to-Impact: ${riskScore.breakdown.timeToImpactSeverity}/100`
  );
  lines.push("");
  lines.push(`Model: ${spreadExplain.model}`);
  lines.push(`Spread Rate: ${spreadExplain.rateKmH.toFixed(2)} km/h`);
  spreadExplain.notes.forEach((n) => lines.push(`  • ${n}`));

  return lines;
}

/**
 * Generate a markdown incident brief.
 */
export function generateBriefMarkdown(
  incidentName: string,
  oneLiner: string,
  keyTriggers: string[],
  cards: ActionCard[],
  riskScore: RiskScore,
  spreadExplain: SpreadResult["explain"]
): string {
  const now = new Date().toISOString();
  let md = `# Incident Brief: ${incidentName}\n\n`;
  md += `**Generated:** ${now}\n\n`;
  md += `## Summary\n\n${oneLiner}\n\n`;

  md += `## Risk Score: ${riskScore.total}/100 (${riskScore.label.toUpperCase()})\n\n`;
  md += `| Factor | Score |\n|---|---|\n`;
  md += `| Wind Severity | ${riskScore.breakdown.windSeverity}/100 |\n`;
  md += `| Humidity Severity | ${riskScore.breakdown.humiditySeverity}/100 |\n`;
  md += `| Time-to-Impact | ${riskScore.breakdown.timeToImpactSeverity}/100 |\n\n`;

  md += `## Key Triggers\n\n`;
  keyTriggers.forEach((t) => (md += `- ${t}\n`));
  md += "\n";

  md += `## Action Cards\n\n`;
  cards.forEach((card) => {
    md += `### ${card.type.charAt(0).toUpperCase() + card.type.slice(1)}: ${card.title}\n\n`;
    md += `**Timing:** ${card.timing} | **Confidence:** ${card.confidence}\n\n`;
    md += `**Why:**\n`;
    card.why.forEach((w) => (md += `- ${w}\n`));
    md += `\n**Actions:**\n`;
    card.actions.forEach((a) => (md += `- ${a}\n`));
    md += "\n";
  });

  md += `## Model Details\n\n`;
  md += `- Model: ${spreadExplain.model}\n`;
  md += `- Spread Rate: ${spreadExplain.rateKmH.toFixed(2)} km/h\n`;
  spreadExplain.notes.forEach((n) => (md += `- ${n}\n`));

  return md;
}
