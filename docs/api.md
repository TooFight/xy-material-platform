# 接口文档

> 后端基础地址：`http://localhost:8080`（前端使用 `NEXT_PUBLIC_API_BASE_URL`）。设计背景见 [architecture.md](architecture.md)。
> 字段名、枚举值是前后端的契约。修改时同步改：后端 DTO、前端 `src/lib/types.ts` 和本文档。

## 0. 通用约定

### 0.1 身份

| 请求头 | 必填 | 说明 |
|---|---|---|
| `X-User-Id` | 除标注“公开”的接口外都必填 | 演示用户 ID（整数），见 `GET /api/users` |

- 缺失、不是正整数或用户不存在：`401 UNAUTHORIZED`。
- 访问不属于当前用户的任务或素材：`404 NOT_FOUND`（与“不存在”相同，不暴露资源是否存在）。

### 0.2 格式

- 请求体和响应体都是 `application/json; charset=utf-8`，上传接口除外（`multipart/form-data`）。
- 时间：ISO-8601 UTC 字符串，如 `"2026-11-04T08:30:12.345Z"`。
- ID：模板 ID 为字符串 slug，其余为整数（JSON number）。
- URL 字段（`coverUrl`、`url`、`resultUrl`）是相对后端的路径，以 `/` 开头。前端拼接为 `${NEXT_PUBLIC_API_BASE_URL}${path}`。
- 成功响应直接返回资源对象，不额外包一层 `{code, data}`。

### 0.3 错误响应

所有非 2xx 响应统一使用以下结构：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "需要上传 2 张图片，当前为 1 张",
  "details": [{ "field": "assetIds", "message": "数量不符" }]
}
```

| HTTP | code | 场景 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 参数缺失或格式错误、数量不符、素材不属于该模板等 |
| 401 | `UNAUTHORIZED` | `X-User-Id` 缺失或无效 |
| 404 | `NOT_FOUND` | 模板、任务或素材不存在，或不属于当前用户；文件签名错误或已过期 |
| 413 | `FILE_TOO_LARGE` | 文件超过模板限制或全局 multipart 上限 |
| 415 | `UNSUPPORTED_FILE_TYPE` | 按文件头识别的类型不在模板允许范围内 |
| 404 | `DEV_API_DISABLED` | 未开启 dev API 时访问 `/api/dev/**` |
| 500 | `INTERNAL_ERROR` | 未预期的错误（不返回堆栈） |

`details` 可以省略。前端展示 `message`，用 `code` 做分支判断。

### 0.4 枚举

```ts
type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
type TaskStage  = 'CHECKING' | 'GENERATING' | 'FINALIZING';
type StageLogStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';
```

---

## 1. 健康检查

### `GET /api/health`（公开）

`200` → `{ "status": "UP" }`。供 Docker healthcheck 和前端探活使用。

---

## 2. 用户

### `GET /api/users`（公开）

列出可选的演示用户，供身份切换器使用。

```json
[
  { "id": 1, "username": "alice", "displayName": "Alice" },
  { "id": 2, "username": "bob",   "displayName": "Bob" },
  { "id": 3, "username": "carol", "displayName": "Carol" }
]
```

### `GET /api/me`

返回当前请求头对应的用户，前端用它确认 `localStorage` 中保存的身份仍然有效。

`200` → `{ "id": 1, "username": "alice", "displayName": "Alice" }`；`401` 表示身份无效，前端应重新选择身份。

---

## 3. 模板

### `GET /api/template-categories`（公开）

```json
[
  { "code": "creative",  "name": "创意图片", "templateCount": 3 },
  { "code": "festival",  "name": "节日贺卡", "templateCount": 2 },
  { "code": "collage",   "name": "拼图海报", "templateCount": 2 }
]
```

按 `sortOrder` 排序。前端在最前面加一个“全部”选项。

### `GET /api/templates`（公开）

| 查询参数 | 必填 | 说明 |
|---|---|---|
| `category` | 否 | 分类 code。不传则返回全部；分类不存在时返回 `[]` |

`200`：

```json
[
  {
    "id": "demo-postcard",
    "title": "旅行明信片",
    "category": { "code": "creative", "name": "创意图片" },
    "coverUrl": "/demo/covers/postcard.jpg",
    "requiredImageCount": 2
  }
]
```

列表只返回卡片需要的字段。

### `GET /api/templates/{id}`（公开）

`200`：

```json
{
  "id": "demo-postcard",
  "title": "旅行明信片",
  "category": { "code": "creative", "name": "创意图片" },
  "coverUrl": "/demo/covers/postcard.jpg",
  "description": "上传图片，模拟生成一张明信片",
  "requiredImageCount": 2,
  "acceptedMimeTypes": ["image/jpeg", "image/png"],
  "maxFileSizeBytes": 5242880
}
```

`404 NOT_FOUND`：模板不存在。

---

## 4. 素材

### `POST /api/assets`

上传单张图片。每个上传位调用一次。

请求：`multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `templateId` | string | 是 | 按该模板的类型和大小要求进行校验 |
| `file` | file | 是 | 单个图片文件 |

服务端校验：模板存在；文件非空；`size ≤ maxFileSizeBytes`；按**文件头魔数**识别类型，结果必须在 `acceptedMimeTypes` 中。

`201 Created`：

```json
{
  "id": 101,
  "templateId": "demo-postcard",
  "originalFilename": "beach.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 734002,
  "url": "/files/assets/7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg",
  "createdAt": "2026-11-04T08:30:12.345Z"
}
```

错误：`400`（缺少字段、空文件）、`404`（模板不存在）、`413 FILE_TOO_LARGE`、`415 UNSUPPORTED_FILE_TYPE`。

> 素材上传同步完成：接口返回 201 即表示文件已落盘，记录已入库。因此素材表不需要“上传中”状态，“上传中”只是前端请求进行中的状态。

---

## 5. 制作任务

### 5.1 TaskDTO

```json
{
  "id": 42,
  "templateId": "demo-postcard",
  "templateTitle": "旅行明信片",
  "templateCoverUrl": "/demo/covers/postcard.jpg",
  "status": "FAILED",
  "stage": "GENERATING",
  "failedStage": "GENERATING",
  "failureReason": "模拟生成失败：已按模拟配置在 GENERATING 阶段中断",
  "resultUrl": null,
  "assets": [
    { "id": 101, "slotIndex": 0, "url": "/files/assets/7c9e….jpg" },
    { "id": 102, "slotIndex": 1, "url": "/files/assets/1b4e….png" }
  ],
  "stages": [
    { "stage": "CHECKING",   "status": "SUCCEEDED", "startedAt": "…", "finishedAt": "…", "message": null },
    { "stage": "GENERATING", "status": "FAILED",    "startedAt": "…", "finishedAt": "…", "message": "模拟生成失败：…" }
  ],
  "createdAt": "2026-11-04T08:30:15.000Z",
  "startedAt": "2026-11-04T08:30:15.120Z",
  "finishedAt": "2026-11-04T08:30:21.300Z",
  "updatedAt": "2026-11-04T08:30:21.300Z"
}
```

| 字段 | 说明 |
|---|---|
| `status` | 整体状态，见 §0.4 |
| `stage` | 当前（或最后到达的）阶段；`PENDING` 时为 `null` |
| `failedStage` | 仅当 `FAILED` 且失败发生在某个阶段时有值；服务重启中断时为中断时的阶段；未开始就失败（线程池拒绝、PENDING 被中断）时为 `null` |
| `failureReason` | 面向用户的失败原因，仅 `FAILED` 时有值 |
| `resultUrl` | 仅 `SUCCEEDED` 时有值，可直接作为 `<img src>` |
| `stages` | 已经开始的阶段的执行记录，按执行顺序排列；没开始的阶段不出现 |
| `startedAt` / `finishedAt` | 第一个阶段开始的时间 / 进入终态的时间，可能为 `null` |

### 5.2 `POST /api/tasks` 提交制作任务

请求：

```json
{ "templateId": "demo-postcard", "assetIds": [101, 102] }
```

`assetIds` 的顺序就是上传位的顺序（`slotIndex`）。

服务端校验：

1. 模板存在，否则 `404`。
2. `assetIds` 非空、无重复，长度等于 `requiredImageCount`，否则 `400`。
3. 每个素材都属于**当前用户**，并且是为**该模板**上传的，否则 `400`（"素材无效或不属于当前用户"）。
4. 素材文件仍然存在。

通过后创建 `PENDING` 任务，事务提交后投递到后台线程池，**立即返回**，不等待制作完成。

`202 Accepted`，响应头 `Location: /api/tasks/42`，响应体为 TaskDTO（此时 `status=PENDING`，`stage=null`，`stages=[]`）。

### 5.3 `GET /api/tasks/{id}` 查询单个任务

**只读**，不会推进任务。终态任务无论查询多少次，返回内容都不变。

`200` → TaskDTO；`404` → 不存在或不属于当前用户。

前端用它轮询未完成的任务。

### 5.4 `GET /api/tasks` 个人任务列表 / 历史

| 查询参数 | 默认 | 说明 |
|---|---|---|
| `active` | `false` | `true`：只返回 `PENDING/RUNNING` 的任务，不分页（用于刷新后恢复跟踪） |
| `page` | `1` | 从 1 开始，`active=true` 时忽略 |
| `size` | `20` | 1–100，`active=true` 时忽略 |

只返回当前用户的任务，按 `createdAt` 倒序。

`active=false` 时返回 `200`：

```json
{ "items": [ /* TaskDTO（不含 stages，以减少数据量） */ ], "page": 1, "size": 20, "total": 57 }
```

`active=true` 时返回 `200`：`{ "items": [ /* TaskDTO（不含 stages） */ ] }`

> 列表项省略 `stages`（为 `null`），需要阶段明细时调用 `GET /api/tasks/{id}`。列表中仍有 `stage` / `failedStage`，足够展示当前阶段。

---

## 6. 静态资源

| 路径 | 来源 | 鉴权 |
|---|---|---|
| `/demo/**` | `classpath:static/demo/`（模板封面、示例结果图） | 公开，不签名 |
| `/files/assets/{uuid}.{ext}?exp=…&sig=…` | `${APP_STORAGE_DIR}/assets/` | 公开但需签名 URL；签名错误/过期返回 404 |
| `/files/results/{uuid}.{ext}?exp=…&sig=…` | `${APP_STORAGE_DIR}/results/` | 同上 |

> 接口返回的 `AssetDTO.url`、`TaskDTO.assets[].url`、`TaskDTO.resultUrl` 都已带 `exp` 和 `sig`；数据库只保存未签名路径。签名在同一整点时间窗口内稳定（`exp` 取下一个整点再加 1 小时），因此前端轮询不会让 `<img>` 反复重载。签名密钥来自 `APP_FILES_SIGNING_SECRET`，未配置时启动随机生成。`/files/**` 响应使用 `Cache-Control: private`。

---

## 7. 开发接口（模拟控制，R-06）

仅当 `app.simulation.dev-api-enabled=true` 时可用，否则返回 `404 DEV_API_DISABLED`。不需要 `X-User-Id`。不在正式页面中暴露。

### `GET /api/dev/simulation`

```json
{ "failStage": "NONE", "stageDelayMs": 3000 }
```

### `PUT /api/dev/simulation`

请求体字段都是可选的，只更新传入的字段：

```json
{ "failStage": "GENERATING", "stageDelayMs": 5000 }
```

| 字段 | 取值 |
|---|---|
| `failStage` | `NONE` / `CHECKING` / `GENERATING` / `FINALIZING` |
| `stageDelayMs` | 0–60000 |

`200` → 更新后的完整配置。只影响**之后提交**的任务（配置在受理时快照到任务上）。

演示示例：

```bash
# 让之后提交的任务在“模拟生成”阶段失败，每阶段耗时 5 秒
curl -X PUT http://localhost:8080/api/dev/simulation \
  -H 'Content-Type: application/json' \
  -d '{"failStage":"GENERATING","stageDelayMs":5000}'

# 恢复为全部成功
curl -X PUT http://localhost:8080/api/dev/simulation \
  -H 'Content-Type: application/json' -d '{"failStage":"NONE"}'
```

---

## 8. 典型调用时序

```
前端                                           后端
 │ GET /api/templates/demo-postcard ─────────▶ │
 │ POST /api/assets (slot 0) ────────────────▶ │ 校验+落盘 → 201 {id:101}
 │ POST /api/assets (slot 1) ────────────────▶ │ 校验+落盘 → 201 {id:102}
 │ POST /api/tasks {assetIds:[101,102]} ─────▶ │ 校验+建任务(PENDING) → 202 {id:42}
 │                                             │   └─(提交后)→ 线程池: CHECKING → GENERATING → FINALIZING
 │ GET /api/tasks/42 (每 1.5s) ──────────────▶ │ 只读 → RUNNING / GENERATING
 │ GET /api/tasks/42 ────────────────────────▶ │ 只读 → SUCCEEDED + resultUrl   → 前端停止跟踪
 │ (刷新页面) GET /api/tasks?active=true ─────▶ │ → 恢复跟踪未完成的任务
```
