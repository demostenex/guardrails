export function mutationMarkdownLines(mutation) {
  if (!mutation || mutation.status === "disabled") {
    return [];
  }

  const lines = ["## Mutação", ""];

  if (mutation.status === "missing") {
    return [...lines, `Sem dados de mutação (arquivo não encontrado: ${mutation.summaryPath}).`, ""];
  }

  if (mutation.status === "invalid") {
    return [...lines, `Resumo de mutação ilegível: ${mutation.error}`, ""];
  }

  lines.push(
    `- Recorte: ${mutation.scopeNote || "não informado"}`,
    `- MSI: ${mutation.msi}%${mutation.coveredMsi === null ? "" : ` (coberto: ${mutation.coveredMsi}%)`}`,
    `- Mutantes: ${mutation.mutantsTotal} (mortos ${mutation.killed}, timeouts ${mutation.timedOut}, erros ${mutation.errors}, não cobertos ${mutation.notCovered})`,
    `- Sobreviventes: ${mutation.survivors}`,
    `- Arquivo gerado em: ${mutation.fileModifiedAt}`
  );

  for (const warning of mutation.warnings ?? []) {
    lines.push(`- Aviso: ${warning}`);
  }

  return [...lines, ""];
}

export function mutationMaturityLine(mutation) {
  if (mutation?.status !== "ok") {
    return "Mutation: sem dados de mutação";
  }

  const scope = mutation.scopeNote ? ` [recorte: ${mutation.scopeNote}]` : "";
  return `Mutation: MSI ${mutation.msi}%, ${mutation.survivors} sobrevivente(s)${scope}`;
}
