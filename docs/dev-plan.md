# 开发计划与需求追踪

> 配套文档：[architecture.md](architecture.md)（设计）、[api.md](api.md)（接口）、[database.md](database.md)（表结构）。
> 每个里程碑完成并通过验证（根 CLAUDE.md §3）后，再按 §7 的流程提议提交。

## 1. 里程碑与任务拆分

| # | 里程碑 | 主要产出 | 验证 | 建议提交 |
|---|---|---|---|---|
| M0 | 设计文档 | `docs/*.md` | 人工评审 | `docs(docs): 添加设计、接口与数据库文档` |
| M1 | 后端脚手架 | Spring Boot + MyBatis + mvnw，`/api/health`，统一错误处理，H2 测试配置 | `./mvnw clean verify` | `build(backend): 初始化 Spring Boot 工程` |
| M2 | 数据库与模板接口 | schema.sql / data.sql，演示图片，分类/模板/用户接口，`X-User-Id` 拦截器 | 接口测试 + 用户拦截测试 | `feat(backend): 模板与用户接口` |
| M3 | 素材上传 | `POST /api/assets`、魔数识别、本地存储、`/files/**` | 校验测试（类型伪造、超大、空文件） | `feat(backend): 素材上传与校验` |
| M4 | 任务流水线 | 受理接口、线程池、三阶段 Runner、模拟配置、dev API、启动清理、查询接口 | 阶段顺序 / 失败中断 / 终态 / 隔离测试 | `feat(backend): 三阶段异步任务流水线` |
| M5 | 前端脚手架 | Next.js + TS strict + ESLint + Vitest，脚本 `lint/typecheck/test/build`，API client，类型定义 | 四条命令 | `build(frontend): 初始化 Next.js 工程` |
| M6 | 列表与身份 | 顶栏、身份切换器、分类筛选、模板卡片、加载/空/错误状态 | lint/typecheck/test/build | `feat(frontend): 模板列表与身份切换` |
| M7 | 详情与上传 | 详情页、上传位（预览/替换/移除/上传中/失败）、前端校验、404 页 | 上传位 reducer 测试 | `feat(frontend): 模板详情与素材上传` |
| M8 | 任务状态管理 | taskReducer、taskTracker、TaskProvider，提交流程，任务卡片与阶段条 | 多任务互不串扰 / 查询异常测试 / 生命周期测试 | `feat(frontend): 多任务跟踪与查询异常恢复` |
| M9 | 历史页 | 分页历史、结果预览对话框、刷新恢复 | 测试 + 手动刷新验证 | `feat(frontend): 历史记录与结果预览` |
| M10 | 容器化 | 两个 Dockerfile、docker-compose.yml、`.env.example` | `docker compose up --build` 冒烟 | `build(docker): 一键启动编排` |
| M11 | CI | `.github/workflows/ci.yml` | 推送后 Actions 全绿（需用户推送） | `ci: 前后端检查流水线` |
| M12 | README 与验收 | README 覆盖 R-13 全部条目，§3 逐项打勾 | 对照清单 | `docs: 完善 README` |

顺序上先做后端（M1–M4），这样前端开发时可以对接真实接口。M5 可以和 M3/M4 并行。

## 2. 需求追踪矩阵

| 需求 | 设计 | 实现位置（计划） | 验证方式 |
|---|---|---|---|
| R-01 技术栈与职责 | arch §2–3 | 全仓库 | README 版本表；业务全在 Java |
| R-02 列表与模拟数据 | api §3, db §4 | `TemplateController`、`app/page.tsx` | 切换分类，数据来自接口 |
| R-03 详情、上传、校验 | arch §7, api §4 | `AssetService`、`UploadSlot` | 后端校验测试；手动演示伪造文件 |
| R-04 受理与异步 | arch §6.1–6.2 | `TaskService.submit`、`taskPipelineExecutor` | 测试：提交后立即返回 PENDING；关闭页面后任务仍完成 |
| R-05 多步骤与查询 | arch §5–6.3, db §3 | `TaskPipelineRunner`、`task_stage_logs` | 顺序测试；查询只读测试 |
| R-06 失败与模拟控制 | arch §6.4, api §7 | `SimulationProperties`、`DevSimulationController` | 三个阶段的失败测试；README 中的 curl 演示 |
| R-07 状态与请求异常 | arch §8.3–8.4 | `uploadSlotReducer`、`taskReducer` | 前端“查询异常 ≠ 失败”测试 |
| R-08 多任务与生命周期 | arch §8.4 | `taskTracker` | 前端串扰测试、停止轮询测试、dispose 测试 |
| R-09 刷新恢复与历史 | arch §8.4, api §5.4 | `GET /api/tasks?active=true`、`/history` | 处理中刷新页面，任务继续更新 |
| R-10 身份与个人记录 | arch §4 | `UserInterceptor`、`UserSwitcher` | 后端隔离测试；切换用户后看不到他人任务 |
| R-11 界面与可访问性 | arch §8.5 | components | 键盘操作、小屏检查 |
| R-12 CI 与测试 | arch §9–10.4 | `ci.yml`、测试代码 | Actions 运行记录 |
| R-13 交付说明 | — | README | §3 清单 |
| R-14 容器交付 | arch §10.3 | Compose | `docker compose up --build` |

## 3. 演示脚本（README 会采用）

1. **成功**：`docker compose up --build` → 打开 `http://localhost:3000` → 选择“旅行明信片” → 上传 2 张图片 → 提交 → 卡片依次显示 素材检查 → 模拟生成 → 结果整理 → 成功并显示结果图。
2. **指定阶段失败**：执行 `curl -X PUT …/api/dev/simulation -d '{"failStage":"GENERATING"}'`，再提交任务 → 任务在“模拟生成”阶段失败，显示原因，“结果整理”标记为未执行。改成 `CHECKING`、`FINALIZING` 后可以重复演示。
3. **调整耗时**：`{"stageDelayMs":10000}` → 处理中的状态会保持更长时间，方便观察。
4. **多任务**：连续提交 4 个任务 → 线程池并发数为 2，可以看到 2 个在运行、2 个在排队（PENDING），各自独立推进。
5. **刷新恢复**：任务处理中按 F5 → 页面从 `GET /api/tasks?active=true` 恢复，继续跟踪；历史页显示所有记录。
6. **查询异常**：任务处理中执行 `docker compose stop backend` → 任务卡片显示“状态暂时无法获取”，但仍保持处理中，没有变成失败；执行 `docker compose start backend` 后点击“重新查询”恢复。（注意：后端重启会使正在执行的任务被启动清理标记为“服务重启，任务已中断”，这正好用来说明重启不恢复的边界。也可以改用浏览器开发者工具的离线模式演示，不影响后端。）
7. **用户隔离**：Alice 提交任务 → 切换到 Bob → 历史为空；用 Bob 的 `X-User-Id` 通过 curl 查询 Alice 的任务 ID，返回 404。

## 4. 风险与取舍（README 会讨论）

| 项 | 取舍 |
|---|---|
| 服务重启 | 不续跑。启动时把未完成的任务标记为失败，避免永远处于处理中 |
| 受理幂等 | 不实现 `Idempotency-Key`。前端通过禁用按钮防止重复提交；后端如需扩展，可以给 `tasks` 增加唯一键 `(user_id, client_request_id)` |
| 自动重试 | 不实现。失败即为终态 |
| 身份 | 请求头身份可伪造，仅作演示；接口层的隔离逻辑与鉴权方式无关，以后可以替换 |
| 文件访问控制 | `/files/**` 依靠 UUID 不可猜测，不做鉴权；生产环境可以改为签名 URL |
| 孤儿素材 | 上传了但没有提交的素材不清理；可以扩展为定时清理 |
| 测试数据库 | H2 MySQL 模式，与 MySQL 有少量差异；由 Compose 冒烟测试补充 |
| 轮询 vs SSE | 选择轮询，实现简单、容易测试，对无状态后端友好；任务数量少时开销可以接受 |

## 5. 交付前检查清单

- [ ] R-01 ~ R-14 逐项对照 §2
- [ ] 前端四条命令、后端 `./mvnw clean verify` 全部通过
- [ ] `docker compose up --build` 从零启动成功（全新数据卷）
- [ ] §3 的 7 个演示场景手动走一遍
- [ ] README：版本、结构、命令、配置、接口、状态/阶段、演示、身份、完成度/限制（含重启不恢复）、实际投入、部署回滚、AI 使用说明、素材来源
- [ ] 仓库中没有 `.mcp.json`、`.env`、真实凭据、`node_modules/`、`target/`、`uploads/`
- [ ] README 中记录验收 commit 哈希
