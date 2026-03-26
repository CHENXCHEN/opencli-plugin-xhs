/**
 * XHS interaction commands
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import type { Row } from './auth';
import { parseNoteInput } from './url-parser';
import { likeNote, collectNote } from './api-client';

cli({
  site: 'xhs',
  name: 'like',
  description: 'Like or unlike a note',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'note-id', positional: true, required: true, help: 'Note ID or URL' },
    { name: 'action', type: 'string', default: 'like', choices: ['like', 'unlike'], help: 'like or unlike' },
    { name: 'xsec_token', type: 'string', help: 'xsec_token (auto-detected)' },
  ],
  columns: ['status', 'value'],
  func: async (page, kwargs) => {
    const noteInput = kwargs['note-id'] as string;
    const action = (kwargs.action as string) || 'like';
    const isLike = action === 'like';
    let xsecToken = (kwargs.xsec_token as string) || '';

    const { noteId } = parseNoteInput(noteInput);
    if (!xsecToken) {
      await page.goto(`https://www.xiaohongshu.com/explore/${noteId}`);
      await page.wait(3);
      const url = page.url();
      try {
        const parsed = new URL(url);
        xsecToken = parsed.searchParams.get('xsec_token') || '';
      } catch {}
    }

    if (!xsecToken) {
      const rows: Row[] = [
        { type: 'status', value: 'error' },
        { type: 'error', value: 'xsec_token is required' },
      ];
      return rows;
    }

    const result = await likeNote(page, noteId, xsecToken, isLike);

    const rows: Row[] = [];
    if (result?.code === 0 || result?.success !== false) {
      rows.push({ type: 'status', value: 'success' });
      rows.push({ type: 'action', value: isLike ? 'liked' : 'unliked' });
    } else {
      rows.push({ type: 'status', value: 'failed' });
      rows.push({ type: 'error', value: result?.msg || result?.error || 'unknown' });
    }
    return rows;
  },
});

cli({
  site: 'xhs',
  name: 'favorite',
  description: 'Favorite (collect) or unfavorite a note',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'note-id', positional: true, required: true, help: 'Note ID or URL' },
    { name: 'action', type: 'string', default: 'collect', choices: ['collect', 'uncollect'], help: 'collect or uncollect' },
    { name: 'xsec_token', type: 'string', help: 'xsec_token (auto-detected)' },
  ],
  columns: ['status', 'value'],
  func: async (page, kwargs) => {
    const noteInput = kwargs['note-id'] as string;
    const action = (kwargs.action as string) || 'collect';
    const isCollect = action === 'collect';
    let xsecToken = (kwargs.xsec_token as string) || '';

    const { noteId } = parseNoteInput(noteInput);
    if (!xsecToken) {
      await page.goto(`https://www.xiaohongshu.com/explore/${noteId}`);
      await page.wait(3);
      const url = page.url();
      try {
        const parsed = new URL(url);
        xsecToken = parsed.searchParams.get('xsec_token') || '';
      } catch {}
    }

    if (!xsecToken) {
      const rows: Row[] = [
        { type: 'status', value: 'error' },
        { type: 'error', value: 'xsec_token is required' },
      ];
      return rows;
    }

    const result = await collectNote(page, noteId, xsecToken, isCollect);

    const rows: Row[] = [];
    if (result?.code === 0 || result?.success !== false) {
      rows.push({ type: 'status', value: 'success' });
      rows.push({ type: 'action', value: isCollect ? 'collected' : 'uncollected' });
    } else {
      rows.push({ type: 'status', value: 'failed' });
      rows.push({ type: 'error', value: result?.msg || result?.error || 'unknown' });
    }
    return rows;
  },
});
