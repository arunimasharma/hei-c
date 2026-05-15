/**
 * The generation prompt produces a doc with the structure:
 *   <hypothesis framing sections>
 *   ---
 *   # Claude Code Build Prompt
 *   <paste-ready agent prompt>
 *
 * Split on the first horizontal-rule line. If we can't find one we return
 * null for both halves so the caller can fall back to the full text. Used by
 * both the builder's session page and the public /b/:slug page.
 */

export function splitOnHorizontalRule(doc: string): {
  hypothesisDoc: string | null;
  buildPromptDoc: string | null;
} {
  const lines = doc.replace(/\r\n/g, '\n').split('\n');
  const ruleIdx = lines.findIndex(l => /^\s*-{3,}\s*$/.test(l));
  if (ruleIdx < 0) return { hypothesisDoc: null, buildPromptDoc: null };

  const above = lines.slice(0, ruleIdx).join('\n').trim();
  const below = lines.slice(ruleIdx + 1).join('\n').trim();
  if (!above || !below) return { hypothesisDoc: null, buildPromptDoc: null };
  return { hypothesisDoc: above, buildPromptDoc: below };
}
