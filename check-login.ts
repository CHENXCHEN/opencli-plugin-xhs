/**
 * XHS authentication commands
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import type { Row } from './auth';

cli({
  site: 'xhs',
  name: 'check-login',
  description: 'Check XHS login status',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [],
  columns: ['type', 'value'],
  func: async (page, kwargs) => {
    await page.goto('https://www.xiaohongshu.com');
    await page.wait(3);
    await page.autoScroll({ times: 2 });
    await page.wait(2);

    const cookies = await page.getCookies({ domain: 'xiaohongshu.com' });

    const loginStatus = await page.evaluate(`
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
          if (!state) return { loggedIn: false, reason: 'no_state' };
          
          let user = unwrap(state.user);
          if (!user) return { loggedIn: false, reason: 'no_user' };
          
          let userInfo = unwrap(user.userInfo) || user;
          if (!userInfo || !userInfo.userId) return { loggedIn: false, reason: 'no_userInfo' };
          
          let avatar = '';
          if (typeof userInfo.images === 'string') {
            avatar = userInfo.images;
          } else if (Array.isArray(userInfo.images) && userInfo.images[0]) {
            avatar = userInfo.images[0].urlOriginal || userInfo.images[0].url || '';
          }
          
          return {
            loggedIn: true,
            nickname: userInfo.nickname || '',
            userId: userInfo.userId || '',
            avatar: avatar
          };
        } catch (e) {
          return { loggedIn: false, error: String(e) };
        }
      })()
    `);

    const rows: Row[] = [];

    if (loginStatus?.loggedIn) {
      rows.push({ type: 'status', value: 'logged_in' });
      rows.push({ type: 'nickname', value: loginStatus.nickname || '' });
      rows.push({ type: 'userId', value: loginStatus.userId || '' });
      rows.push({ type: 'avatar', value: loginStatus.avatar || '' });
    } else if (cookies.length > 0) {
      rows.push({ type: 'status', value: 'logged_in' });
      rows.push({ type: 'note', value: 'Cookies present but state not loaded (may need longer wait)' });
      rows.push({ type: 'cookie_count', value: String(cookies.length) });
    } else {
      rows.push({ type: 'status', value: 'not_logged_in' });
      if (loginStatus?.reason) rows.push({ type: 'reason', value: loginStatus.reason });
      if (loginStatus?.error) rows.push({ type: 'error', value: loginStatus.error });
    }
    return rows;
  },
});

cli({
  site: 'xhs',
  name: 'qrcode',
  description: 'Get XHS login QR code for scanning',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'wait', type: 'int', default: 120, help: 'Wait timeout in seconds' },
  ],
  columns: ['type', 'value'],
  func: async (page, kwargs) => {
    await page.goto('https://www.xiaohongshu.com');
    await page.wait(2);

    await page.evaluate(`
      (() => {
        try {
          const pinia = window.__PINIA__;
          if (pinia) {
            const loginStore = pinia._s.get('login');
            if (loginStore?.openLogin) loginStore.openLogin();
          }
        } catch {}
      })()
    `);
    await page.wait(2);

    const qrData = await page.evaluate(`
      (() => {
        try {
          const pinia = window.__PINIA__;
          if (!pinia) return null;
          const loginStore = pinia._s.get('login');
          return loginStore?.qrData || null;
        } catch { return null; }
      })()
    `);

    const qrImage = await page.evaluate(`
      (() => {
        const img = document.querySelector('.login-qrcode img, .qrcode img, [class*="qr"] img');
        return img?.src || '';
      })()
    `);

    const rows: Row[] = [];
    if (qrData?.qrlink || qrImage) {
      rows.push({ type: 'qrcode_url', value: qrData.qrlink || qrImage });
      if (qrData?.qrRefresh) {
        rows.push({ type: 'refresh_url', value: qrData.qrRefresh });
      }
      rows.push({ type: 'tip', value: 'Please scan with Xiaohongshu App' });
    } else {
      rows.push({ type: 'error', value: 'Could not get QR code. Please open login page manually.' });
    }
    return rows;
  },
});

cli({
  site: 'xhs',
  name: 'delete-cookies',
  description: 'Delete XHS cookies (logout)',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [],
  columns: ['type', 'value'],
  func: async (page, kwargs) => {
    const cookies = await page.getCookies({ domain: 'xiaohongshu.com' });
    const rows: Row[] = [];

    if (cookies.length === 0) {
      rows.push({ type: 'status', value: 'no_cookies' });
      return rows;
    }

    await page.evaluate(`
      (async () => {
        const domain = '.xiaohongshu.com';
        const cookies = document.cookie.split(';');
        for (const c of cookies) {
          const name = c.trim().split('=')[0];
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=' + domain + '; path=/';
        }
      })()
    `);

    for (const cookie of cookies) {
      rows.push({ type: 'deleted', value: `${cookie.name}=${cookie.value.slice(0, 8)}...` });
    }
    rows.push({ type: 'count', value: String(cookies.length) });

    return rows;
  },
});
