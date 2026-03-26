# opencli-plugin-xhs

小红书 (Xiaohongshu) CLI 插件，支持浏览、搜索、评论、点赞、收藏、发布等功能。

## 支持的命令

| 命令 | 描述 |
|------|------|
| `check-login` | 检查当前登录状态 |
| `qrcode` | 获取登录二维码（扫码登录） |
| `delete-cookies` | 清除 cookies（退出登录） |
| `feeds` | 获取首页推荐内容列表 |
| `search` | 搜索笔记/用户/标签 |
| `detail` | 获取笔记详情（作者、内容、图片、视频、评论） |
| `user` | 获取用户主页信息 |
| `comment` | 对笔记发表评论 |
| `reply` | 回复笔记下的评论 |
| `like` | 点赞/取消点赞笔记 |
| `favorite` | 收藏/取消收藏笔记 |
| `publish` | 发布图文笔记 |
| `publish-video` | 发布视频笔记 |

## 使用方法

```bash
# 检查登录状态
opencli xhs check-login

# 获取首页推荐
opencli xhs feeds
opencli xhs feeds --limit 10

# 搜索内容
opencli xhs search "关键词"
opencli xhs search "关键词" --type note --sort hot

# 获取笔记详情
opencli xhs detail <note-id-or-url>
opencli xhs detail <note-id-or-url> --comments 50

# 获取用户信息
opencli xhs user <user-id-or-url>

# 发表评论
opencli xhs comment <note-id> <content>

# 回复评论
opencli xhs reply <note-id> <comment-id> <content>

# 点赞
opencli xhs like <note-id>
opencli xhs like <note-id> --action unlike

# 收藏
opencli xhs favorite <note-id>
opencli xhs favorite <note-id> --action uncollect

# 发布图文
opencli xhs publish <title> <content>
opencli xhs publish <title> <content> --tags "tag1,tag2"
```

## 开发

### 项目结构

```
├── index.ts          # 入口文件，导入所有命令
├── auth.ts           # 类型定义
├── url-parser.ts     # URL 解析工具
├── api-client.ts     # API 调用封装
├── check-login.ts    # 认证命令
├── feeds.ts          # Feed 命令（feeds/search/detail）
├── user.ts           # 用户命令
├── comment.ts        # 评论命令
├── interaction.ts    # 互动命令（like/favorite）
└── publish.ts        # 发布命令
```

### 开发工作流

1. **编辑源文件** - 修改 `commands/` 目录下的 `.ts` 文件

2. **编译打包** - 将所有命令打包成单个 `index.js`：
   ```bash
   npx esbuild index.ts --bundle --outfile=index.js --format=esm --platform=node
   ```

3. **安装到插件目录**：
   ```bash
   cp index.js ~/.opencli/plugins/xhs/
   ```

4. **测试**：
   ```bash
   opencli xhs --help
   opencli xhs check-login
   ```

### 重新构建命令参考

```bash
# 编译并复制到插件目录
npx esbuild index.ts --bundle --outfile=index.js --format=esm --platform=node && cp index.js ~/.opencli/plugins/xhs/
```

## 依赖

- Node.js >= 20.0.0
- `@jackwener/opencli` >= 1.0.0
