/**
 * Display helpers for the User object.
 *
 * The app previously fell back to `email.split('@')[0]` whenever a user
 * hadn't picked a @handle. That ends up showing things like "@mohammedawidan"
 * derived from "mohammedawidan@yahoo.com" — exposing PII and looking like
 * the user has a handle they didn't choose.
 *
 * The new contract:
 *   • `realHandle()`  — returns the user's chosen @handle, or null.
 *   • `displayName()` — returns the user's first name (or full name) for
 *                       greetings. Never falls back to email.
 *   • `displayHandle()` — returns `@username` if set, otherwise a localised
 *                       "Set @handle" call-to-action label the UI can
 *                       render as a Pressable to open the handle editor.
 */

import type { User } from '@/types';

export function realHandle(user?: Pick<User, 'username'> | null): string | null {
  const u = user?.username?.trim();
  return u && u.length > 0 ? u : null;
}

export function displayName(user?: Pick<User, 'firstName' | 'lastName'> | null, fallback = 'there'): string {
  const first = user?.firstName?.trim();
  const last  = user?.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first)         return first;
  return fallback;
}

/**
 * Header / chat / profile @handle line.
 * Returns either `@username` or a short CTA the screen can route to the
 * handle editor. NEVER returns an email-derived value.
 */
export function displayHandle(
  user?: Pick<User, 'username'> | null,
  setHandleLabel = 'Set @handle',
): string {
  const u = realHandle(user);
  return u ? `@${u}` : setHandleLabel;
}

/**
 * Is the value the user stored in `avatarUrl` actually a URL (vs a
 * single emoji char)? Used by the old code paths that overloaded
 * avatarUrl to hold an emoji. New code should read `avatarEmoji`
 * directly.
 */
export function looksLikeUrl(v?: string | null): boolean {
  if (!v) return false;
  return /^https?:\/\//i.test(v) || v.startsWith('/') || v.includes('://');
}

/**
 * Does the string actually contain emoji characters?
 *
 * The old check was a length cap (`<= 8`), which let any short ASCII
 * string — like the local-part of an email — get rendered as if it
 * were an emoji. The avatar circle would literally show the text
 * "moham" (from mohammedawidan@yahoo.com) instead of an initial.
 *
 * Real emoji are encoded in the Astral planes (U+1F300+) or in the
 * dedicated Symbol/Pictograph blocks (U+2600–U+27BF, U+2300–U+23FF,
 * etc.). Anything that's all printable ASCII is text, not an emoji,
 * regardless of length. We also reject anything longer than 4 visible
 * units (1 emoji + ZWJ sequence is the practical max).
 */
function looksLikeEmoji(s: string): boolean {
  if (!s) return false;
  // Strip variation selectors and ZWJ so an emoji ZWJ-sequence counts
  // as one visual unit, not many. U+FE0E / U+FE0F are variation
  // selectors, U+200D is the zero-width joiner used between glyphs in
  // composite emoji like the family / profession sequences.
  const stripped = s.replace(/[\uFE0E\uFE0F\u200D]/g, '');
  if (stripped.length === 0) return false;
  if (stripped.length > 4)   return false;
  // If every code point is in the printable ASCII range, it's text.
  // (Emoji always live outside U+0020–U+007E.)
  for (const codePointStr of stripped) {
    const cp = codePointStr.codePointAt(0)!;
    if (cp < 0x20 || cp > 0x7E) return true; // found a non-ASCII glyph
  }
  return false;
}

/**
 * Pick the right avatar mode for the inline header tile.
 * Returns one of:
 *   { kind: 'image', uri: string }       — render Image
 *   { kind: 'emoji', char: string }      — render Text with the emoji
 *   { kind: 'initials', char: string }   — fall back to capital initial
 *
 * Defensive ordering: we check for a URL first, then an explicit
 * `avatarEmoji` field, then the legacy `avatarUrl-holds-an-emoji`
 * pattern — but ONLY when the value actually contains emoji glyphs.
 * Plain ASCII (someone's email local-part snuck in somewhere) always
 * falls through to initials.
 */
export function avatarMode(user?: Pick<User, 'firstName' | 'username' | 'avatarUrl' | 'avatarEmoji'> | null) {
  const url = user?.avatarUrl?.trim();
  if (url && looksLikeUrl(url)) return { kind: 'image' as const, uri: url };

  // Prefer the explicit avatarEmoji field; otherwise fall back to the
  // legacy "avatarUrl might be an emoji" path — but ONLY if it actually
  // looks like an emoji, not just a short string.
  const candidate = (user?.avatarEmoji ?? (url && !looksLikeUrl(url) ? url : ''))?.trim();
  if (candidate && looksLikeEmoji(candidate)) {
    return { kind: 'emoji' as const, char: candidate };
  }

  const seed = (user?.firstName?.[0] ?? user?.username?.[0] ?? '?').toUpperCase();
  return { kind: 'initials' as const, char: seed };
}
