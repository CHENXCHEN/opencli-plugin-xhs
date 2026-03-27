/**
 * Xiaohongshu download — extract image and video URLs from a note.
 * Adapted from opencli native implementation.
 *
 * Note: The actual file download requires opencli internals (formatCookieHeader, downloadMedia).
 * This version extracts media URLs for use with external download tools.
 *
 * Usage:
 *   opencli xhs download <note-id-or-url> [--output ./xhs]
 *
 * 来源: opencli/src/clis/xiaohongshu/download.ts
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import { parseNoteInput } from './url-parser';

cli({
  site: 'xhs',
  name: 'download',
  description: '提取小红书笔记中的图片和视频 URL',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'note-id', positional: true, required: true, help: 'Note ID or full URL' },
    { name: 'xsec-token', positional: true, required: false, help: 'xsec_token (optional if note-id is a full URL)' },
  ],
  columns: ['index', 'type', 'url'],
  func: async (page: any, kwargs: any) => {
    const input = kwargs['note-id'] as string;
    const xsecTokenArg = (kwargs['xsec-token'] as string) || '';

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

    // Extract note info and media URLs
    const data = await page.evaluate(`
      (() => {
        const result = {
          noteId: '${noteId}',
          title: '',
          author: '',
          media: []
        };

        // Get title
        const titleEl = document.querySelector('.title, #detail-title, .note-content .title, .note-detail-title');
        result.title = titleEl?.textContent?.trim() || 'untitled';

        // Get author
        const authorEl = document.querySelector('.username, .author-name, .name, .user-nickname');
        result.author = authorEl?.textContent?.trim() || 'unknown';

        // Get images - try multiple selectors
        const imageSelectors = [
          '.swiper-slide img',
          '.carousel-image img',
          '.note-slider img',
          '.note-image img',
          '.image-wrapper img',
          '#noteContainer .media-container img[src*="xhscdn"]',
          'img[src*="ci.xiaohongshu.com"]',
          '.detail-content img[src*="xhscdn"]',
          '.note-content img[src*="xiaohongshu"]',
        ];

        const imageUrls = new Set();
        for (const selector of imageSelectors) {
          document.querySelectorAll(selector).forEach(img => {
            let src = img.src || img.getAttribute('data-src') || '';
            if (src && (src.includes('xhscdn') || src.includes('xiaohongshu'))) {
              // Convert to high quality URL (remove resize parameters)
              src = src.split('?')[0];
              src = src.replace(/\\/imageView\\d+\\/\\d+\\/w\\/\\d+/, '');
              imageUrls.add(src);
            }
          });
        }

        // Get video if exists
        const videoSelectors = [
          'video source',
          'video[src]',
          '.player video',
          '.video-player video',
          'video[data-src*="xiaohongshu"]',
        ];

        for (const selector of videoSelectors) {
          document.querySelectorAll(selector).forEach(v => {
            const src = v.src || v.getAttribute('src') || v.getAttribute('data-src') || '';
            if (src) {
              result.media.push({ type: 'video', url: src });
            }
          });
        }

        // Add images to media
        imageUrls.forEach(url => {
          result.media.push({ type: 'image', url: url });
        });

        return result;
      })()
    `);

    if (!data || !data.media || data.media.length === 0) {
      return [{ index: 0, type: '-', url: 'No media found' }];
    }

    // Build result rows
    return data.media.map((item: any, index: number) => ({
      index: index + 1,
      type: item.type,
      url: item.url,
    }));
  },
});
