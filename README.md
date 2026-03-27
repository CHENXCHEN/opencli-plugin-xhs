# opencli-plugin-xhs

小红书 (Xiaohongshu) CLI 插件，支持浏览、搜索、评论、点赞、收藏、发布等功能。

## 支持的命令

| 命令 | 描述 | 来源 |
|------|------|------|
| `check-login` | 检查当前登录状态 | plugin |
| `qrcode` | 获取登录二维码（扫码登录） | plugin |
| `delete-cookies` | 清除 cookies（退出登录） | plugin |
| `feeds` | 获取首页推荐内容列表 | plugin |
| `search` | 搜索笔记/用户/标签 | plugin |
| `detail` | 获取笔记详情 | plugin |
| `notifications` | 获取通知消息 | [opencli](https://github.com/jackwener/opencli) |
| `user` | 获取用户主页信息 | plugin |
| `user-notes` | 获取用户笔记列表 | plugin |
| `comment` | 对笔记发表评论 | plugin |
| `reply` ⚠️ | 回复评论（⚠️未测试） | plugin |
| `like` | 点赞/取消点赞 | plugin |
| `favorite` | 收藏/取消收藏 | plugin |
| `publish` ⚠️ | 发布图文笔记（⚠️未测试） | plugin |
| `publish-video` ⚠️ | 发布视频笔记（⚠️未测试） | plugin |
| `download` | 提取笔记中的图片/视频 URL | [opencli](https://github.com/jackwener/opencli) |
| `creator-notes` | 创作者笔记列表 + 数据 | [opencli](https://github.com/jackwener/opencli) |
| `creator-note-detail` | 单篇笔记详细数据 | [opencli](https://github.com/jackwener/opencli) |
| `creator-notes-summary` | 批量笔记摘要 | [opencli](https://github.com/jackwener/opencli) |
| `creator-profile` | 创作者账号信息 | [opencli](https://github.com/jackwener/opencli) |
| `creator-stats` | 创作者数据总览 | [opencli](https://github.com/jackwener/opencli) |

## 安装

```bash
# 安装依赖
pnpm install esbuild -g

# 安装插件
opencli plugin install github:CHENXCHEN/opencli-plugin-xhs

# 更新插件
opencli plugin update xhs

# 使用插件
opencli xhs --help
```

## 使用方法

> **注意**: 带有 `[xsec-token]` 的命令需要从笔记 URL 中提取，例如：`https://www.xiaohongshu.com/explore/xxx?xsec_token=ABC123`，其中 `ABC123` 即为 xsec_token。

```bash
# 认证
opencli xhs check-login                          # 检查登录状态
opencli xhs qrcode                              # 获取登录二维码
opencli xhs delete-cookies                      # 退出登录

# 内容浏览
opencli xhs feeds                               # 首页推荐
opencli xhs feeds --limit 10
opencli xhs search "关键词"                      # 搜索
opencli xhs search "关键词" --type note --sort hot
opencli xhs detail <note-id-or-url> [xsec-token]              # 笔记详情
opencli xhs detail <note-id-or-url> [xsec-token] --comments 50
opencli xhs notifications                           # 通知（@提及）
opencli xhs notifications --type likes             # 点赞通知
opencli xhs notifications --type connections        # 好友通知
opencli xhs notifications --limit 50               # 获取50条

# 用户
opencli xhs user <user-id-or-url>               # 用户信息
opencli xhs user-notes <user-id-or-url>         # 用户笔记列表

# 评论
opencli xhs comment <note-id> [xsec-token] <content>                    # 发表评论
opencli xhs reply <note-id> <comment-id> <content> [xsec-token]         # 回复评论

# 互动
opencli xhs like <note-id> [xsec-token]                            # 点赞
opencli xhs like <note-id> [xsec-token] --action unlike           # 取消点赞
opencli xhs favorite <note-id> [xsec-token]                       # 收藏
opencli xhs favorite <note-id> [xsec-token] --action uncollect    # 取消收藏

# 发布
opencli xhs publish <title> <content>                           # 发布图文
opencli xhs publish <title> <content> --tags "tag1,tag2"
opencli xhs publish-video <title> <content> <video-path>        # 发布视频

# 创作者中心（需登录 creator.xiaohongshu.com）
opencli xhs creator-profile                       # 创作者账号信息
opencli xhs creator-stats                        # 7天数据总览
opencli xhs creator-stats --period thirty         # 30天数据总览
opencli xhs creator-notes                        # 创作者笔记列表
opencli xhs creator-notes --limit 10             # 获取10篇笔记
opencli xhs creator-note-detail <note-id>        # 单篇笔记详细数据
opencli xhs creator-notes-summary                # 最近3篇笔记批量摘要
opencli xhs creator-notes-summary --limit 5      # 最近5篇笔记批量摘要

# 下载
opencli xhs download <note-id-or-url>            # 提取笔记中的图片/视频 URL
```

## 开发

### 项目结构

```
├── comment.ts        # 评论命令（comment/reply）
├── feeds.ts          # Feed 命令（feeds/search/detail）
├── user.ts           # 用户命令（user/user-notes）
├── check-login.ts    # 认证命令
├── interaction.ts    # 互动命令（like/favorite）
├── publish.ts        # 发布命令
├── url-parser.ts     # URL 解析工具
├── api-client.ts     # API 调用封装
└── auth.ts           # 类型定义
```

### 开发工作流

1. **编辑源文件** - 修改根目录下的 `.ts` 文件（如 `comment.ts`、`feeds.ts` 等）

2. **构建并安装到插件目录**：
   ```bash
   npm run plugin
   ```

3. **测试**：
   ```bash
   opencli xhs --help
   opencli xhs check-login
   ```

## 依赖

- Node.js >= 20.0.0
- `@jackwener/opencli` >= 1.0.0
