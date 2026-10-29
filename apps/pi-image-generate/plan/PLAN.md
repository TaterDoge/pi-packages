# `pi-image-generate` 完整实施计划

> 实施仓库：`/Users/taterdoge/Project/pi-packages`
>
> 新插件目录：`/Users/taterdoge/Project/pi-packages/packages/pi-image-generate`
>
> 现有 `packages/pi-status` 保持不变。

## Context

新建 `@taterdoge/pi-image-generate` Pi package，实现：

- 自然语言请求由 `image-generate` skill 引导 LLM 调用 `image_generate`。
- `/image-generate <prompt>` 直接生成，减少输入。
- `/image-generate generate <prompt>` 作为显式等价形式。
- `/image-generate settings|list|status|reload|help` 提供管理和诊断能力。
- tool 与 command 共用同一生成 orchestrator 和任务状态机。
- 固定使用全局 settings 中的 `defaultModel`；tool/command 都不接受临时 model override。
- 配置只保存到 Pi 全局 `settings.json` 的 `pi-image-generate` section。
- 用户自行配置 provider、protocol 和 model；插件不内置厂商/模型预设。
- 凭据支持 env、直接保存字符串和 Pi modelRegistry auth；直接保存的字符串会以明文写入全局 settings。

## Architecture

### Protocols

1. `openai-images`
   - JSON `POST .../images/generations`
   - `data[].url` / `data[].b64_json`
   - multipart `/images/edits` 或 configurable JSON reference-image field
2. `gemini-generate-content`
   - `POST .../models/{model}:generateContent`
   - prompt/image parts
   - `inlineData` / `inline_data` response
3. `generic-json`
   - 受限 request template + deterministic response paths
   - sync 或 submit/poll/result
   - 不允许 JavaScript/eval/JSONPath filter/任意 shell

首版暂缓 binary multipart 专用协议、ComfyUI WebSocket/workflow 和 OAuth 注册。

### Remote model discovery

- Models 页面可选择已配置 provider，并通过 settings server 请求其 `GET /models`。
- 凭据只在本地 settings server 内解析并注入请求，不返回浏览器。
- 同时支持 OpenAI 风格 `data[]` 与 Gemini 风格 `models[]` 响应。
- UI 提供搜索、checkbox 多选、重复项禁用和批量添加；手动添加仍保留。

### Global config

```jsonc
{
  "pi-image-generate": {
    "version": 1,
    "defaultModel": "studio/flux",
    "outputDir": ".pi/images",
    "limits": {
      "requestTimeoutMs": 300000,
      "pollIntervalMs": 2000,
      "maxPollAttempts": 150,
      "maxResponseBytes": 10485760,
      "maxImageBytes": 52428800,
      "maxInputImages": 8,
      "maxOutputImages": 8
    },
    "providers": {
      "studio": {
        "name": "Studio Gateway",
        "baseUrl": "https://gateway.example.com/v1",
        "protocol": "openai-images",
        "credential": { "source": "env", "value": "STUDIO_IMAGE_KEY" },
        "headers": {}
      }
    },
    "protocols": {},
    "models": {
      "studio/flux": {
        "provider": "studio",
        "id": "vendor/flux-model",
        "capabilities": {
          "imageInput": "multiple",
          "n": true,
          "size": true,
          "qualityValues": []
        },
        "defaults": {},
        "parameterMap": {},
        "protocolOverrides": {}
      }
    }
  }
}
```

- `defaultModel`、provider/model/protocol 引用必须完整。
- 动态 tool schema 由固定 default model capabilities 决定。
- settings writer 只原子替换插件 section，不能破坏其他配置。
- malformed config 不得被静默覆盖。

### Credentials

- `env`：保存变量名，请求边界读取。
- `literal`：让用户输入 API key/token，并直接保存到全局 settings。
- `pi-auth`：`ctx.modelRegistry.getApiKeyForProvider(providerId)`；UI 只显示 auth status。
- Secret header 使用相同 reference 类型。

### Shared task flow

```text
queued → preparing → requesting → polling? → downloading? → saving
       → succeeded | failed | cancelled
```

- 单 active task，recent bounded history。
- 记录 task id/source/provider/model/phase/timestamps/count/paths/sanitized error。
- 不记录 prompt、secret、raw body/base64 或 signed URL。
- tool 用 `onUpdate` + `setStatus`；command 立即 `setStatus`。
- tool/command 完成后生成临时本地 HTML，并打开浏览器标签页预览图片。

### Commands

- `/image-generate <prompt>`：直接生成。
- `/image-generate generate <prompt>`：显式同义形式。
- `/image-generate settings`
- `/image-generate list [providers|models|protocols]`
- `/image-generate status [taskId]`
- `/image-generate reload`
- `/image-generate help`

补全第一层六个子命令；list/status 提供二级补全。未知首词若不是保留子命令，整个 args 视为 prompt。

### Settings UI

`/image-generate settings` 启动仅监听 `127.0.0.1` 的临时 HTTP server，并打开使用 React、Tailwind CSS 和 shadcn/ui 构建的浏览器页面：

- General：default model、output dir、limits
- Providers：CRUD、base URL、protocol、credential、headers
- Models：从 provider 的 `/models` 搜索、多选并批量添加；保留 CRUD、provider、remote id、capabilities、defaults、parameter map
- Protocols：内置说明 + generic-json CRUD
- Validate / Save / Cancel

页面使用一次性 token 建立 HttpOnly cookie 会话；literal credential 只返回掩码。使用 draft-save；Cancel 不写盘；Save 后 reload settings 并重注册 tool；Save、Cancel 或空闲超时后关闭临时 server。

### Safety/files

- HTTP(S) only，拒绝 userinfo/非 HTTP redirect。
- 允许用户显式配置 localhost/内网自托管服务。
- 限制 response/image bytes、image count、poll attempts/timeout。
- 错误不输出 raw response body。
- 输入只接受 file path 或 HTTP(S) URL；拒绝 tool 中 raw base64/data URI。
- MIME sniff、URL 脱敏、AbortSignal。
- `open(..., "wx")` 原子非覆盖；失败/取消删除半文件。
- Tool result 只包含 bounded text/details；图片通过生成后自动打开的浏览器标签页预览。

## Files

新建 `packages/pi-image-generate/`：

- `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, `assets/preview.png`
- `skills/image-generate/SKILL.md`
- `src/index.ts`, `types.ts`, `config.ts`, `credentials.ts`, `task-manager.ts`
- `src/generate.ts`, `image-input.ts`, `files.ts`, `errors.ts`, `format.ts`, `image-preview.ts`
- `src/protocols/index.ts`, `openai-images.ts`, `gemini-generate-content.ts`, `generic-json.ts`, `template.ts`
- `src/settings-server.ts`, `web/src/App.tsx`, `web/src/components/ui/*`, `web/dist/*`
- `test/config.test.js`, `credentials.test.js`, `template.test.js`, `openai-images.test.js`, `gemini.test.js`, `generic-json.test.js`, `task-manager.test.js`, `generate.test.js`, `extension.test.js`, `settings-ui.test.js`, `image-preview.test.js`

仓库接入：

- root `README.md`, `CHANGELOG.md`, `.changeset/*.md`, `bun.lock`
- 不修改或删除 `packages/pi-status`
- 不覆盖当前工作树已有 README/Otty 工作；合并 README 时保留两者

## Execution Steps

- [x] 1. 建立实施分支并记录已有 README/Otty 工作。
- [x] 2. 创建 package manifest、changeset、root package list 和最小 extension/skill shell。
- [x] 3. 用 Bun tests 定义 v1 config schema、strict validation、global-only atomic section writer。
- [x] 4. 实现 env/literal/Pi-auth credentials，并确保凭据不进入日志和任务历史。
- [x] 5. 实现 allowlisted template renderer 和 deterministic response path extractor。
- [x] 6. 实现 `openai-images` protocol。
- [x] 7. 实现 `gemini-generate-content` protocol。
- [x] 8. 实现 `generic-json` sync + submit/poll/result。
- [x] 9. 实现 image input、materialize、MIME、download 和 atomic non-overwrite files。
- [x] 10. 实现 `GenerationTaskManager`。
- [x] 11. 实现共享 `generateImage()` orchestrator。
- [x] 12. 注册动态固定模型 `image_generate` tool。
- [x] 13. 注册 `/image-generate` shorthand + subcommands + completions，并用 `pi.sendMessage` 展示命令结果。
- [x] 14. 实现浏览器 settings 页面、临时 loopback server 和 draft-save CRUD。
- [x] 15. 完成 skill。
- [x] 16. 更新 README/CHANGELOG/preview/bun.lock。
- [x] 17. 运行 Bun tests、repo check、npm pack、Pi local load 和协议 smoke tests。
- [x] 18. 添加 provider `/models` 远端发现、搜索 checkbox 多选和批量添加。
- [x] 19. 删除 Pi 对话列表 inline 图片预览实现；tool/command 生成完成后自动打开浏览器标签页，通过临时本地 HTML 预览全部图片。

## Verification

```bash
cd /Users/taterdoge/Project/pi-packages
bun test packages/pi-image-generate/test
bun run check
npm pack --workspace @taterdoge/pi-image-generate
pi -e ./packages/pi-image-generate
```

验收重点：

- `/image-generate a cat` 可直接开始。
- tool schema 无 model；settings 切换 default model 后 schema 刷新。
- 六个子命令和二级补全正确。
- command/tool 均立即反馈阶段并可取消。
- settings CRUD/Validate/Save/Cancel 正确且只写全局 section。
- Models 可使用 provider 凭据读取 `/models`，搜索、多选并批量加入 draft，且浏览器不接触真实凭据。
- OpenAI/Gemini/generic async fixtures 与真实 smoke 成功。
- tool/command 生成完成后自动打开浏览器标签页，并显示全部生成图片及保存路径。
- 同名文件不覆盖、失败无半文件。
- secret/prompt/raw body/base64/signed URL 不进入任何 surface。
