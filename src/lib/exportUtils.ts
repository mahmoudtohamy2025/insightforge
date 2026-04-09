/**
 * Export utilities for Insights page — CSV download and Markdown copy.
 */

interface PatternExport {
  title: string;
  description: string | null;
  sentiment: string;
  session_count: number;
  evidence_quotes: { quote: string; session_title: string }[];
}

interface SurveyQuestionExport {
  question_text: string;
  answers: string[];
}

// ── Helpers ──

export function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function triggerDownload(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob(["\uFEFF" + content], { type: mime }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── CSV Export ──

export function exportPatternsToCSV(patterns: PatternExport[], filename = "research-patterns.csv") {
  const headers = ["Title", "Description", "Sentiment", "Sessions", "Quotes"];
  const rows = patterns.map((p) => [
    escapeCsv(p.title),
    escapeCsv(p.description || ""),
    escapeCsv(p.sentiment),
    String(p.session_count),
    escapeCsv(
      (p.evidence_quotes || []).map((q) => `"${q.quote}" — ${q.session_title}`).join(" | ")
    ),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  triggerDownload(csv, filename);
}

export function exportSurveyBreakdownToCSV(
  questions: SurveyQuestionExport[],
  filename = "survey-results.csv"
) {
  const headers = ["Question", "Answer", "Count"];
  const rows: string[][] = [];
  questions.forEach((q) => {
    const counts: Record<string, number> = {};
    q.answers.forEach((a) => {
      counts[a] = (counts[a] || 0) + 1;
    });
    Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([answer, count]) => {
        rows.push([escapeCsv(q.question_text), escapeCsv(answer), String(count)]);
      });
  });
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  triggerDownload(csv, filename);
}

// ── Markdown Copy ──

export function patternsToMarkdown(patterns: PatternExport[], totalSessions: number): string {
  const lines: string[] = [
    "# Research Insights Report",
    "",
    `**Patterns Found:** ${patterns.length}  `,
    `**Sessions Analyzed:** ${totalSessions}  `,
    `**Generated:** ${new Date().toLocaleDateString()}`,
    "",
    "---",
    "",
  ];

  patterns.forEach((p, i) => {
    lines.push(`## ${i + 1}. ${p.title}`);
    lines.push("");
    if (p.description) {
      lines.push(p.description);
      lines.push("");
    }
    lines.push(`**Sentiment:** ${p.sentiment} · **Found in ${p.session_count} of ${totalSessions} sessions**`);
    lines.push("");
    if (p.evidence_quotes?.length) {
      lines.push("**Evidence:**");
      p.evidence_quotes.forEach((q) => {
        lines.push(`> "${q.quote}" — *${q.session_title}*`);
      });
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}
