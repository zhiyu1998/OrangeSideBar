# Chrome Web Store 自动发布

打 tag → GitHub Actions 自动构建 → 上传 CWS → 提交审核，全程无需打开开发者后台。

## 为什么必须是 API v2

CWS API **v1.1 已于 2026-10-15 停服**（[官方公告](https://developer.chrome.com/blog/cws-api-v2)）。所以：

- `mnao305/chrome-extension-upload`、老版 `chrome-webstore-upload-cli` 这类基于 v1.1 的工具现在会直接失败；
- 本仓库用 `scripts/cws-publish.mjs` 直接打 v2 端点，零依赖（Node 20+ 原生 fetch）。

| 动作 | v1.1（已废弃） | v2（本项目使用） |
|---|---|---|
| 上传 | `PUT /upload/chromewebstore/v1.1/items/{id}` | `POST /upload/v2/publishers/{pid}/items/{id}:upload` |
| 提审 | `POST /chromewebstore/v1.1/items/{id}/publish` | `POST /v2/publishers/{pid}/items/{id}:publish` |
| 查状态 | `GET /chromewebstore/v1.1/items/{id}` | `GET /v2/publishers/{pid}/items/{id}:fetchStatus` |

## 一次性配置

### 1. 拿 Publisher ID 和 Item ID

- **Item ID** = 扩展 ID = `aebjicpjnebiegmmppoeomjalkjkccjg`（就是商店 URL 里那串 32 位）。
  ⚠️ URL 里的 `9160e9c6-59f5-490f-a012-42cdfb4316d2` 是**账号 ID**，不是 publisher ID，用不了。
- **Publisher ID**：开发者后台 → **Publisher → Settings**，形如 `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`。

### 2. 建 OAuth 客户端

1. [Google Cloud Console](https://console.developers.google.com) → 新建/选择项目 → 搜索并启用 **Chrome Web Store API**。
2. **OAuth consent screen** → External → 填 App name / 邮箱 → 保存。
   - **关键**：Publishing status 要改成 **In production**。停在 "Testing" 时 refresh token 约 7 天就失效，CI 会突然报 `invalid_grant`。
3. **Credentials** → Create credentials → OAuth client ID → **Web application** →
   Authorized redirect URI 加 `https://developers.google.com/oauthplayground`。
4. 记下 client ID / client secret。

### 3. 换 refresh token

1. 打开 <https://developers.google.com/oauthplayground>，右上齿轮 → 勾 **Use your own OAuth credentials**，填入 client ID/secret。
2. 左侧 scopes 输入框填 `https://www.googleapis.com/auth/chromewebstore` → **Authorize APIs** → 用**扩展的所有者账号**登录。
3. **Exchange authorization code for tokens** → 复制 `refresh_token`。

> 该 scope 覆盖你名下**所有**扩展的写权限。token 等同于密码，只放 GitHub Secrets。

### 4. 配 GitHub Secrets

仓库 Settings → Secrets and variables → Actions → New repository secret：

| Secret | 值 |
|---|---|
| `CWS_CLIENT_ID` | OAuth client ID |
| `CWS_CLIENT_SECRET` | OAuth client secret |
| `CWS_REFRESH_TOKEN` | 上一步的 refresh token |
| `CWS_PUBLISHER_ID` | Publisher ID |
| `CWS_EXTENSION_ID` | `aebjicpjnebiegmmppoeomjalkjkccjg` |

账号必须是**开了两步验证**的开发者账号，否则 API 拒绝发布。

## 日常发版

```bash
bun run release patch     # 2.0.4 → 2.0.5：改版本 → 构建+校验 → commit → tag → push
```

推完 tag 后 `.github/workflows/cws-publish.yml` 自动跑：装依赖 → 构建 → 三级版本校验 → 上传 → 提审 → 写 Step Summary。

手工等价流程：

```bash
# 1. 改 package.json version（manifest.config.ts 会自动跟随）
bun run build                       # 产出 release/crx-orangesidebar-<ver>.zip
bun run cws:check                   # 校验 zip 内 manifest 版本
git commit -am "🔖 chore: 版本号升级至 x.y.z"
git tag x.y.z && git push origin HEAD --follow-tags
```

## 本地直接发包（不走 CI）

```bash
export CWS_CLIENT_ID=...
export CWS_CLIENT_SECRET=...
export CWS_REFRESH_TOKEN=...
export CWS_PUBLISHER_ID=...
export CWS_EXTENSION_ID=aebjicpjnebiegmmppoeomjalkjkccjg

bun run cws:status                  # 看 Published / Submitted 版本
bun run cws:upload                  # 只上传，后台手动点提审
bun run cws:publish                 # 上传 + 提审
bun run cws:publish -- --deploy-percentage 20   # 阶梯发布（>1 万周活才生效）
```

本地连不上 googleapis 时挂代理：`HTTPS_PROXY=http://127.0.0.1:7890 bun run cws:status`。

## 脚本参数

| 参数 | 作用 |
|---|---|
| `--zip <path>` | 指定发布包，默认按 `package.json` 版本在 `release/` / `build/` / `.` 里找 |
| `--check-build` | 只校验产物和版本一致性，不联网 |
| `--status` | 只查商店状态 |
| `--dry-run` | 校验凭据 + 打印计划，不上传 |
| `--upload-only` | 只上传不提审 |
| `--deploy-percentage <n>` | 覆盖灰度比例 |

## 常见报错对照

| 报错 | 原因 / 处理 |
|---|---|
| `invalid_grant` | refresh token 失效：consent screen 还在 Testing，或 token 被撤。转 In production 后重取。 |
| `401 / ACCESS_TOKEN_SCOPE_INSUFFICIENT` | scope 没带 `chromewebstore`，重走 OAuth Playground。 |
| `400 ... same version` | 商店草稿已是该版本，改版本号重新构建。 |
| `publish` 失败提示 visibility | 后台手动改过可见性，需先在后台手动发布一次同可见性版本。 |
| `uploadState: UPLOAD_IN_PROGRESS` | 包大（本项目 17 MB），脚本会自动轮询 `fetchStatus`。 |
| 上传成功但商店仍显示旧版 | 只上传未提审。后台 Draft 就是新版本，需点「Submit for review」或跑 `cws:publish`。 |

## 关于截图里的 “Verified CRX uploads / Opt in”

那是给**从 GitHub Release 下载 .crx 手动安装**用的自校验开关（上传你的 CRX 公钥，Chrome 借此验证分发的 CRX 未被篡改），和商店发布链路无关。
不想维护 CRX 分发就让它保持未开启，`build-crx.yml` 里的签名产物只作为 GitHub Release 附件提供，不影响商店上架。