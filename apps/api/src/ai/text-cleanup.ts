/** Small models sometimes slip a letter from another script into Arabic text; keep Arabic, Latin and shared marks only. */
export function stripForeignScripts(text: string): string {
  return text.replace(/[^\p{Script=Arabic}\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/gu, '').replace(/ {2,}/g, ' ');
}
