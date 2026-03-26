/**
 * XHS comment commands
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import type { Row } from './auth';
import { parseNoteInput } from './url-parser';
import { postComment } from './api-client';

cli({
  site: 'xhs',
  name: 'comment',
  description: 'Post a comment to a note',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'note-id', positional: true, required: true, help: 'Note ID or full URL' },
    { name: 'content', positional: true, required: true, help: 'Comment content' },
    { name: 'xsec-token', positional: true, required: false, help: 'xsec_token (auto-detected from URL)' },
  ],
  columns: ['status', 'value'],
  func: async (page, kwargs) => {
    const noteInput = kwargs['note-id'] as string;
    const content = kwargs.content as string;
    const xsecTokenArg = (kwargs['xsec-token'] as string) || '';

    const { noteId, xsecToken: xsecTokenFromUrl } = parseNoteInput(noteInput);
    const finalXsecToken = xsecTokenArg || xsecTokenFromUrl;

    if (!finalXsecToken) {
      const rows: Row[] = [];
      rows.push({ type: 'status', value: 'error' });
      rows.push({ type: 'error', value: 'xsec_token is required. Please provide full note URL with xsec_token.' });
      return rows;
    }

    await page.goto(`https://www.xiaohongshu.com/explore/${noteId}?xsec_token=${finalXsecToken}`);
    await page.wait(3);

    const result = await page.evaluate(`
      (() => {
        try {
          const inputArea = document.querySelector('p.content-input, .comment-input, [class*="comment"] input, .input-box');
          if (!inputArea) {
            return { code: -1, success: false, error: 'Input area not found' };
          }
          inputArea.click();
          setTimeout(() => {
            document.execCommand('insertText', false, ${JSON.stringify(content)});
            const submitBtn = document.querySelector('button.submit, button.btn');
            if (submitBtn) {
              submitBtn.click();
            }
          }, 500);
          return { code: 0, success: true };
        } catch (e) {
          return { code: -1, success: false, error: String(e) };
        }
      })()
    `);

    const rows: Row[] = [];
    if (result?.code === 0 || result?.success === true) {
      rows.push({ type: 'status', value: 'success' });
    } else {
      rows.push({ type: 'status', value: 'failed' });
      rows.push({ type: 'error', value: result?.error || 'unknown' });
    }
    return rows;
  },
});

cli({
  site: 'xhs',
  name: 'reply',
  description: 'Reply to a comment on a note',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'note-id', positional: true, required: true, help: 'Note ID or full URL' },
    { name: 'comment-id', positional: true, required: true, help: 'Comment ID to reply to' },
    { name: 'content', positional: true, required: true, help: 'Reply content' },
    { name: 'xsec-token', positional: true, required: false, help: 'xsec_token (auto-detected from URL)' },
  ],
  columns: ['status', 'value'],
  func: async (page, kwargs) => {
    const noteInput = kwargs['note-id'] as string;
    const commentId = kwargs['comment-id'] as string;
    const content = kwargs.content as string;
    const xsecTokenArg = (kwargs['xsec-token'] as string) || '';

    const { noteId, xsecToken: xsecTokenFromUrl } = parseNoteInput(noteInput);
    const finalXsecToken = xsecTokenArg || xsecTokenFromUrl;

    if (!finalXsecToken) {
      const rows: Row[] = [];
      rows.push({ type: 'status', value: 'error' });
      rows.push({ type: 'error', value: 'xsec_token is required' });
      return rows;
    }

    const result = await postComment(page, noteId, content, finalXsecToken, commentId);

    const rows: Row[] = [];
    if (result?.code === 0 || result?.success !== false) {
      rows.push({ type: 'status', value: 'success' });
      rows.push({ type: 'commentId', value: result?.data?.commentId || '' });
    } else {
      rows.push({ type: 'status', value: 'failed' });
      rows.push({ type: 'error', value: result?.msg || result?.error || 'unknown' });
    }
    return rows;
  },
});
