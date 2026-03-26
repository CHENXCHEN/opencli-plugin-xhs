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
 * Post a comment via DOM interaction
 */
export async function postComment(
  page: any,
  noteId: string,
  content: string,
  xsecToken: string,
  targetCommentId?: string,
): Promise<any> {
  return await page.evaluate(async ({ content, targetCommentId }) => {
    try {
      if (targetCommentId) {
        const commentEl = document.querySelector(`[id="comment-${targetCommentId}"], [data-comment-id="${targetCommentId}"]`);
        if (commentEl) {
          const replyBtn = commentEl.querySelector('.reply-btn, [class*="reply"]');
          if (replyBtn) {
            (replyBtn as HTMLElement).click();
          }
        }
      }

      const inputArea = document.querySelector('p.content-input');
      if (inputArea) {
        inputArea.focus();
        document.execCommand('selectAll', false);
        document.execCommand('insertText', false, content);
        inputArea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const submitBtn = document.querySelector('button.submit');
      if (submitBtn) {
        (submitBtn as HTMLElement).click();
        return { code: 0, success: true };
      }

      return { code: -1, success: false, error: 'Submit button not found' };
    } catch (e) {
      return { code: -1, success: false, error: String(e) };
    }
  }, { content, targetCommentId });
}

/**
 * Like a note via DOM click
 */
export async function likeNote(
  page: any,
  noteId: string,
  xsecToken: string,
  like: boolean = true,
): Promise<any> {
  return await page.evaluate(async ({ noteId, like }) => {
    try {
      const likeBtn = document.querySelector('.interact-container .left .like-lottie, .interactions .like-btn, [class*="like"]');
      if (likeBtn) {
        (likeBtn as HTMLElement).click();
        return { success: true, action: like ? 'liked' : 'unliked' };
      }
      return { success: false, error: 'Like button not found' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, { noteId, like });
}

/**
 * Collect (favorite) a note via DOM click
 */
export async function collectNote(
  page: any,
  noteId: string,
  xsecToken: string,
  collect: boolean = true,
): Promise<any> {
  return await page.evaluate(async ({ noteId, collect }) => {
    try {
      const collectBtn = document.querySelector('.interact-container .left .reds-icon.collect-icon, .interactions .collect-btn, [class*="collect"]');
      if (collectBtn) {
        (collectBtn as HTMLElement).click();
        return { success: true, action: collect ? 'collected' : 'uncollected' };
      }
      return { success: false, error: 'Collect button not found' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, { noteId, collect });
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
