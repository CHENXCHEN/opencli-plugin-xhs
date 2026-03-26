/**
 * XHS feed commands
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import type { Row } from './auth';
import { parseNoteInput } from './url-parser';
import { readNoteFromStore, fetchComments } from './api-client.js';

const unwrap = <T>(obj: any): T => {
  if (obj && typeof obj === 'object') {
    if (obj._value !== undefined) return obj._value as T;
    if (obj.value !== undefined) return obj.value as T;
  }
  return obj as T;
};

cli({
  site: 'xhs',
  name: 'feeds',
  description: 'Get XHS home feed (recommended content)',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'category', type: 'string', default: '', help: 'Category filter (e.g. fashion, food, travel)' },
    { name: 'limit', type: 'int', default: 20, help: 'Number of results (default 20)' },
  ],
  columns: ['noteId', 'xsecToken', 'type', 'author', 'desc', 'likes', 'collects', 'comments', 'time'],
  func: async (page, kwargs) => {
    const category = kwargs.category || '';
    const limit = Math.min(100, Math.max(1, Number(kwargs.limit ?? 20)));

    const url = category
      ? `https://www.xiaohongshu.com/?category=${category}`
      : 'https://www.xiaohongshu.com/explore';

    await page.goto(url);
    await page.wait(3);
    await page.autoScroll({ times: 3 });
    await page.wait(2);

    const feeds = await page.evaluate(`
      (() => {
        const getFeeds = () => {
          if (window.__INITIAL_STATE__ &&
              window.__INITIAL_STATE__.feed &&
              window.__INITIAL_STATE__.feed.feeds) {
            const feeds = window.__INITIAL_STATE__.feed.feeds;
            const feedsData = feeds.value !== undefined ? feeds.value : feeds._value;
            if (feedsData) {
              return feedsData;
            }
          }
          return [];
        };

        const parseCount = (val) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            if (val.includes('万')) return parseFloat(val) * 10000;
            if (val.includes('+')) return parseFloat(val.replace('+', ''));
            return parseInt(val) || 0;
          }
          return 0;
        };

        const raw = getFeeds();
        if (!raw || !Array.isArray(raw)) return [];

        return raw.slice(0, 20).map((item) => {
          const noteCard = item.noteCard || {};
          const user = noteCard.user || {};
          const interactInfo = noteCard.interactInfo || {};

          return {
            noteId: item.id || noteCard.id || '',
            xsecToken: item.xsecToken || '',
            type: noteCard.type || item.type || 'normal',
            author: user.nickname || '',
            desc: noteCard.displayTitle || noteCard.title || noteCard.desc || '',
            likes: parseCount(interactInfo.likedCount),
            collects: parseCount(interactInfo.collectedCount),
            comments: parseCount(interactInfo.commentCount),
            time: noteCard.time || item.time || '',
            cover: noteCard.cover || '',
            userId: user.userId || user.id || '',
          };
        });
      })()
    `);

    if (!feeds || !Array.isArray(feeds)) {
      return [];
    }

    return feeds.map((f: any) => ({
      noteId: f.noteId,
      xsecToken: f.xsecToken || '',
      type: f.type,
      author: f.author,
      desc: f.desc.slice(0, 100),
      likes: f.likes,
      collects: f.collects,
      comments: f.comments,
      time: f.time,
    }));
  },
});

cli({
  site: 'xhs',
  name: 'search',
  description: 'Search XHS content (notes, users, tags)',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'keyword', positional: true, required: true, help: 'Search keyword' },
    { name: 'type', type: 'string', default: 'note', choices: ['note', 'user', 'tag'], help: 'Search type' },
    { name: 'sort', type: 'string', default: 'general', choices: ['general', 'newest', 'hot', 'most_liked', 'most_commented', 'most_collected'], help: 'Sort by: general, newest, hot, most_liked, most_commented, most_collected' },
    { name: 'time', type: 'string', default: 'any', choices: ['any', 'day', 'week', 'half_year'], help: 'Time range: any, day, week, half_year' },
    { name: 'note_type', type: 'string', default: 'any', choices: ['any', 'video', 'image'], help: 'Note type: any, video, image' },
    { name: 'limit', type: 'int', default: 20, help: 'Number of results' },
  ],
  columns: ['noteId', 'xsecToken', 'type', 'author', 'desc', 'likes', 'time'],
  func: async (page, kwargs) => {
    const keyword = kwargs.keyword as string;
    const noteType = kwargs.note_type || 'any';
    const sort = kwargs.sort || 'general';
    const time = kwargs.time || 'any';
    const limit = Math.min(100, Math.max(1, Number(kwargs.limit ?? 20)));

    const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_explore_feed`;

    await page.goto(searchUrl);
    await page.wait(5);
    await page.autoScroll({ times: 3 });
    await page.wait(3);

    const results = await page.evaluate(`
      (() => {
        try {
          const unwrap = (obj) => {
            if (obj && typeof obj === 'object') {
              if (obj._value !== undefined) return obj._value;
              if (obj.value !== undefined) return obj.value;
            }
            return obj;
          };

          const state = window.__INITIAL_STATE__;
          if (!state) return { error: 'no_state' };

          const search = state.search;
          if (!search) return { error: 'no_search' };

          const feeds = search.feeds;
          if (!feeds) return { error: 'no_feeds' };

          const data = feeds._value !== undefined ? feeds._value : (feeds.value !== undefined ? feeds.value : feeds);
          if (!Array.isArray(data)) return { error: 'not_array', type: typeof data };
          if (data.length === 0) return { error: 'empty_array' };

          const parseCount = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
              if (val.includes('万')) return parseFloat(val) * 10000;
              if (val.includes('+')) return parseFloat(val.replace('+', ''));
              return parseInt(val) || 0;
            }
            return 0;
          };

          return data.slice(0, 20).map((item) => {
            const noteCard = item.noteCard || {};
            const user = noteCard.user || {};
            const interactInfo = noteCard.interactInfo || {};
            return {
              noteId: item.id || noteCard.id || '',
              xsecToken: item.xsecToken || '',
              type: noteCard.type || item.type || 'normal',
              author: user.nickname || '',
              desc: noteCard.displayTitle || noteCard.title || noteCard.desc || '',
              likes: parseCount(interactInfo.likedCount),
              time: noteCard.time || item.time || '',
            };
          });
        } catch (e) {
          return { error: 'catch: ' + e.message };
        }
      })()
    `);

    if (!results || typeof results !== 'object') {
      return [{ noteId: '', type: 'error', author: '', desc: String(results), likes: 0, time: '' }];
    }

    if (results.error) {
      return [{ noteId: '', type: 'error', author: '', desc: results.error, likes: 0, time: '' }];
    }

    if (!Array.isArray(results)) {
      return [{ noteId: '', type: 'error', author: '', desc: 'not_array', likes: 0, time: '' }];
    }

    return results.map((r: any) => ({
      noteId: r.noteId,
      xsecToken: r.xsecToken || '',
      type: r.type,
      author: r.author,
      desc: (r.desc || '').slice(0, 100),
      likes: r.likes,
      time: r.time,
    }));
  },
});

cli({
  site: 'xhs',
  name: 'detail',
  description: 'Get XHS note detail: author, content, images, video, stats, comments',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'note-id', positional: true, required: true, help: 'Note ID or full URL' },
    { name: 'xsec-token', positional: true, required: false, help: 'xsec_token (optional, not needed if note-id is a full URL)' },
    { name: 'comments', type: 'int', default: 20, help: 'Number of top-level comments to fetch' },
    { name: 'sub-comments', type: 'int', default: 10, help: 'Number of sub-comments to load per comment' },
  ],
  columns: ['type', 'value'],
  func: async (page, kwargs) => {
    const input = kwargs['note-id'] as string;
    const xsecTokenArg = (kwargs['xsec-token'] as string) || '';
    const numComments = Math.max(1, Math.min(100, Number(kwargs.comments ?? 20)));
    const numSubComments = Math.max(0, Math.min(50, Number(kwargs['sub-comments'] ?? 10)));

    const { noteId, xsecToken } = parseNoteInput(input);
    const finalXsecToken = xsecToken || xsecTokenArg;
    if (!noteId) {
      throw new Error('Invalid note ID or URL: ' + input);
    }

    const navigateUrl = finalXsecToken
      ? `https://www.xiaohongshu.com/explore/${noteId}?xsec_token=${encodeURIComponent(finalXsecToken)}`
      : `https://www.xiaohongshu.com/explore/${noteId}`;

    await page.goto(navigateUrl);
    await page.wait(3);
    await page.autoScroll({ times: 2 });
    await page.wait(1);

    const storeData = await readNoteFromStore(page);

    const domData = await page.evaluate(`
      (() => {
        const imageSelectors = [
          '.swiper-slide img',
          '.carousel-image img',
          '.note-slider img',
          '.note-image img',
          '.image-wrapper img',
          '#noteContainer .media-container img[src*="xhscdn"]',
          'img[src*="ci.xiaohongshu.com"]'
        ];
        const imageUrls = [];
        for (const sel of imageSelectors) {
          for (const img of document.querySelectorAll(sel)) {
            let src = img.src || img.getAttribute('data-src') || '';
            if (src && (src.includes('xhscdn') || src.includes('xiaohongshu'))) {
              src = src.split('?')[0];
              if (src) imageUrls.push(src);
            }
          }
        }

        const videoSelectors = ['video source', 'video[src]', '.player video', '.video-player video'];
        let videoUrl = '';
        for (const sel of videoSelectors) {
          for (const v of document.querySelectorAll(sel)) {
            const src = v.src || v.getAttribute('src') || '';
            if (src) { videoUrl = src; break; }
          }
          if (videoUrl) break;
        }

        return { imageUrls, videoUrl };
      })()
    `);

    const rows: Row[] = [];

    const desc = storeData?.note?.desc || storeData?.note?.content || '';
    const author = storeData?.note?.user?.nickname || storeData?.user?.nickname || storeData?.author || '';
    const interactInfo = storeData?.interactInfo || storeData?.note?.interactInfo || {};
    const tagList: any[] = storeData?.tagList || storeData?.note?.tagList || [];
    const tags = tagList.map((t: any) => t?.name || t?.tag || '').filter(Boolean);

    const storeImageUrls = (storeData?.imageList || [])
      .map((img: any) => img?.urlOriginal || img?.url || '')
      .filter(Boolean);

    const allImageUrls = [...new Set([...(domData?.imageUrls || []), ...storeImageUrls])];
    const videoUrl = domData?.videoUrl ||
                     storeData?.video?.masterUrl ||
                     storeData?.video?.url || '';

    const likes = interactInfo?.liked_count || interactInfo?.likedCount || '';
    const collects = interactInfo?.collected_count || interactInfo?.collectedCount || '';
    const comments = interactInfo?.comment_count || interactInfo?.commentCount || '';

    if (author) rows.push({ type: 'Author', value: author });
    if (desc) rows.push({ type: 'Content', value: desc });

    for (const imgUrl of allImageUrls) {
      rows.push({ type: 'Image', value: imgUrl });
    }

    if (videoUrl) rows.push({ type: 'Video', value: videoUrl });

    if (tags.length > 0) rows.push({ type: 'Tags', value: tags.join(', ') });

    if (likes || collects || comments) {
      const statParts: string[] = [];
      if (likes) statParts.push(`likes=${likes}`);
      if (collects) statParts.push(`collects=${collects}`);
      if (comments) statParts.push(`comments=${comments}`);
      rows.push({ type: 'Stats', value: statParts.join(' ') });
    }

    if (finalXsecToken) {
      const commentsData: any[] = await page.evaluate(`
        (async () => {
          const maxComments = ${numComments};
          const maxSubComments = ${numSubComments};

          const clickExpandButtons = () => {
            const expandBtns = document.querySelectorAll('.show-more');
            for (const btn of expandBtns) {
              const text = btn.textContent || '';
              if (text.includes('展开') && text.includes('条回复')) {
                btn.scrollIntoView({ block: 'center' });
                btn.click();
              }
            }
          };

          clickExpandButtons();
          await new Promise(r => setTimeout(r, 500));

          const getNickname = (item) => {
            const links = item.querySelectorAll('a[href*="/user/profile/"]');
            for (const link of links) {
              const text = link.textContent?.trim() || '';
              if (text) return text;
            }
            return '[deleted]';
          };

          const comments = [];
          const parentComments = document.querySelectorAll('.parent-comment');

          for (const parent of parentComments) {
            if (comments.length >= maxComments) break;

            const topLevelItem = parent.querySelector(':scope > .comment-item');
            if (topLevelItem) {
              const nickname = getNickname(topLevelItem);
              const contentEl = topLevelItem.querySelector('.content');
              const likeEl = topLevelItem.querySelector('.like-count');
              comments.push({
                user: { nickname },
                content: contentEl?.textContent?.trim() || '',
                liked_count: parseInt(likeEl?.textContent?.replace(/[^0-9]/g, '') || '0'),
                isReply: false,
              });
            }

            if (comments.length >= maxComments) break;

            clickExpandButtons();
            await new Promise(r => setTimeout(r, 300));

            const replyContainer = parent.querySelector(':scope > .reply-container');
            if (replyContainer) {
              const replyItems = replyContainer.querySelectorAll('.comment-item');
              let subCount = 0;
              for (const item of replyItems) {
                if (subCount >= maxSubComments) break;
                const nickname = getNickname(item);
                const contentEl = item.querySelector('.content');
                const likeEl = item.querySelector('.like-count');
                comments.push({
                  user: { nickname },
                  content: contentEl?.textContent?.trim() || '',
                  liked_count: parseInt(likeEl?.textContent?.replace(/[^0-9]/g, '') || '0'),
                  isReply: true,
                });
                subCount++;
              }
            }
          }
          return comments;
        })()
      `);

      if (commentsData && Array.isArray(commentsData)) {
        for (let i = 0; i < commentsData.length; i++) {
          const comment = commentsData[i];
          const commentAuthor = comment.user?.nickname || comment.author || '[deleted]';
          const commentContent = comment.content || comment.text || '';
          const commentLikes = comment.liked_count || comment.likeCount || 0;
          const prefix = comment.isReply ? '↳ ' : '';
          rows.push({
            type: `comment[${i + 1}]`,
            value: `${prefix}${commentAuthor}: ${commentContent} (♥ ${commentLikes})`,
          });
        }
      }
    } else {
      rows.push({ type: 'comment', value: '(xsec_token required for comments)' });
    }

    return rows;
  },
});
