export function generateJsonReport(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}
