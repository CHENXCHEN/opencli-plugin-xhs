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

    const result = await postComment(page, noteId, content, finalXsecToken);

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
