/**
 * XHS user commands
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import type { Row } from './auth';
import { parseUserInput } from './url-parser';

cli({
  site: 'xhs',
  name: 'user',
  description: 'Get XHS user profile information',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'user-id', positional: true, required: true, help: 'User ID or profile URL' },
    { name: 'xsec_token', type: 'string', help: 'xsec_token for accessing restricted profiles' },
  ],
  columns: ['field', 'value'],
  func: async (page, kwargs) => {
    const input = kwargs['user-id'] as string;
    const userId = parseUserInput(input);
    const xsecToken = (kwargs.xsec_token as string) || '';

    const profileUrl = xsecToken
      ? `https://www.xiaohongshu.com/user/profile/${userId}?xsec_token=${encodeURIComponent(xsecToken)}`
      : `https://www.xiaohongshu.com/user/profile/${userId}`;

    await page.goto(profileUrl);
    await page.wait(3);
    await page.autoScroll({ times: 3 });
    await page.wait(2);

    const profile = await page.evaluate(`
      (() => {
        const unwrap = (obj) => {
          if (obj && typeof obj === 'object') {
            if (obj._value !== undefined) return obj._value;
            if (obj.value !== undefined) return obj.value;
          }
          return obj;
        };

        const getUserData = () => {
          const state = window.__INITIAL_STATE__;
          if (state?.user) {
            return {
              userPageData: unwrap(state.user.userPageData),
              notes: unwrap(state.user.notes)
            };
          }
          const pinia = window.__PINIA__;
          if (pinia) {
            const userStore = pinia._s.get('user');
            if (userStore?.userPageData) {
              return { userPageData: unwrap(userStore.userPageData), notes: unwrap(userStore.notes) };
            }
            if (userStore?.state?.userPageData) {
              return { userPageData: unwrap(userStore.state.userPageData), notes: unwrap(userStore.state.notes) };
            }
          }
          return null;
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

        const data = getUserData();
        if (!data) return null;

        const userPageData = data.userPageData;
        const basicInfo = userPageData?.basicInfo || userPageData?.userInfo || {};
        const interactions = userPageData?.interactions || [];
        const userInfo = userPageData?.userInfo || basicInfo;

        const notesData = data.notes;
        let notesCount = 0;
        if (notesData) {
          if (Array.isArray(notesData)) {
            notesCount = notesData.length;
          } else if (Array.isArray(notesData[0])) {
            notesCount = notesData.reduce((acc, arr) => acc + (arr.length || 0), 0);
          }
        }

        let fans = 0, follow = 0, liked = 0;
        if (Array.isArray(interactions)) {
          for (const item of interactions) {
            if (item.type === 'fans' || item.name === '粉丝') {
              fans = parseCount(item.count);
            } else if (item.type === 'follows' || item.name === '关注') {
              follow = parseCount(item.count);
            } else if (item.type === 'interaction' || item.name === '获赞与收藏') {
              liked = parseCount(item.count);
            }
          }
        }

        let avatar = '';
        if (typeof basicInfo.images === 'string') {
          avatar = basicInfo.images;
        } else if (Array.isArray(basicInfo.images) && basicInfo.images[0]) {
          avatar = basicInfo.images[0].urlOriginal || basicInfo.images[0].url || '';
        }

        return {
          nickname: basicInfo.nickname || '',
          avatar: avatar,
          gender: basicInfo.gender || '',
          ipLocation: basicInfo.ipLocation || '',
          bio: basicInfo.desc || '',
          fans: fans,
          follow: follow,
          liked: liked,
          notes: notesCount,
          userId: basicInfo.userId || '',
          redId: basicInfo.redId || '',
          tags: userPageData?.tags || [],
        };
      })()
    `);

    const rows: Row[] = [];
    if (profile) {
      rows.push({ type: 'nickname', value: profile.nickname });
      rows.push({ type: 'userId', value: profile.userId || userId });
      if (profile.redId) rows.push({ type: 'redId', value: profile.redId });
      rows.push({ type: 'avatar', value: profile.avatar });
      if (profile.gender) rows.push({ type: 'gender', value: profile.gender });
      if (profile.ipLocation) rows.push({ type: 'ipLocation', value: profile.ipLocation });
      if (profile.bio) rows.push({ type: 'bio', value: profile.bio });
      rows.push({ type: 'fans', value: String(profile.fans) });
      rows.push({ type: 'follow', value: String(profile.follow) });
      rows.push({ type: 'liked', value: String(profile.liked || 0) });
      rows.push({ type: 'collected', value: String(profile.collected || 0) });
      rows.push({ type: 'notes', value: String(profile.notes) });
      if (profile.shared) rows.push({ type: 'shared', value: String(profile.shared) });
      if (profile.level) rows.push({ type: 'level', value: profile.level });
      if (profile.isStar) rows.push({ type: 'isStar', value: 'true' });
      if (profile.tags?.length > 0) rows.push({ type: 'tags', value: profile.tags.join(', ') });
    } else {
      rows.push({ type: 'error', value: 'Could not fetch user profile' });
    }
    return rows;
  },
});

cli({
  site: 'xhs',
  name: 'user-notes',
  description: 'Get notes posted by a user',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'user-id', positional: true, required: true, help: 'User ID or profile URL' },
    { name: 'xsec_token', type: 'string', help: 'xsec_token for accessing restricted profiles' },
    { name: 'limit', type: 'int', default: 20, help: 'Number of notes to fetch' },
  ],
  columns: ['noteId', 'type', 'title', 'desc', 'likes', 'time'],
  func: async (page, kwargs) => {
    const input = kwargs['user-id'] as string;
    const userId = parseUserInput(input);
    const xsecToken = (kwargs.xsec_token as string) || '';
    const limit = Math.min(100, Math.max(1, Number(kwargs.limit ?? 20)));

    const profileUrl = xsecToken
      ? `https://www.xiaohongshu.com/user/profile/${userId}?xsec_token=${encodeURIComponent(xsecToken)}`
      : `https://www.xiaohongshu.com/user/profile/${userId}`;

    await page.goto(profileUrl);
    await page.wait(3);

    await page.evaluate(async () => {
      const scroll = () => {
        window.scrollBy(0, window.innerHeight * 0.8);
      };
      for (let i = 0; i < 10; i++) {
        scroll();
        await new Promise(r => setTimeout(r, 500));
      }
    });

    await page.wait(2);

    const notes = await page.evaluate(`
      (() => {
        const limit = ${limit};
        const unwrap = (obj) => {
          if (obj && typeof obj === 'object') {
            if (obj._value !== undefined) return obj._value;
            if (obj.value !== undefined) return obj.value;
          }
          return obj;
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

        const getNotes = () => {
          const state = window.__INITIAL_STATE__;
          if (state?.user?.notes) {
            return unwrap(state.user.notes);
          }
          const pinia = window.__PINIA__;
          if (pinia) {
            const userStore = pinia._s.get('user');
            if (userStore?.notes) {
              return unwrap(userStore.notes);
            }
            if (userStore?.state?.notes) {
              return unwrap(userStore.state.notes);
            }
          }
          return [];
        };

        let rawNotes = getNotes();
        if (!rawNotes || !Array.isArray(rawNotes)) return [];

        if (rawNotes.length > 0 && Array.isArray(rawNotes[0])) {
          rawNotes = rawNotes.flat();
        }

        return rawNotes.slice(0, limit).map((item) => {
          const noteCard = item.noteCard || {};
          const interactInfo = noteCard.interactInfo || {};

          return {
            noteId: item.id || noteCard.noteId || '',
            type: noteCard.type || item.type || 'normal',
            title: noteCard.displayTitle || noteCard.title || '',
            desc: noteCard.desc || noteCard.content || '',
            likes: parseCount(interactInfo.likedCount),
            collects: parseCount(interactInfo.collectedCount),
            comments: parseCount(interactInfo.commentCount),
            time: noteCard.time || item.time || '',
            cover: noteCard.cover?.url || noteCard.cover || '',
          };
        });
      })()
    `);

    if (!notes || !Array.isArray(notes)) {
      return [];
    }

    return notes.map((n: any) => ({
      noteId: n.noteId,
      type: n.type,
      title: n.title.slice(0, 50),
      desc: n.desc.slice(0, 100),
      likes: n.likes,
      time: n.time,
    }));
  },
});
