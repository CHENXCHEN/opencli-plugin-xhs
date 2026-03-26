/**
 * XHS publish commands
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import type { Row } from './auth';

cli({
  site: 'xhs',
  name: 'publish',
  description: 'Publish a content note (images with title and description)',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'title', positional: true, required: true, help: 'Note title' },
    { name: 'content', positional: true, required: true, help: 'Note content/description' },
    { name: 'tags', type: 'string', help: 'Comma-separated tags (without #)' },
    { name: 'images', type: 'string', help: 'Comma-separated image URLs or paths' },
  ],
  columns: ['status', 'value'],
  func: async (page, kwargs) => {
    const title = kwargs.title as string;
    const content = kwargs.content as string;
    const tags = ((kwargs.tags as string) || '').split(',').filter(Boolean);

    await page.installInterceptor('edith.xiaohongshu.com/api/sns/web/v1/feed/create');
    await page.wait(0.5);

    await page.goto('https://www.xiaohongshu.com/publish');
    await page.wait(3);

    const titleInput = await page.evaluate(`
      (() => {
        const inputs = document.querySelectorAll('input, textarea');
        for (const input of inputs) {
          const placeholder = input.getAttribute('placeholder') || '';
          if (placeholder.includes('标题') || placeholder.includes('title')) {
            return 'found';
          }
        }
        return 'not-found';
      })()
    `);

    if (titleInput === 'found') {
      await page.evaluate((t: string) => {
        const inputs = document.querySelectorAll('input, textarea');
        for (const input of inputs) {
          const placeholder = input.getAttribute('placeholder') || '';
          if (placeholder.includes('标题') || placeholder.includes('title')) {
            (input as HTMLInputElement).value = t;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          }
        }
      }, title);
    }

    await page.evaluate((c: string) => {
      const editors = document.querySelectorAll('[contenteditable="true"]');
      if (editors.length > 0) {
        editors[0].textContent = c;
        editors[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, content);

    for (const tag of tags) {
      await page.evaluate((t: string) => {
        const inputs = document.querySelectorAll('input, textarea');
        for (const input of inputs) {
          const placeholder = input.getAttribute('placeholder') || '';
          if (placeholder.includes('标签') || placeholder.includes('tag')) {
            (input as HTMLInputElement).value = '#' + t.trim();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          }
        }
      }, tag);
      await page.wait(0.3);
      await page.pressKey('Enter');
    }

    const publishBtn = await page.evaluate(`
      (() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.textContent?.includes('发布') || btn.textContent?.includes('Post')) {
            return 'found';
          }
        }
        return 'not-found';
      })()
    `);

    if (publishBtn === 'found') {
      await page.click('button:has-text("发布")');
    }

    await page.wait(3);

    const requests = await page.getInterceptedRequests();
    const createRequest = requests.find(r => r.url?.includes('/feed/create'));

    const rows: Row[] = [];
    if (createRequest) {
      try {
        const body = JSON.parse(createRequest.postData || '{}');
        rows.push({ type: 'status', value: 'published' });
        rows.push({ type: 'noteId', value: body.noteId || body.note_id || '' });
        rows.push({ type: 'url', value: `https://www.xiaohongshu.com/explore/${body.noteId || body.note_id}` });
      } catch {
        rows.push({ type: 'status', value: 'submitted' });
      }
    } else {
      rows.push({ type: 'status', value: 'draft' });
      rows.push({ type: 'tip', value: 'Publish request not intercepted. Check if logged in.' });
    }
    return rows;
  },
});

cli({
  site: 'xhs',
  name: 'publish-video',
  description: 'Publish a video note',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'title', positional: true, required: true, help: 'Video title' },
    { name: 'content', positional: true, required: true, help: 'Video description' },
    { name: 'video', positional: true, required: true, help: 'Video file path or URL' },
    { name: 'cover', type: 'string', help: 'Cover image path or URL' },
    { name: 'tags', type: 'string', help: 'Comma-separated tags (without #)' },
    { name: 'schedule', type: 'string', help: 'Schedule time (ISO8601 format, e.g. 2024-12-25T10:00:00+08:00)' },
  ],
  columns: ['status', 'value'],
  func: async (page, kwargs) => {
    const title = kwargs.title as string;
    const content = kwargs.content as string;
    const videoPath = kwargs.video as string;
    const coverPath = (kwargs.cover as string) || '';
    const tags = ((kwargs.tags as string) || '').split(',').filter(Boolean);
    const scheduleTime = (kwargs.schedule as string) || '';

    await page.goto('https://creator.xiaohongshu.com/publish/publish?source=official');
    await page.wait(3);

    await page.evaluate(`
      (async () => {
        const tabs = document.querySelectorAll('.creator-tab, [class*="tab"]');
        for (const tab of tabs) {
          if (tab.textContent?.includes('视频')) {
            (tab as HTMLElement).click();
            break;
          }
        }
      })()
    `);
    await page.wait(2);

    const uploadResult = await page.evaluate(async (videoPath: string) => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (!input) return { success: false, error: 'No file input found' };

      try {
        if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
          const response = await fetch(videoPath);
          const blob = await response.blob();
          const file = new File([blob], 'video.mp4', { type: blob.type });
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        } else {
          const response = await fetch(`file://${videoPath}`);
          const blob = await response.blob();
          const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    }, videoPath);

    if (!uploadResult.success) {
      const rows: Row[] = [
        { type: 'status', value: 'error' },
        { type: 'error', value: uploadResult.error || 'Failed to upload video' },
      ];
      return rows;
    }

    await page.wait(10);

    const titleLen = await page.evaluate((t: string) => {
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        const placeholder = input.getAttribute('placeholder') || '';
        if (placeholder.includes('标题') || placeholder.includes('title')) {
          (input as HTMLInputElement).value = t;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          const lenEl = document.querySelector('.title-container .max_suffix, .d-input .num');
          return lenEl?.textContent || '';
        }
      }
      return '';
    }, title);

    await page.evaluate((c: string) => {
      const editors = document.querySelectorAll('[contenteditable="true"]');
      for (const editor of editors) {
        const placeholder = editor.getAttribute('data-placeholder') || '';
        if (placeholder.includes('描述') || placeholder.includes('content')) {
          editor.textContent = c;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
      }
    }, content);

    for (const tag of tags) {
      await page.evaluate((t: string) => {
        const inputs = document.querySelectorAll('input');
        for (const input of inputs) {
          const placeholder = input.getAttribute('placeholder') || '';
          if (placeholder.includes('标签') || placeholder.includes('tag')) {
            (input as HTMLInputElement).value = '#' + t.trim();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          }
        }
      }, tag);
      await page.wait(0.3);
      await page.pressKey('Enter');
    }

    if (scheduleTime) {
      await page.evaluate((time: string) => {
        const switchEl = document.querySelector('.post-time-wrapper .d-switch, .schedule-switch');
        if (switchEl) (switchEl as HTMLElement).click();
        const dateInput = document.querySelector('.date-picker-container input') as HTMLInputElement;
        if (dateInput) {
          dateInput.value = time;
          dateInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, scheduleTime);
    }

    const publishBtn = await page.evaluate(`
      (() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.textContent?.includes('发布') || btn.textContent?.includes('Post')) {
            const disabled = btn.getAttribute('disabled');
            if (disabled === null) return 'ready';
          }
        }
        return 'not-ready';
      })()
    `);

    const rows: Row[] = [];
    if (publishBtn === 'ready') {
      await page.click('button:has-text("发布")');
      await page.wait(5);
      rows.push({ type: 'status', value: 'published' });
      rows.push({ type: 'title', value: title });
    } else {
      rows.push({ type: 'status', value: 'draft' });
      rows.push({ type: 'tip', value: 'Video may still be processing. Check creator center.' });
    }

    return rows;
  },
});
