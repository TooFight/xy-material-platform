# CLAUDE.md (Root Level)

@docs/requirements.md

## 1. 项目概览与结构 (WHAT)
- **项目名称**：素材制作网站（Material Production Website）。
- **架构模式**：前后端分离 Monorepo 结构。
  - `./frontend`：Next.js App Router + React + TypeScript（详见 `frontend/CLAUDE.md`）
  - `./backend`：Java + Spring Boot + MyBatis + MySQL（详见 `backend/CLAUDE.md`）
  - `./docker-compose.yml`：容器化一键编排（前端、后端、MySQL、初始化数据）
  - `./.github/workflows/`：CI 配置（push / pull request 触发）
  - `./docs/requirements.md`：笔试题原文（R-01 ~ R-14 的编号出处）
  - `./README.md`：交付说明（见第 5 节）
  - `./.env.example`：无真实凭据的配置示例

## 2. 核心业务目标 (WHY)
实现一个独立的素材制作闭环系统：用户浏览模板、上传多图、提交异步制作任务，并在后台处理期间继续使用网站，最后查看历史记录和制作结果。生成过程为可控耗时、可控成败的模拟器，不调用真实 AI。

## 3. 全局构建、测试与运行命令 (HOW)
- **一键启动 (Docker Compose)**：
  ```bash
  docker compose up --build
  ```
- **全局 CI 检查**（本地与 GitHub Actions 必须执行同一组命令）：
  - 前端（在 `frontend/`）：`npm run lint && npm run typecheck && npm test && npm run build`
  - 后端（在 `backend/`）：`./mvnw clean verify`（含测试与打包）

## 4. 跨端约定
- **用户身份 (R-10)**：前后端统一方案（默认：请求头 `X-User-Id` + 后端用户表，无需密码登录）。最终方案写入 README。
- **数据隔离**：任务、历史、素材的读写都必须绑定当前用户，后端强制校验，不信任前端。
- **状态模型**：任务整体 `status`（PENDING / RUNNING / SUCCEEDED / FAILED）与当前 `stage`（CHECKING / GENERATING / FINALIZING）分开表示，前后端使用同一套枚举值，修改时两端同步。
- **版本**：Next.js、React、Spring Boot、Java、MyBatis starter、MySQL 版本选定后写入 README，且须互相兼容。

## 5. 交付规则
- 维护 `README.md`，须覆盖 R-13 全部条目：版本、结构、命令、配置、接口、状态/阶段、演示方法（成功/指定阶段失败/调耗时/多任务/刷新恢复）、身份方案、完成度与已知限制（含“重启不恢复”）、实际投入、部署与回滚、AI 使用说明、素材来源。
- 提供数据库 `schema.sql` 与种子数据、本地示例图片（不依赖付费或内部服务）。
- 仓库中不得出现真实密钥或凭据；配置用 `.env.example` 示例。`.mcp.json` 含 API key，必须保持在 `.gitignore` 中。
- 交付前对照 `docs/requirements.md` 中的 R-01 ~ R-14 逐项确认。

## 6. AI 协作执行原则 (Agent Workflow)
- **先读后写 (Understand First)**：修改或编写代码前，必须先搜索相关文件并理解现有上下文，禁止盲目修改。
- **渐进式方案 (Plan for Complex Tasks)**：
  - 简单任务（如小组件、单个接口调整）：直接实现并说明变更。
  - 复杂任务（如：后端异步任务流水线、多步骤状态机、前端多任务轮询与异常恢复）：先输出简要的设计思路与变更文件列表。
- **安全与边界 (Safety Bounds)**：
  - 允许执行 `git commit`，但**每次提交前必须先征求我的同意**，见第 7 节；未经同意不得提交。
  - 绝对禁止 `git push`、强制覆盖历史（`--force`、`reset --hard`、`commit --amend` 已提交内容）、改写远程，除非我明确要求。
  - 每次修改后，必须运行对应端的验证命令（见第 3 节）；脚手架尚未生成、命令不可用时，说明原因而不是跳过不提。

## 7. Git 提交规范
- **提交流程（每次都要走完，缺一不可）**：
  1. 先验证：运行对应端的验证命令（第 3 节）并通过；脚手架尚未生成时说明原因。
  2. 再汇报：运行 `git status` 与 `git diff --stat`，向我列出将提交的文件、拟定的提交信息和提交理由。
  3. 等我明确同意后才执行 `git add` 与 `git commit`。我的同意只对这一次提交有效，不延续到下一次。
- **提交时机**（满足其一时，主动提出“是否提交”，而不是自行提交）：
  - 一个完整的小功能或修复完成，且验证通过（例如：一个接口、一个页面、一条流水线阶段、一组测试）。
  - 重构或配置调整完成，行为不变且验证通过。
  - 即将开始大范围改动前，需要一个可回退的检查点。
  - 不在验证失败、代码半成品、构建红灯时提议提交。
- **提交粒度**：一次提交只做一类事（功能 / 修复 / 重构 / 文档 / 配置不混在一起），小而完整、能独立构建；前后端可分开提交。
- **提交信息**：采用 Conventional Commits：`<type>(<scope>): <简述>`。
  - type：`feat` `fix` `refactor` `test` `docs` `build` `ci` `chore`。
  - scope：`frontend` / `backend` / `docker` / `docs` 等。
  - 简述不超过约 50 个字符，说明做了什么；需要时空一行写正文，解释为什么。
  - 示例：`feat(backend): 实现三阶段异步任务流水线`。
- **暂存规则**：用 `git add <具体文件>` 指定文件，不使用 `git add .` / `-A`。提交前确认暂存区没有 `.mcp.json`、`.env`、密钥、`node_modules/`、`target/`、`uploads/`。
- **提交后**：运行 `git log --oneline -3` 展示结果；README 中记录验收 commit 时使用最终的提交哈希。
