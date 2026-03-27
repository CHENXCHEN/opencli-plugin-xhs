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
| `detail` | 获取笔记详情 |
| `user` | 获取用户主页信息 |
| `user-notes` | 获取用户笔记列表 |
| `comment` | 对笔记发表评论 |
| `reply` ⚠️ | 回复评论（⚠️未测试） |
| `like` | 点赞/取消点赞 |
| `favorite` | 收藏/取消收藏 |
| `publish` ⚠️ | 发布图文笔记（⚠️未测试） |
| `publish-video` ⚠️ | 发布视频笔记（⚠️未测试） |

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
