/**
 * XHS note detail — read a note's full content.
 *
 * Usage:
 *   opencli xhs note <note-id-or-url>
 *
 * Accepts:
 *   - Full URL from search results (contains xsec_token)
 *   - /explore/{noteId} URL
 *   - Plain note ID
 */

import { cli, Strategy } from '@jackwener/opencli/registry';

type NoteRow = {
  type: string;
  author: string;
  content: string;
  likes: string;
};

/** Extract noteId and xsec_token from various URL formats */
function parseNoteInput(input: string): { noteId: string; xsecToken?: string } {
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

/** Read note data from Pinia store on the page */
async function readNoteFromStore(page: any): Promise<any> {
  return await page.evaluate(`
    (() => {
      const state = window.__INITIAL_STATE__;
      if (!state) return null;
      const noteMap = state.note?.noteDetailMap;
      if (noteMap && typeof noteMap === 'object') {
        const keys = Object.keys(noteMap);
        if (keys.length > 0) return window.__INITIAL_STATE__.note.noteDetailMap[keys[0]];
      }
      return null;
    })()
  `);
}

/** Fetch comments via the comment API */
async function fetchComments(
  page: any,
  noteId: string,
  xsecToken: string,
  num: number = 20,
): Promise<any[]> {
  const apiUrl =
    `https://edith.xiaohongshu.com/api/sns/web/v2/comment/page` +
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

cli({
  site: 'xhs',
  name: 'note',
  description: 'Read an XHS note: body, author, images, tags, likes/collects/comments, top 20 comments',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    {
      name: 'note-id',
      positional: true,
      required: true,
      help: 'Note ID or full URL from search results (with xsec_token)',
    },
    {
      name: 'comments',
      type: 'int',
      default: 20,
      help: 'Number of top comments to fetch (default 20)',
    },
  ],
  columns: ['type', 'author', 'content', 'likes'],
  func: async (page, kwargs) => {
    const input = kwargs['note-id'];
    const numComments = Math.max(1, Math.min(100, Number(kwargs.comments ?? 20)));

    const { noteId, xsecToken } = parseNoteInput(input);
    if (!noteId) {
      throw new Error('Invalid note ID or URL: ' + input);
    }

    const navigateUrl = xsecToken
      ? `https://www.xiaohongshu.com/explore/${noteId}?xsec_token=${encodeURIComponent(xsecToken)}`
      : `https://www.xiaohongshu.com/explore/${noteId}`;

    await page.goto(navigateUrl);
    await page.wait(3);
    await page.autoScroll({ times: 2 });

    // Read from Pinia store
    let noteData = await readNoteFromStore(page);

    // Fallback to DOM extraction
    if (!noteData) {
      noteData = await page.evaluate(`
        (() => {
          const norm = (v) => (v || '').trim().replace(/\\s+/g, ' ');
          const getText = (sel) => norm(document.querySelector(sel)?.textContent);
          const getAllSrc = (sel) =>
            [...document.querySelectorAll(sel)]
              .map(el => el.src || el.getAttribute('data-src'))
              .filter(src => src && (src.includes('xhscdn') || src.includes('xiaohongshu')))
              .map(src => src.split('?')[0]);

          const desc = getText('#detail-desc, .note-content, .desc');
          const author = getText('.username, .author-name, .name');
          const images = getAllSrc('.swiper-slide img, .note-content img, .carousel-image img');
          const tags = [...document.querySelectorAll('.tag, .topic')]
            .map(el => el.textContent?.trim())
            .filter(t => t && !t.startsWith('#'));

          return {
            note: { desc, tagList: tags },
            user: { nickname: author },
            imageList: images.map(url => ({ urlOriginal: url })),
          };
        })()
      `);
    }

    const rows: NoteRow[] = [];

    // Note body row
    const desc = noteData?.note?.desc || noteData?.note?.content || '';
    const author = noteData?.user?.nickname || noteData?.author || '';
    const interactInfo = noteData?.interactInfo || noteData?.note?.interactInfo || {};

    rows.push({
      type: 'note',
      author,
      content: desc,
      likes: String(interactInfo?.liked_count || interactInfo?.['likedCount'] || ''),
    });

    // Image rows
    const imageList: any[] = noteData?.imageList || [];
    for (const img of imageList) {
      const url = img?.urlOriginal || img?.url || img?.src || '';
      if (url) {
        rows.push({ type: 'image', author: '-', content: url, likes: '' });
      }
    }

    // Video row
    const videoUrl =
      noteData?.video?.masterUrl ||
      noteData?.video?.url ||
      noteData?.video?.urlOriginal ||
      '';
    if (videoUrl) {
      rows.push({ type: 'video', author: '-', content: videoUrl, likes: '' });
    }

    // Tag rows
    const tagList: any[] = noteData?.tagList || noteData?.note?.tagList || [];
    for (const tag of tagList) {
      const name = tag?.name || tag?.tag || '';
      if (name) {
        rows.push({ type: 'tag', author: '-', content: name, likes: '' });
      }
    }

    // Stats row
    const likes = interactInfo?.liked_count || interactInfo?.['likedCount'] || '';
    const collects = interactInfo?.collected_count || interactInfo?.collectedCount || '';
    const comments = interactInfo?.comment_count || interactInfo?.commentCount || '';
    if (likes || collects || comments) {
      rows.push({
        type: 'stats',
        author: '-',
        content: `likes=${likes} collects=${collects} comments=${comments}`,
        likes: '',
      });
    }

    // Comment rows
    if (xsecToken) {
      const commentsData = await fetchComments(page, noteId, xsecToken, numComments);
      for (const comment of commentsData) {
        const commentAuthor = comment.user?.nickname || comment.author || '[deleted]';
        const commentContent = comment.content || comment.text || '';
        const commentLikes = String(comment.liked_count || comment.likeCount || 0);
        rows.push({
          type: 'comment',
          author: commentAuthor,
          content: commentContent,
          likes: commentLikes,
        });
      }
    } else {
      rows.push({
        type: 'comment',
        author: '-',
        content: '(xsec_token required for comments)',
        likes: '',
      });
    }

    return rows;
  },
});
