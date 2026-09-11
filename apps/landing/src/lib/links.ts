/**
 * Central place for every external/cross-app link this site points to --
 * so a URL only ever needs updating in one place, and so it's obvious which
 * links are real today versus placeholders for something not deployed yet.
 */

/** The actual public repository -- confirmed from the monorepo's own git remote. */
export const GITHUB_URL = "https://github.com/psatomas/ExeKPro";

/**
 * The protocol console (apps/frontend), deployed as its own Cloudflare
 * Worker at the root of exekpro.com -- this site (apps/landing) is the
 * "/about" surface of that same domain. See the repo root CLAUDE.md's URL
 * architecture section.
 */
export const CONSOLE_URL = "https://exekpro.com/";

/** Points at the root README, which documents the architecture in full. */
export const DOCS_URL = `${GITHUB_URL}#readme`;
