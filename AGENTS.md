# XHS 插件开发流程

## 调试工具

### 浏览器工具 (playwright_browser_*)
```javascript
// 导航到页面
playwright_browser_navigate({ url: "https://www.xiaohongshu.com/" })

// 执行 JavaScript 检查页面状态
playwright_browser_evaluate(() => {
  const state = window.__INITIAL_STATE__;
  return {
    hasState: !!state,
    hasFeed: !!(state?.feed?.feeds),
    feedLength: state?.feed?.feeds?._value?.length,
  };
})

// 获取页面快照
playwright_browser_snapshot()

// 查看网络请求
playwright_browser_network_requests({ includeStatic: false })
```

---

## 完整开发流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           完整开发流程                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ 1.探索  │───▶│ 2.选择  │───▶│ 3.编写  │───▶│ 4.验证  │───▶│ 5.测试  │ │
│  │ Explore │    │Strategy │    │  Code   │    │ Verify  │    │  Test  │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│       │            │            │            │            │              │
│       ▼            ▼            ▼            ▼            ▼              │
│  navigate      Tier 决策    模板字符串    playwright    opencli         │
│  snapshot      cookie/       + IIFE        evaluate     xhs <cmd>       │
│  network       intercept     unwrap        逻辑验证     插件测试         │
│  evaluate      ui                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 第一阶段：探索（Explore）

**目标**：打开浏览器观察页面，发现 API 接口，验证 API 可用性

### 1.1 打开页面并观察
```javascript
// 导航到目标页面
playwright_browser_navigate({ url: "https://www.xiaohongshu.com/" })

// 获取快照，了解 DOM 结构和可交互元素
playwright_browser_snapshot()
```

### 1.2 发现 API 端点
```javascript
// 筛选 JSON API 端点
playwright_browser_network_requests({ includeStatic: false })
```

### 1.3 模拟交互触发懒加载（如需要）
```javascript
// 点击按钮触发懒加载
playwright_browser_click({ ref: "..." })
playwright_browser_wait_for({ time: 2 })

// 再次抓包对比发现新 API
playwright_browser_network_requests({ includeStatic: false })
```

### 1.4 验证 API
```javascript
// 用 fetch 测试 API 或检查 __INITIAL_STATE__
playwright_browser_evaluate(`
  (() => {
    // 测试 fetch API
    const res = await fetch('/api/xxx', { credentials: 'include' });
    const data = await res.json();
    return { success: true, count: data.length };
  })()
`)

// 或检查全局状态
playwright_browser_evaluate(() => {
  const state = window.__INITIAL_STATE__;
  return {
    hasState: !!state,
    keys: state ? Object.keys(state).slice(0, 15) : null
  };
})
```

---

## 第二阶段：选择策略（Strategy）

**目标**：根据 API 特性选择合适的认证/调用策略

### 策略决策树
```
fetch(url) 直接拿到数据？
  → ✅ public
  → ❌ fetch(url, {credentials:'include'}) 带 Cookie 能拿到？
       → ✅ cookie
       → ❌ 需要签名/XHR 拦截？
              → ✅ intercept
              → ❌ ui（最后手段）
```

### XHS 策略适用场景

| Tier | 策略 | 速度 | XHS 适用场景 |
|------|------|------|-------------|
| 1 | `public` | ⚡ ~1s | 暂无 |
| 2 | `cookie` | 🔄 ~7s | **feeds, search, user, comment, interaction** |
| 3 | `header` | 🔄 ~7s | 暂无 |
| 4 | `intercept` | 🔄 ~10s | 复杂签名 API（如有） |
| 5 | `ui` | 🐌 ~15s+ | **publish**（DOM 操作） |

---

## 第三阶段：编写/修改代码并验证（Code & Verify）

**目标**：写完代码后用 playwright 验证逻辑是否正确

### 3.1 关键规则

**规则 1**: `page.evaluate()` 必须使用**模板字符串 + IIFE** 格式

```typescript
// ✅ 正确写法
const data = await page.evaluate(`
  (() => {
    const state = window.__INITIAL_STATE__;
    if (!state?.feed?.feeds) return [];
    const feeds = state.feed.feeds;
    const data = feeds._value !== undefined ? feeds._value : feeds;
    return data;
  })()
`);

// ❌ 错误写法（函数参数不工作）
const data = await page.evaluate((arg) => {
  // ...
}, arg);
```

**规则 2**: Vue reactive 对象用 `._value` 展开

```javascript
const unwrap = (obj) => {
  if (obj?._value !== undefined) return obj._value;
  if (obj?.value !== undefined) return obj.value;
  return obj;
};
```

### 3.2 Playwright 验证示例

在浏览器中验证逻辑正确性：

```javascript
// 测试 feeds 数据获取
playwright_browser_evaluate(`
  (() => {
    const unwrap = (obj) => {
      if (obj?._value !== undefined) return obj._value;
      if (obj?.value !== undefined) return obj.value;
      return obj;
    };
    
    const state = window.__INITIAL_STATE__;
    if (!state) return { error: 'no_state' };
    
    // 测试 feeds
    if (state?.feed?.feeds) {
      const feeds = unwrap(state.feed.feeds);
      if (Array.isArray(feeds) && feeds.length > 0) {
        return { 
          success: true, 
          count: feeds.length, 
          sample: {
            id: feeds[0].id,
            title: feeds[0].noteCard?.displayTitle,
            author: feeds[0].noteCard?.user?.nickname
          }
        };
      }
      return { error: 'empty_feeds' };
    }
    
    return { error: 'no_feeds' };
  })()
`)

// 测试 search 数据获取
playwright_browser_evaluate(`
  (() => {
    const unwrap = (obj) => {
      if (obj?._value !== undefined) return obj._value;
      if (obj?.value !== undefined) return obj.value;
      return obj;
    };
    
    const state = window.__INITIAL_STATE__;
    if (!state?.search?.feeds) return { error: 'no_search_feeds' };
    
    const feeds = unwrap(state.search.feeds);
    if (!Array.isArray(feeds)) return { error: 'not_array' };
    
    return { success: true, count: feeds.length };
  })()
`)
```

### 3.3 XHS 关键数据路径

- **feeds**: `window.__INITIAL_STATE__.feed.feeds._value`
- **search**: `window.__INITIAL_STATE__.search.feeds._value`
- **user**: `window.__INITIAL_STATE__.user.userPageData._value`

---

## 第四阶段：测试验证（Test）

**目标**：将代码复制到插件目录，编译后用 opencli 命令测试

### 4.1 复制并编译
```bash
# 复制 TS 源文件到插件目录
cp *.ts ~/.opencli/plugins/xhs/

# 编译所有 TS 文件
cd ~/.opencli/plugins/xhs/
for f in api-client auth check-login comment feeds interaction publish url-parser user; do
  esbuild ${f}.ts --bundle --outfile=${f}.js --format=esm --platform=node '--external:@jackwener/*'
done
```

### 4.2 测试命令

```bash
# Cookie Tier 2 命令
opencli xhs check-login   # 验证登录状态
opencli xhs feeds        # 首页推荐
opencli xhs search <kw>  # 搜索
opencli xhs user <id>   # 用户信息
opencli xhs user-notes <id>  # 用户笔记

# UI Tier 5 命令
opencli xhs publish      # 发布笔记（需 DOM 操作）
```

---

## 常见问题

### 1. evaluate 返回 undefined
- 检查是否使用了模板字符串而不是函数参数
- 检查 IIFE 格式是否正确 `(())`

### 2. 数据为空
- 确认页面已完全加载（增加 wait 时间）
- 确认 Vue reactive 对象已正确展开（._value）

### 3. 数据路径找不到
- 用 `playwright_browser_evaluate` 检查 `__INITIAL_STATE__` 结构
- 确认是否需要交互触发数据加载

---

## 文件结构参考

```
opencli-plugin-xhs/
├── feeds.ts        # feeds, search 命令
├── user.ts        # user, user-notes 命令
├── check-login.ts # 登录检查
├── api-client.ts  # API 辅助函数
├── auth.ts        # 认证相关
├── comment.ts    # 评论命令
├── interaction.ts # 点赞/收藏命令
└── publish.ts    # 发布命令
```
