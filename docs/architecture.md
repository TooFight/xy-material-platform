# 总体设计文档

> 本文是开发前的设计基线，需求编号 R-xx 对应 [requirements.md](requirements.md)。
> 接口细节见 [api.md](api.md)，表结构见 [database.md](database.md)，任务拆分与测试计划见 [dev-plan.md](dev-plan.md)。
> 实现中如有偏离，先改本文档再改代码，最终结论同步到根 README。

## 1. 目标与范围

用户浏览模板 → 上传多张图片 → 提交制作任务 → 任务在 Java 后台按「素材检查 → 模拟生成 → 结果整理」三步异步执行 → 用户期间可以继续浏览网站，最后在历史页查看结果或失败原因。

不做：真实 AI、模板 CRUD 后台、登录密码/第三方账号、服务重启后自动续跑、重新制作/下载/删除。

## 2. 技术选型（计划版本）

| 层 | 选型 | 计划版本 | 说明 |
|---|---|---|---|
| 前端运行时 | Node.js | 22 LTS | Docker 与 CI 统一 |
| 前端框架 | Next.js (App Router) | 15.x | 生成脚手架时锁定具体小版本，写入 README |
| UI 库 | React | 19.x | 与 Next.js 15 配套 |
| 语言 | TypeScript | 5.x | `strict: true` |
| 前端测试 | Vitest + Testing Library | 最新稳定版 | 用假定时器测轮询逻辑 |
| 后端语言 | Java | 21 (LTS) | |
| 后端框架 | Spring Boot | 3.5.x | |
| ORM | mybatis-spring-boot-starter | 3.0.x | 3.0.x 对应 Spring Boot 3.x |
| 数据库 | MySQL | 8.4 LTS | |
| 后端测试 | JUnit 5 + Spring Boot Test + H2（MySQL 模式） | 随 Boot BOM | 详见 §9 |
| 构建 | Maven Wrapper (`./mvnw`)、npm（`package-lock.json`） | | |

样式选 CSS Modules（不引 UI 组件库，减少依赖和版本兼容问题）。客户端状态用 React Context + `useReducer`，不引 Redux/Zustand。

## 3. 系统架构

```
┌──────────────┐  HTTP(JSON / multipart)   ┌───────────────────────────┐   JDBC   ┌─────────┐
│  Browser     │ ────────────────────────▶ │  Spring Boot (8080)       │ ───────▶ │ MySQL   │
│  Next.js 页面 │  X-User-Id 请求头          │  Controller → Service     │          │ 8.4     │
│  (客户端渲染)  │ ◀──────────────────────── │  → MyBatis Mapper         │          └─────────┘
└──────┬───────┘   /files/** 图片           │  TaskPipeline (线程池)     │
       │ 页面/静态资源                        │  本地目录 / 数据卷 uploads │
┌──────▼───────┐                            └───────────────────────────┘
│ Next.js 服务  │ (3000)
└──────────────┘
```

- **前端直连 Java**：浏览器通过 `NEXT_PUBLIC_API_BASE_URL`（默认 `http://localhost:8080`）调用后端，后端按 `APP_CORS_ALLOWED_ORIGINS` 放行跨域并允许 `X-User-Id` 请求头。
  - 理由：所有业务数据都依赖当前用户（身份保存在浏览器），页面在客户端获取数据即可，不需要 Next.js 服务端转发；链路更短，问题更容易定位。
  - `NEXT_PUBLIC_*` 在构建时写入产物，Docker 中通过 build arg 传入。因为没有 SSR 拉数据，不需要单独的容器内地址；如果以后加 SSR，再增加 `API_INTERNAL_BASE_URL`。
- **Next.js 只负责页面与交互**。模板、素材、任务、历史的业务逻辑与持久化全部在 Java 中（R-01）。
- **图片访问**：
  - 模板封面、示例结果图：后端 `classpath:static/demo/`，URL 为 `/demo/**`。
  - 用户上传素材、任务结果：后端本地目录 `${APP_STORAGE_DIR}`（容器中挂数据卷），URL 为 `/files/**`。
  - 接口返回的是相对后端的路径（如 `/files/assets/3f2a….png`），前端用 `NEXT_PUBLIC_API_BASE_URL` 拼成完整地址。

## 4. 用户身份（R-10）

**方案：预置演示用户 + 请求头 `X-User-Id`，不需要密码。**

- 后端 `users` 表预置 3 个演示用户（如 Alice / Bob / Carol）。`GET /api/users` 公开返回列表，供前端选择身份。
- 除公开接口外，所有业务请求都必须带 `X-User-Id`。后端用 `HandlerInterceptor` 解析：缺失、格式错误或用户不存在时返回 `401 UNAUTHORIZED`，校验通过后把当前用户放进请求上下文（`CurrentUser`），Service 层只从这里取用户 ID。
- 前端右上角有身份切换器，当前身份保存在 `localStorage`（`xy.userId`）。首次访问时默认选第一个用户。
- 数据隔离由后端强制执行：素材、任务查询的 SQL 都带 `user_id = #{currentUserId}`。访问他人的任务或素材统一返回 `404`，不暴露资源是否存在。
- 已知限制（写入 README）：这是演示用的身份方案，请求头可以伪造，不提供真正的鉴权。生产环境应换成 Session/JWT，但接口层的用户隔离逻辑不用改。
- 图片 URL 的访问控制：`<img>` 无法携带自定义请求头，所以 `/files/**` 不校验身份，改为签名 URL。后端在把数据转成 DTO 时，对 `/files/**` 路径追加 `exp`（秒级时间戳）和 `sig`（对 `path + "\n" + exp` 做 HMAC-SHA256，再 base64url 编码）。`exp` 按整点时间窗口取整（下一个整点再加 1 小时），同一窗口内 URL 不变，避免轮询时 `<img>` 反复重载；签名错误或过期返回 404。密钥来自 `APP_FILES_SIGNING_SECRET`，未配置时启动随机生成，重启后旧链接失效。数据库只保存未签名路径。`/demo/**` 保持公开且不签名。这一点也在 README 中列为已知限制。

## 5. 任务模型（R-05）

### 5.1 状态与阶段分开表示

- `status`（整体状态）：`PENDING` 等待处理 → `RUNNING` 处理中 → `SUCCEEDED` 成功 / `FAILED` 失败
- `stage`（当前阶段）：`CHECKING` 素材检查 → `GENERATING` 模拟生成 → `FINALIZING` 结果整理

| status | stage | failedStage | resultUrl | 含义 |
|---|---|---|---|---|
| PENDING | null | null | null | 已受理，排队等待线程 |
| RUNNING | CHECKING / GENERATING / FINALIZING | null | null | 正在执行该阶段 |
| SUCCEEDED | FINALIZING | null | 有值 | 三步全部完成 |
| FAILED | 失败时所在阶段 | 同 stage | null | 在该阶段失败，后续阶段未执行 |
| FAILED | 中断时的阶段 | 同 stage | null | 服务重启中断；清理为失败，stage 保持不变 |
| FAILED | null | null | null | 尚未开始就失败（线程池拒绝、PENDING 被中断） |

前后端使用同一套枚举字面量，修改时两端同步（前端 `src/lib/types.ts`，后端 `TaskStatus` / `TaskStage`）。

### 5.2 状态迁移规则

```
PENDING ──start(CHECKING)──▶ RUNNING(CHECKING) ──▶ RUNNING(GENERATING) ──▶ RUNNING(FINALIZING) ──▶ SUCCEEDED
   │                               │                       │                       │
   └──────────────(任一处失败)────────┴───────────────────────┴───────────────────────┴──────────▶ FAILED
```

- 终态（`SUCCEEDED` / `FAILED`）不可回退。所有写状态的 SQL 都带条件 `WHERE status IN ('PENDING','RUNNING')`，影响行数为 0 时说明任务已经终结，流水线直接停止。
- **查询接口只读**：`GET` 只做 SELECT，不触发任何推进逻辑。

## 6. 后端异步流水线（R-04 / R-05 / R-06）

### 6.1 受理

`POST /api/tasks` 的处理流程：

1. 校验模板存在；`assetIds` 数量等于模板的 `requiredImageCount` 且没有重复；每个素材都属于当前用户、属于该模板，文件存在。
2. 在一个短事务中写 `tasks`（`PENDING`）和 `task_assets`，同时把当前的模拟配置快照写进任务行（`sim_fail_stage`、`sim_stage_delay_ms`）。
3. 事务提交后（`@TransactionalEventListener(phase = AFTER_COMMIT)`）把任务 ID 投递到线程池。
4. 立即返回 `202 Accepted` 和任务对象，不等待执行。

先提交事务再投递，是为了避免工作线程读到尚未提交的任务。模拟配置做快照，是为了让运行期间修改配置不影响已受理的任务，也便于测试中重复构造同样的场景。

### 6.2 执行器

- 使用独立的有界 `ThreadPoolTaskExecutor`（bean 名 `taskPipelineExecutor`）：`core=2, max=2, queue=100`，都可以配置。
- 并发数设得很小，是为了在多任务演示时能看到 `PENDING` 排队。
- 队列满时（`TaskRejectedException`）把该任务标记为 `FAILED`，原因为“系统繁忙，任务未能进入处理队列”；接口本身已经返回 202，这一点在 README 中说明。
- 关闭页面不影响执行：任务由服务端线程驱动，和 HTTP 连接无关。

### 6.3 阶段执行（`TaskPipelineRunner`）

```java
for (TaskStage stage : List.of(CHECKING, GENERATING, FINALIZING)) {
    if (!taskStore.enterStage(taskId, stage)) return;      // 条件更新失败 = 任务已终结
    stageLogStore.start(taskId, stage);
    try {
        simulator.delay(task.simStageDelayMs);              // 可配置耗时
        if (stage == task.simFailStage) throw new SimulatedStageFailure(stage);
        handlers.get(stage).execute(task);                  // 真实的阶段逻辑
        stageLogStore.succeed(taskId, stage);
    } catch (Exception e) {
        stageLogStore.fail(taskId, stage, reasonOf(e));
        taskStore.fail(taskId, stage, reasonOf(e));         // 写 failed_stage + failure_reason
        return;                                             // 后续阶段不再执行
    }
}
taskStore.succeed(taskId, resultUrl);
```

- 阶段开始时更新 `tasks.status='RUNNING'`、`tasks.stage`、`started_at`、`updated_at`，并写入 `task_stage_logs` 的 `RUNNING` 记录；阶段结束时只更新 `task_stage_logs.status` 和 `finished_at`，**不更新 tasks 行**。任务进入终态（成功或失败）时，才更新 `tasks.finished_at`、`result_url` 或 `failed_stage`/`failure_reason`。不使用包住整条流水线或 `sleep` 的大事务。
- 三个阶段的实际内容（不处理图片，但每步都有可观察的副作用）：
  - `CHECKING`：重新读取任务关联的素材，确认文件存在、大小和类型与记录一致。
  - `GENERATING`：模拟生成，在指定耗时后得到一个“生成产物标识”（使用模板预置的示例结果图）。
  - `FINALIZING`：把示例结果图复制到 `${APP_STORAGE_DIR}/results/{uuid}.png`，然后写入 `result_url`。
- 失败原因使用面向用户的中文，例如“素材检查未通过：模拟失败（CHECKING）”；异常堆栈只写日志，不返回给前端。

### 6.4 模拟控制（R-06）

配置项（`application.yml`，可用环境变量覆盖）：

| 属性 | 环境变量 | 默认值 | 说明 |
|---|---|---|---|
| `app.simulation.fail-stage` | `APP_SIMULATION_FAIL_STAGE` | `NONE` | `NONE` / `CHECKING` / `GENERATING` / `FINALIZING` |
| `app.simulation.stage-delay-ms` | `APP_SIMULATION_STAGE_DELAY_MS` | `3000` | 每个阶段的模拟耗时 |
| `app.simulation.dev-api-enabled` | `APP_SIMULATION_DEV_API_ENABLED` | `false`（Compose 中为 `true`） | 是否开放运行时修改接口 |

- 开启 dev API 后，可以通过 `PUT /api/dev/simulation` 在运行时修改上面两个值，不需要重启（见 api.md §7）。后续提交的任务会使用新配置，可重复触发。
- 模拟开关不出现在正式页面和模板字段里。前端可以提供一个仅在开发环境显示的说明，但不提供操作入口。
- 不使用随机失败。

### 6.5 服务重启（已知边界）

不做断点续跑。为避免任务永远停在“处理中”，应用启动时执行一次清理，只处理 `created_at` 早于本次启动时刻的 `PENDING` / `RUNNING` 任务，避免误杀启动后新提交的任务。清理在同一个事务里：

- 把这些任务标记为 `FAILED`，`failed_stage` 取任务当时的 `stage`（PENDING 任务的 stage 为 null，所以 failed_stage 也为 null），`stage` 字段保持不变；
- 把对应 `task_stage_logs` 中 `status='RUNNING'` 的记录改为 `FAILED`，`message` 写“服务重启，任务已中断”，并填上 `finished_at`。

清理只终结任务，不会恢复执行。README 会如实说明这一点。

## 7. 素材上传与校验（R-03）

- **逐张上传**：每个上传位单独调用 `POST /api/assets`（multipart，字段为 `file` 和 `templateId`），成功后返回 `assetId` 和可访问的 URL。提交任务时只传 `assetIds`，不使用浏览器临时地址。
- **服务端校验**（以模板定义为准）：
  - 大小：`0 < size ≤ template.maxFileSizeBytes`。Spring 的 multipart 全局上限设为 10MB 作为兜底，超过时返回 413。
  - 类型：读取文件头魔数识别实际类型（JPEG `FF D8 FF`、PNG `89 50 4E 47 0D 0A 1A 0A`、WebP `RIFF....WEBP`），识别结果必须在 `template.acceptedMimeTypes` 中。不信任 `Content-Type` 和扩展名。
  - 存储名：`{uuid}.{按实际类型决定的扩展名}`。原始文件名只截断后存入 `original_filename` 用于展示，不参与路径拼接。
- **前端预校验**（体验层）：在选择文件时就检查数量、类型、大小并即时提示，但最终以服务端结果为准。

## 8. 前端设计（R-02, R-03, R-07 ~ R-09, R-11）

### 8.1 路由

| 路由 | 内容 |
|---|---|
| `/` | 分类标签 + 模板卡片网格，分类用 `?category=` 表示（刷新后保留选择） |
| `/templates/[id]` | 模板详情、素材要求、上传位、提交按钮、本页提交的任务卡片 |
| `/history` | 个人历史任务列表：创建时间、状态、阶段、结果预览（对话框放大）、失败原因 |
| 全局布局 | 顶栏：导航、身份切换器、“N 个任务处理中”标记 |

### 8.2 目录规划

```
frontend/src/
  app/                    # 路由：layout.tsx, page.tsx, templates/[id]/page.tsx, history/page.tsx
  components/             # TemplateCard, UploadSlot, TaskCard, StageSteps, UserSwitcher, ImagePreviewDialog ...
  lib/
    api/                  # client.ts（fetch 封装、ApiError）、templates.ts、assets.ts、tasks.ts、users.ts
    types.ts              # 与后端一致的 DTO 和枚举
    tasks/
      taskReducer.ts      # 纯函数：任务表的合并规则（可单测）
      taskTracker.ts      # 轮询调度器：注入 fetch/定时器（可单测）
      TaskProvider.tsx    # Context：把 reducer 和 tracker 接到 React
    user/UserProvider.tsx
    upload/uploadSlotReducer.ts
  __tests__/ 或与源码同目录的 *.test.ts
```

### 8.3 三层状态，互不混用（R-07）

1. **上传位**（每个上传位独立）：`empty` → `uploading` → `uploaded` / `error`。保存 `file`、`previewUrl`（ObjectURL）、`asset`（服务端返回）、`error`。替换或移除时 `revokeObjectURL`，组件卸载时统一释放。上传中的请求在移除或卸载时 abort。
2. **表单提交**：`submitting: boolean`，只在提交请求返回前为 true。所有上传位都是 `uploaded`，且当前不在提交中，提交按钮才可用。
3. **任务**（来自后端）：`PENDING / RUNNING / SUCCEEDED / FAILED` + `stage`。收到 202 后立刻把任务加入任务表，上传位清空，按钮恢复，页面显示该任务卡片。

### 8.4 任务表与轮询（R-07 / R-08 / R-09）

任务表是全局 Context（挂在根布局里），所以用户切换页面时跟踪不会中断：

```ts
type TrackedTask = {
  task: TaskDTO;              // 最近一次成功拿到的服务端数据
  syncError: ApiError | null; // 最近一次查询失败的信息（请求异常，不是任务失败）
  consecutiveErrors: number;
  paused: boolean;            // 连续失败达到上限后暂停自动跟踪，等待手动“重新查询”
};
state = { userId, byId: Record<number, TrackedTask>, order: number[] }
```

合并规则（`taskReducer`，纯函数，重点测试）：

- 按任务 ID 更新，只修改对应条目，其他任务不受影响。
- **单调性保护**：已经是终态的任务，不会被非终态数据覆盖（防止乱序的旧响应把成功改回处理中）。
- **查询失败** → 只设置 `syncError` 并让 `consecutiveErrors++`，`task.status` 保持不变，**不会变成 FAILED**。
- **查询成功** → 清空 `syncError`，计数归零。
- **用户隔离**：每个 action 都带 `userId`，和当前 `state.userId` 不一致时直接丢弃。

轮询调度（`taskTracker`）：

- 只跟踪 `PENDING/RUNNING` 且没有 `paused` 的任务。每隔 1.5s 对这些任务逐个执行 `GET /api/tasks/{id}`，每个请求都有自己的 `AbortController`。
- 上一轮请求全部完成后才安排下一轮（`setTimeout` 链，而不是 `setInterval`），避免请求堆积。
- 任务进入终态后不再请求它；没有需要跟踪的任务时不安排定时器。有新任务加入时重新启动。
- 连续 3 次查询失败后暂停该任务的自动跟踪。界面显示“状态暂时无法获取，已保留上次结果”，并提供“重新查询”按钮。
- 切换用户：根据 `userId` 重建 Provider。旧的 tracker 调用 `dispose()` 中止所有请求、清除定时器；即使有迟到的响应，也会因为 `userId` 不一致被 reducer 丢弃。
- 组件卸载、离开页面：组件内的订阅和请求在 effect cleanup 中释放。

刷新恢复：Provider 挂载时调用 `GET /api/tasks?active=true` 拉取所有未完成任务并开始跟踪；历史页另外分页拉取全部任务并合并进任务表。所有恢复数据都来自后端，不依赖 `localStorage` 中的任务数据。

### 8.5 界面反馈

- 列表页和详情页都要处理：加载中（骨架屏）、空数据、请求失败（带重试按钮）、模板不存在（404 时显示专门的页面并给出返回列表的链接）。
- 任务卡片：用阶段步骤条显示三个阶段（已完成 / 进行中 / 失败 / 未开始）、状态标签、失败原因、结果缩略图（点击后在 `<dialog>` 中预览）。
- 可访问性：上传位使用 `<label>` 包裹隐藏的 `<input type="file">`，并提供 `aria-label`（“上传第 2 张图片”）；图标按钮带 `aria-label`；保留 `:focus-visible` 样式；状态变化区域使用 `aria-live="polite"`。
- 小屏：卡片网格使用 `auto-fill` 自适应；详情页在 768px 以下改为上下排列。

## 9. 测试策略（R-12）

| 端 | 重点 | 方式 |
|---|---|---|
| 后端 | 阶段顺序 CHECKING→GENERATING→FINALIZING | 运行流水线（耗时 0，同步执行器），断言 `task_stage_logs` 的顺序和时间 |
| 后端 | 指定阶段失败后停止 | 分别注入三个阶段的失败：断言 `failed_stage` 与原因、后续阶段没有日志、`result_url` 为空 |
| 后端 | 终态不可变 | 任务完成后多次 GET，状态不变；对终态任务调用 `enterStage` 返回 false |
| 后端 | 用户隔离 | 用户 B 查询用户 A 的任务返回 404；列表中不包含他人任务；不能引用他人的素材提交任务 |
| 后端 | 上传校验 | 伪造扩展名、超大文件、数量不符、未知模板 |
| 前端 | 多任务互不串扰 | reducer/tracker 单测：两个任务乱序返回，各自状态正确 |
| 前端 | 查询异常 ≠ 任务失败 | 模拟 fetch 抛错或返回 503：任务仍是 RUNNING，`syncError` 有值；恢复后继续更新 |
| 前端 | 生命周期 | 终态后停止请求；没有活跃任务时没有定时器；dispose 和切换用户后迟到的响应被丢弃 |

后端测试数据库：H2（`MODE=MySQL`），保证 `./mvnw clean verify` 不依赖 Docker，在本地和 CI 都能直接运行。代价是 SQL 必须使用 H2 和 MySQL 都支持的子集。容器中的 MySQL 通过 Compose 冒烟验证。

## 10. 配置与部署

### 10.1 配置项（写入 `.env.example`，不包含真实凭据）

| 变量 | 使用方 | 示例 |
|---|---|---|
| `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | mysql | `xy_material` / `xy` / `change-me` / `change-me-root` |
| `SPRING_DATASOURCE_URL` | backend | `jdbc:mysql://mysql:3306/xy_material?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC` |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | backend | 同上 |
| `APP_STORAGE_DIR` | backend | `/data/uploads` |
| `APP_CORS_ALLOWED_ORIGINS` | backend | `http://localhost:3000` |
| `APP_SIMULATION_*` | backend | 见 §6.4 |
| `NEXT_PUBLIC_API_BASE_URL` | frontend（构建时） | `http://localhost:8080` |

### 10.2 数据库初始化

使用 `backend/src/main/resources/db/schema.sql` 和 `data.sql`，由 Spring `spring.sql.init.mode=always` 在启动时执行。脚本是幂等的（`CREATE TABLE IF NOT EXISTS`；种子数据按主键先删除再插入，或使用 `INSERT IGNORE`），本地和 Compose 走同一条初始化路径。

### 10.3 Docker Compose（R-14）

- `mysql`：`mysql:8.4`，带 healthcheck，数据卷 `mysql-data`。
- `backend`：多阶段构建（`maven:3.9-eclipse-temurin-21` 构建 → `eclipse-temurin:21-jre` 运行），`depends_on: mysql (service_healthy)`，数据卷 `uploads:/data/uploads`，端口 8080。
- `frontend`：多阶段构建（`node:22-alpine`，Next.js `output: 'standalone'`），build arg `NEXT_PUBLIC_API_BASE_URL`，端口 3000。
- 部署与回滚：按 git tag 或 commit 构建镜像；回滚时切回上一个 commit，执行 `docker compose up --build -d`。数据卷保留，schema 只做增量、向后兼容的修改。

### 10.4 CI（R-12）

`.github/workflows/ci.yml`，在 push 和 pull_request 时触发，包含两个 job：

- `frontend`：`npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- `backend`：`./mvnw -B clean verify`
