/**
 * URL parsing and Pinia state utilities for XHS
 */

/** Unwrap Pinia/ Vue reactive object (which wraps data in ._value or .value) */
export function unwrap<T>(obj: any): T {
  if (obj && typeof obj === 'object') {
    if (obj._value !== undefined) return obj._value as T;
    if (obj.value !== undefined) return obj.value as T;
  }
  return obj as T;
}

export interface ParsedNoteInput {
  noteId: string;
  xsecToken?: string;
}

/** Extract noteId and xsec_token from various URL formats */
export function parseNoteInput(input: string): ParsedNoteInput {
  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();

    if (!hostname.includes('xiaohongshu')) {
      return { noteId: trimmed };
    }

    const pathname = url.pathname;

    // /explore/{noteId} or /discovery/item/{noteId}
    const exploreMatch = pathname.match(/\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/);
    if (exploreMatch) {
      return {
        noteId: exploreMatch[1],
        xsecToken: url.searchParams.get('xsec_token') || undefined,
      };
    }

    // /search_result?noteId=...&xsec_token=...
    if (pathname.includes('search_result')) {
      const noteId = url.searchParams.get('noteId') || url.searchParams.get('note_id') || '';
      const xsecToken = url.searchParams.get('xsec_token') || '';
      if (noteId) {
        return { noteId, xsecToken: xsecToken || undefined };
      }
    }

    // /user/profile/{userId}/{noteId}
    const profileMatch = pathname.match(/\/user\/profile\/[^\/]+\/([a-zA-Z0-9]+)/);
    if (profileMatch) {
      return { noteId: profileMatch[1] };
    }

    // Fallback: last path segment as noteId
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /^[a-zA-Z0-9]+$/.test(last)) {
      return {
        noteId: last,
        xsecToken: url.searchParams.get('xsec_token') || undefined,
      };
    }
  } catch {
    // Not a URL, treat as plain note ID
  }

  return { noteId: trimmed };
}

/** Extract userId from profile URL */
export function parseUserInput(input: string): string {
  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();

    if (!hostname.includes('xiaohongshu')) {
      return trimmed;
    }

    const pathname = url.pathname;

    // /user/profile/{userId}
    const profileMatch = pathname.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
    if (profileMatch) {
      return profileMatch[1];
    }
  } catch {
    // Not a URL, treat as plain user ID
  }

  return trimmed;
}
