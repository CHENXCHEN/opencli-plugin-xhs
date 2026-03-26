/**
 * API client utilities for XHS
 */

export const API_BASE = 'https://edith.xiaohongshu.com/api/sns/web/v1';
export const API_BASE_V2 = 'https://edith.xiaohongshu.com/api/sns/web/v2';

/**
 * Fetch comments for a note
 */
export async function fetchComments(
  page: any,
  noteId: string,
  xsecToken: string,
  num: number = 20,
): Promise<any[]> {
  const apiUrl =
    `${API_BASE_V2}/comment/page` +
    `?note_id=${encodeURIComponent(noteId)}` +
    `&cursor=` +
    `&top_comment_id=` +
    `&image_formats=jpg,webp,avif` +
    `&xsec_token=${encodeURIComponent(xsecToken)}`;

  try {
    const data = await page.evaluate(`
      (async () => {
        try {
          const resp = await fetch(${JSON.stringify(apiUrl)}, { credentials: 'include' });
          if (!resp.ok) return null;
          const json = await resp.json();
          return json.data || null;
        } catch { return null; }
      })()
    `);

    if (data && Array.isArray(data.comments)) {
      return data.comments.slice(0, num);
    }
  } catch {}
  return [];
}

/**
 * Post a comment via API
 */
export async function postComment(
  page: any,
  noteId: string,
  content: string,
  xsecToken: string,
  targetCommentId?: string,
): Promise<any> {
  const apiUrl = `${API_BASE}/comment/post`;

  const body: Record<string, any> = {
    note_id: noteId,
    content: content,
    image_formats: 'jpg,webp,avif',
  };

  if (targetCommentId) {
    body.target_comment_id = targetCommentId;
  }

  const result = await page.evaluate(async ({ apiUrl, body, xsecToken }) => {
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-s:token': xsecToken,
          'x-s:version': '1.0',
          'Referer': `https://www.xiaohongshu.com/explore/${body.note_id}`,
        },
        body: JSON.stringify(body),
      });
      return await resp.json();
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, { apiUrl, body, xsecToken });

  return result;
}

/**
 * Like a note via API
 */
export async function likeNote(
  page: any,
  noteId: string,
  xsecToken: string,
  like: boolean = true,
): Promise<any> {
  const apiUrl = `${API_BASE}/like`;

  const result = await page.evaluate(async ({ apiUrl, noteId, like, xsecToken }) => {
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-s:token': xsecToken,
          'x-s:version': '1.0',
          'Referer': `https://www.xiaohongshu.com/explore/${noteId}`,
        },
        body: JSON.stringify({ note_id: noteId, action: like ? 'like' : 'unlike' }),
      });
      return await resp.json();
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, { apiUrl, noteId, like, xsecToken });

  return result;
}

/**
 * Collect (favorite) a note via API
 */
export async function collectNote(
  page: any,
  noteId: string,
  xsecToken: string,
  collect: boolean = true,
): Promise<any> {
  const apiUrl = `${API_BASE}/collect`;

  const result = await page.evaluate(async ({ apiUrl, noteId, collect, xsecToken }) => {
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-s:token': xsecToken,
          'x-s:version': '1.0',
          'Referer': `https://www.xiaohongshu.com/explore/${noteId}`,
        },
        body: JSON.stringify({ note_id: noteId, action: collect ? 'collect' : 'uncollect' }),
      });
      return await resp.json();
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, { apiUrl, noteId, collect, xsecToken });

  return result;
}

/**
 * Read note data from Pinia store on the page
 */
export async function readNoteFromStore(page: any): Promise<any> {
  return await page.evaluate(`
    (() => {
      const unwrap = (obj) => {
        if (obj && typeof obj === 'object') {
          if (obj._value !== undefined) return obj._value;
          if (obj.value !== undefined) return obj.value;
        }
        return obj;
      };

      const state = window.__INITIAL_STATE__;
      if (!state) return null;
      const noteMap = state.note?.noteDetailMap;
      if (noteMap && typeof noteMap === 'object') {
        const keys = Object.keys(noteMap);
        if (keys.length > 0) {
          const note = unwrap(window.__INITIAL_STATE__.note.noteDetailMap[keys[0]]);
          if (note?.note) {
            note.note = unwrap(note.note);
          }
          return note;
        }
      }
      return null;
    })()
  `);
}
