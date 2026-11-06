# 素材制作平台（xy-material-platform）

一个可以独立运行的素材制作网站演示：浏览模板 → 上传多张图片 → 提交制作任务 → Java 后端按「素材检查 → 模拟生成 → 结果整理」三步异步执行 → 在历史页查看结果或失败原因。

生成过程是**可控耗时、可控成败的模拟器**，不调用真实 AI，也不做真实图片处理。模板封面、示例结果图和测试素材均由仓库内脚本生成，见 [§16](#16-素材脚手架与开源来源)。

> 需求原文：[docs/requirements.md](docs/requirements.md)（R-01 ~ R-14）
> 设计基线：[docs/architecture.md](docs/architecture.md) · [docs/api.md](docs/api.md) · [docs/database.md](docs/database.md) · [docs/dev-plan.md](docs/dev-plan.md)
> 接口字段、枚举值、路径和状态码以 `docs/api.md` 为准。

---

## 目录

- [1. 快速开始](#1-快速开始)
- [2. 技术版本](#2-技术版本)
- [3. 项目结构](#3-项目结构)
- [4. 构建、测试与验证命令](#4-构建测试与验证命令)
- [5. 配置项](#5-配置项)
- [6. 数据库初始化、种子数据与素材](#6-数据库初始化种子数据与素材)
- [7. 前后端与数据库如何连接](#7-前后端与数据库如何连接)
- [8. 主要接口、任务状态与后台执行](#8-主要接口任务状态与后台执行)
- [9. 演示方法](#9-演示方法)
- [10. 用户身份方案](#10-用户身份方案)
- [11. 完成度（R-01 ~ R-14）](#11-完成度r-01--r-14)
- [12. 已知限制与取舍](#12-已知限制与取舍)
- [13. 部署与回滚](#13-部署与回滚)
- [14. 实际投入](#14-实际投入)
- [15. AI 使用说明](#15-ai-使用说明)
- [16. 素材、脚手架与开源来源](#16-素材脚手架与开源来源)
- [17. 验收版本](#17-验收版本)
- [18. 验证记录](#18-验证记录)

---

## 1. 快速开始

### 1.1 Docker Compose（推荐）

前置条件：Docker Engine / Docker Desktop，以及支持 `docker compose` 的 Compose v2。首次启动会拉取 `mysql:8.4`、`node:22-alpine`、`maven:3.9-eclipse-temurin-21` 和 `eclipse-temurin:21-jre` 等镜像。

```bash
# 仓库根目录
docker compose up --build
```

不需要先准备 `.env`；不创建 `.env` 时，`docker-compose.yml` 中的默认值可以直接跑通演示。需要改端口、密码或模拟默认值时，再执行：

```bash
cp .env.example .env
# 编辑 .env 后
docker compose up --build
```

启动完成后：

| 服务 | 地址 | 说明 |
|---|---|---|
| 前端 | <http://localhost:3000> | 模板列表、详情/上传、历史记录 |
| 后端 | <http://localhost:8080> | Java API；健康检查 `GET /api/health` |
| MySQL | `mysql:3306`（仅容器网络） | 不向宿主机暴露端口；数据在 `mysql-data` 卷 |

常用命令：

```bash
docker compose ps                 # 查看健康状态
docker compose logs -f backend    # 看后端日志
docker compose logs -f frontend   # 看前端日志
docker compose down               # 停止并删除容器，保留 mysql-data / uploads 卷
docker compose down -v            # 停止并删除容器和数据卷（会清空数据库与上传文件）
```

首次 `up` 需要等 MySQL healthcheck 通过（`start_period: 30s`），随后后端启动、前端构建/启动。前端镜像在 **build 时** 把 `NEXT_PUBLIC_API_BASE_URL` 内联进产物；如果要在另一台机器上访问，需要在启动前设置：

```bash
# 例：浏览器实际访问的是 192.168.1.20:8080
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.20:8080 \
APP_CORS_ALLOWED_ORIGINS=http://192.168.1.20:3000 \
docker compose up --build
```

修改 `NEXT_PUBLIC_API_BASE_URL` 后必须重新 `build`，只 `restart` 前端容器不会改变已内联的地址；`APP_CORS_ALLOWED_ORIGINS` 在容器启动时读取，重新 `up` 即可生效。

### 1.2 本地开发（不使用 Compose 跑后端）

本地开发需要：Node.js 22（`package.json` 要求 `>=22.13.0`，`.nvmrc` 为 `22`）、JDK 21、一个可从 `localhost:3306` 访问的 MySQL 8.4。Maven 不用单独安装，仓库自带 Wrapper。

**准备 MySQL**：Compose 里的 `mysql` 服务没有映射宿主机端口，因此本地跑后端时请使用本机 MySQL，或单独启动一个带端口映射的 MySQL 容器：

```bash
# 本机已有 MySQL 时，创建数据库和演示账号
mysql -u root -p -e "
  CREATE DATABASE IF NOT EXISTS xy_material
    CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
  CREATE USER IF NOT EXISTS 'xy'@'%' IDENTIFIED BY 'change-me';
  GRANT ALL PRIVILEGES ON xy_material.* TO 'xy'@'%';
  FLUSH PRIVILEGES;"

# 或者用 Docker 起一个映射 3306 的 MySQL（不使用 Compose 的 mysql 服务）
docker run --rm -d --name xy-material-mysql \
  -p 3306:3306 \
  -e MYSQL_DATABASE=xy_material \
  -e MYSQL_USER=xy \
  -e MYSQL_PASSWORD=change-me \
  -e MYSQL_ROOT_PASSWORD=change-me-root \
  -e TZ=UTC \
  mysql:8.4 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_0900_ai_ci
```

数据库和表不需要手工创建：后端启动时通过 `spring.sql.init` 执行 `schema.sql` 和 `data.sql`。

**启动后端**：

```bash
cd backend
./mvnw spring-boot:run
# Windows PowerShell / cmd：
# .\mvnw.cmd spring-boot:run
```

**启动前端**（另开终端）：

```bash
cd frontend
npm ci
cp .env.example .env.local   # 可选；不配置时默认 http://localhost:8080
npm run dev
```

打开 <http://localhost:3000>。

也可以“后端用容器、前端本地开发”：先 `docker compose up -d mysql backend`，再在 `frontend/` 执行 `npm run dev`。浏览器仍然访问 `http://localhost:8080`。

**本地连接参数**（与后台默认值一致）：

```text
MySQL:    jdbc:mysql://localhost:3306/xy_material
账号:     xy / change-me
存储目录: ./uploads（相对 backend/ 工作目录）
```

如使用别的地址或密码，用环境变量覆盖，例如：

```bash
cd backend
SPRING_DATASOURCE_URL='jdbc:mysql://127.0.0.1:3306/xy_material?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false' \
SPRING_DATASOURCE_USERNAME=xy \
SPRING_DATASOURCE_PASSWORD=change-me \
APP_SIMULATION_DEV_API_ENABLED=true \
./mvnw spring-boot:run
```

> `NEXT_PUBLIC_API_BASE_URL` 是 `NEXT_PUBLIC_*` 变量，Next.js 在 `next build` / `next dev` 启动时读取并内联进浏览器产物。修改 `.env.local` 后要重启 `npm run dev`；生产构建要重新 `npm run build` 或重新 `docker compose build`。

### 1.3 演示身份

首次打开页面时，前端调用 `GET /api/users` 获取预置用户，默认选中 Alice；点击右上角的头像按钮打开“账号设置”对话框，可以切换 Alice / Bob / Carol。当前身份保存在浏览器 `localStorage` 的 `xy.userId` 中。没有密码登录。

预置用户：

| id | username | displayName |
|---|---|---|
| 1 | alice | Alice |
| 2 | bob | Bob |
| 3 | carol | Carol |

---

## 2. 技术版本

版本以 `backend/pom.xml`、`backend/.mvn/wrapper/maven-wrapper.properties`、`frontend/package.json` 和 `frontend/package-lock.json` 为准。原设计计划中的 Next.js 15.x 在实现时锁定为当时的稳定版 16.4.5，`docs/architecture.md` §2 已同步。

| 层 | 技术 / 组件 | 锁定版本 | 说明 |
|---|---|---|---|
| 前端运行时 | Node.js | 22 | `.nvmrc` 22；Docker `node:22-alpine`；CI `node-version: 22`；`engines.node >=22.13.0` |
| 前端框架 | Next.js（App Router） | 16.4.5 | `output: "standalone"`，`reactStrictMode: true` |
| UI 库 | React / React DOM | 19.3.0 / 19.3.0 | 与 Next.js 16 配套 |
| 语言 | TypeScript | 5.9.3 | `strict: true` |
| 前端 Lint | ESLint / eslint-config-next | 9.39.5 / 16.4.5 | `npm run lint` |
| 前端测试 | Vitest / Testing Library React / jsdom | 5.1.0 / 16.3.3 / 29.1.1 | `npm test`；使用假定时器测试轮询 |
| 后端语言 | Java | 21（LTS） | CI 与 Docker 使用 Temurin 21 |
| 后端框架 | Spring Boot | 3.5.16 | `spring-boot-starter-web`、`spring-boot-starter-validation` |
| ORM | mybatis-spring-boot-starter | 3.0.5 | 3.0.x 对应 Spring Boot 3.x |
| 数据库 | MySQL | 8.4 LTS | Compose 镜像 `mysql:8.4` |
| JDBC 驱动 | mysql-connector-j | 9.7.0 | 与 MySQL 8.4 兼容 |
| 后端测试 | JUnit 5 / Spring Boot Test / H2 | H2 2.3.232 | H2 `MODE=MySQL`，测试不依赖 Docker |
| 构建 | Maven Wrapper / npm | Maven 3.9.14 / npm + `package-lock.json`（lockfileVersion 3） | Wrapper 配置见 `backend/.mvn/wrapper/maven-wrapper.properties` |

---

## 3. 项目结构

```text
xy-material-platform/
├── backend/                         # Java 21 + Spring Boot + MyBatis
│   ├── Dockerfile                   # 多阶段构建；运行镜像以非 root 用户运行
│   ├── pom.xml
│   ├── mvnw / mvnw.cmd / .mvn/      # Maven Wrapper
│   ├── scripts/GenDemoImages.java   # 生成演示封面、示例结果和测试素材（JDK AWT）
│   └── src/
│       ├── main/java/com/xy/material/
│       │   ├── asset/               # 上传、魔数识别、本地存储、/files/**
│       │   ├── common/              # 统一错误码与异常处理
│       │   ├── config/              # CORS、存储、线程池等配置
│       │   ├── files/               # /files/** 签名 URL
│       │   ├── health/              # GET /api/health
│       │   ├── task/                # 受理、流水线、阶段日志、查询、模拟控制、启动清理
│       │   ├── template/            # 分类 / 模板接口
│       │   └── user/                # X-User-Id、用户接口
│       ├── main/resources/
│       │   ├── application.yml
│       │   ├── db/schema.sql         # 表结构，幂等
│       │   ├── db/data.sql           # 3 用户 + 3 分类 + 7 模板，幂等
│       │   └── static/demo/          # 7 张封面 + 7 张示例结果图（PNG）
│       └── test/                     # JUnit 5 + Spring Boot Test + H2
├── frontend/                        # Next.js App Router + React + TypeScript
│   ├── Dockerfile                   # node:22-alpine 多阶段构建，standalone 运行
│   ├── package.json / package-lock.json
│   └── src/
│       ├── app/                     # /、/templates/[id]、/history
│       ├── components/              # 列表、详情、上传位、任务卡、用户切换器等
│       └── lib/
│           ├── api/                 # fetch 封装、ApiError、各资源 API
│           ├── tasks/               # reducer、轮询 tracker、TaskProvider
│           ├── upload/              # 上传位 reducer、文件预校验
│           ├── user/                # 身份 Provider
│           └── types.ts             # 与 docs/api.md 对齐的 DTO 和枚举
├── docs/
│   ├── requirements.md              # 题目原文（R-01 ~ R-14）
│   ├── architecture.md              # 设计基线
│   ├── api.md                       # 接口契约
│   ├── database.md                  # 表结构设计
│   ├── dev-plan.md                  # 里程碑、测试计划、交付检查清单
│   └── sample-images/               # 5 个上传测试素材（4 张真图 + 1 个假图片）
├── .github/workflows/ci.yml         # push / pull_request 触发的前后端 CI
├── docker-compose.yml               # frontend + backend + mysql + 数据卷
├── .env.example                     # Compose 配置示例（无真实凭据）
└── README.md
```

---

## 4. 构建、测试与验证命令

根 CLAUDE.md §3 规定的命令与 CI 使用同一组：

### 4.1 前端（在 `frontend/` 下）

```bash
npm ci
npm run lint
npm run typecheck     # tsc --noEmit；pretypecheck 会先执行 next typegen
npm test              # vitest run
npm run build         # next build，standalone 产物
```

也可以串起来执行：

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

- `npm run lint` 是 ESLint，`npm run typecheck` 是独立类型检查，两者都不能省略。
- 测试使用 Vitest + jsdom；覆盖任务表互不串扰、查询异常不等于任务失败、轮询生命周期、上传位、历史页恢复等。

### 4.2 后端（在 `backend/` 下）

```bash
./mvnw clean verify
# Windows PowerShell / cmd：
# .\mvnw.cmd clean verify

./mvnw test           # 只跑测试
./mvnw clean package -DskipTests   # 只打包，不能替代 verify
```

- 测试数据库为内存 H2（`MODE=MySQL`），不需要 Docker 或本地 MySQL。
- `clean verify` 包含编译、测试和打包；测试覆盖三阶段顺序、三个阶段分别失败后不再执行后续阶段、终态不可回退、查询只读、用户隔离、上传校验、签名 URL、启动清理等。

### 4.3 CI

`.github/workflows/ci.yml` 在 `push` 和 `pull_request` 时触发两个 job：

- `frontend`：Node 22，`npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- `backend`：Temurin 21，`./mvnw -B clean verify`

CI 配置已入库；仓库已推送到 `origin/main`，GitHub Actions 运行结果以 GitHub 页面为准（已全部通过）。本地/容器内的等价命令结果见 [§18](#18-验证记录)。

---

## 5. 配置项

### 5.1 Compose 配置

仓库根目录的 `.env.example` 是无真实凭据的示例。复制为 `.env` 后，`docker compose` 会用于变量插值；`.env` 已被 `.gitignore` 忽略。不创建 `.env` 时使用 `docker-compose.yml` 中的默认值。

| 变量 | 默认值 | 使用方 | 说明 |
|---|---|---|---|
| `MYSQL_DATABASE` | `xy_material` | mysql / backend | 数据库名；改这里时同步改 JDBC URL 中的库名 |
| `MYSQL_USER` | `xy` | mysql / backend | 应用数据库账号 |
| `MYSQL_PASSWORD` | `change-me` | mysql / backend | 示例密码，仅用于本地演示 |
| `MYSQL_ROOT_PASSWORD` | `change-me-root` | mysql | MySQL root 示例密码，仅用于本地演示 |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://mysql:3306/xy_material?...` | backend | Compose 内使用服务名 `mysql` |
| `SPRING_DATASOURCE_USERNAME` | `xy` | backend | |
| `SPRING_DATASOURCE_PASSWORD` | `change-me` | backend | |
| `APP_STORAGE_DIR` | `/data/uploads` | backend | 容器内素材/结果目录，对应 `uploads` 卷 |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | backend | 允许的前端来源，多个值用逗号分隔 |
| `APP_SIMULATION_FAIL_STAGE` | `NONE` | backend | 默认模拟失败阶段：`NONE` / `CHECKING` / `GENERATING` / `FINALIZING` |
| `APP_SIMULATION_STAGE_DELAY_MS` | `3000` | backend | 每阶段模拟耗时，0–60000 ms |
| `APP_SIMULATION_DEV_API_ENABLED` | `true`（Compose）/ `false`（本地） | backend | 是否开放 `/api/dev/**` |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | frontend（构建时） | 浏览器访问后端的地址；修改后必须重新 build |
| `APP_FILES_SIGNING_SECRET` | 空（启动时随机生成） | backend | `/files/**` 的 HMAC-SHA256 签名密钥；配置固定值可让签名 URL 跨重启稳定 |

> **已知配置缺口**：`APP_FILES_SIGNING_SECRET` 已在 `application.yml` 和 `.env.example` 中支持，但当前 `docker-compose.yml` 的 `backend.environment` 没有把它传进容器；Compose 中即使 `.env` 写了该值，后端仍会随机生成密钥。需要固定密钥时要给 Compose 增加一行透传（当前实现未做，见 §12.1 第 10 条）。不配置不影响演示；后端重启后旧签名 URL 失效，但重新查询任务会返回新签名 URL。

### 5.2 后端环境变量

`application.yml` 中所有配置都可用环境变量覆盖。除 5.1 的 Compose 变量外，本地运行时还可以使用：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SERVER_PORT` | `8080` | 后端端口 |
| `SPRING_DATASOURCE_POOL_SIZE` | `10` | Hikari 最大连接数 |
| `APP_TASK_EXECUTOR_CORE_SIZE` | `2` | 流水线线程池核心线程数 |
| `APP_TASK_EXECUTOR_MAX_SIZE` | `2` | 最大线程数，必须 ≥ core |
| `APP_TASK_EXECUTOR_QUEUE_CAPACITY` | `100` | 有界队列容量 |
| `APP_FILES_SIGNING_SECRET` | 空 | 未配置时每次启动随机生成 32 字节密钥 |
| `APP_SIMULATION_*` | 见上表 | 失败阶段、阶段耗时、dev API 开关 |

此外，`application.yml` 把 Spring multipart 的 `max-file-size` / `max-request-size` 固定为 10MB 作为兜底；超过时返回 `413 FILE_TOO_LARGE`，模板自身的 `maxFileSizeBytes` 通常更小。

本地默认 JDBC URL、账号和密码见 [§1.2](#12-本地开发不使用-compose-跑后端)。版本库（`git ls-files`）中没有任何真实密钥或凭据；本地 `.mcp.json` / `.env` 被 `.gitignore` 忽略，示例值只用于本地演示。

### 5.3 前端配置

`frontend/.env.example` 只有一项：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

本地放到 `frontend/.env.local`；Docker 中由 `docker-compose.yml` 的 build arg 传入。`NEXT_PUBLIC_*` 在构建/启动时内联，不是容器运行时读取。

---

## 6. 数据库初始化、种子数据与素材

### 6.1 初始化流程

- MySQL 容器只负责创建数据库和应用账号；**表结构与种子数据由 Spring Boot 启动时执行**。
- 配置在 `backend/src/main/resources/application.yml`：

  ```yaml
  spring:
    sql:
      init:
        mode: always
        schema-locations: classpath:db/schema.sql
        data-locations: classpath:db/data.sql
  ```

- `schema.sql` 使用 `CREATE TABLE IF NOT EXISTS`；`data.sql` 使用 `INSERT ... ON DUPLICATE KEY UPDATE id = id`，重复执行不报错，也不会覆盖已有行。脚本同时兼容 MySQL 8.4 和 H2 2.x 的 `MODE=MySQL`，因此测试和 Compose 使用同一份结构/种子脚本。
- 首次启动会创建：`users`、`template_categories`、`templates`、`assets`、`tasks`、`task_assets`、`task_stage_logs`。
- 重置数据：`docker compose down -v`（会同时删除上传文件和数据库），或手工 `DROP DATABASE` 后重启。
- 没有引入 Flyway/Liquibase；当前只有初始化脚本，不做增量迁移。生产化时应改为版本化迁移。

### 6.2 表一览

| 表 | 用途 | 关键字段 |
|---|---|---|
| `users` | 演示用户 | `id`（即 `X-User-Id`）、`username`、`display_name` |
| `template_categories` | 模板分类 | `code`、`name`、`sort_order` |
| `templates` | 模板定义 | 封面、示例结果路径、图片数量、允许类型、单张大小上限 |
| `assets` | 用户上传的素材 | `user_id`、`template_id`、`storage_key`、魔数识别出的 `mime_type` |
| `tasks` | 制作任务 | `status`、`stage`、`failed_stage`、`failure_reason`、`result_url`、模拟配置快照 |
| `task_assets` | 任务与素材的关联 | `(task_id, slot_index)` 主键，保留上传位顺序 |
| `task_stage_logs` | 阶段执行记录 | `(task_id, stage)` 唯一；`RUNNING/SUCCEEDED/FAILED`、起止时间、失败消息 |

完整列定义见 [docs/database.md](docs/database.md)。

### 6.3 种子数据

`data.sql` 预置 3 个用户、3 个分类、7 个模板：

| 模板 id | 分类 | 标题 | 图片数量 | 允许类型 | 单张上限 |
|---|---|---|---|---|---|
| `demo-postcard` | creative 创意图片 | 旅行明信片 | 2 | JPEG / PNG | 5 MB |
| `demo-polaroid` | creative 创意图片 | 拍立得相框 | 1 | JPEG / PNG / WebP | 5 MB |
| `demo-comic` | creative 创意图片 | 漫画分镜 | 4 | JPEG / PNG | 3 MB |
| `demo-spring-card` | festival 节日贺卡 | 新春贺卡 | 1 | JPEG / PNG | 5 MB |
| `demo-birthday` | festival 节日贺卡 | 生日祝福 | 3 | JPEG / PNG | 5 MB |
| `demo-grid9` | collage 拼图海报 | 九宫格海报 | 6 | JPEG / PNG / WebP | 2 MB |
| `demo-poster` | collage 拼图海报 | 双图对比海报 | 2 | JPEG / PNG | 5 MB |

分类接口按 `sort_order` 排序：创意图片（3 个模板）、节日贺卡（2 个）、拼图海报（2 个）。种子数据对已有行只刷新模板的 `cover_url`（保证已初始化过的库也能拿到新的封面地址），其余字段不会覆盖；修改了其他种子字段时，演示环境可以直接 `down -v` 重建。

### 6.4 演示图片与上传测试素材

- **模板封面**（`backend/src/main/resources/static/demo/covers/*.jpg`）：7 张来自 Unsplash 的免费授权照片，已随仓库提交，运行时**不访问网络**。作者与原始链接见 [§16.3](#163-图片与文案)。
- **示例结果图、上传测试图**：由 JDK 自带 AWT 绘制，不依赖网络、付费素材或公司内部服务。

生成脚本：`backend/scripts/GenDemoImages.java`，需要 JDK 21。可在仓库根目录或 `backend/` 下执行：

```bash
# 仓库根目录
java backend/scripts/GenDemoImages.java

# 或者在 backend/ 下
cd backend
java scripts/GenDemoImages.java
```

脚本会：

- 生成 7 张示例结果图到 `backend/src/main/resources/static/demo/results/`（800×600 PNG，FINALIZING 阶段复制其中一张作为任务结果）；
- 生成 4 张上传测试图到 `docs/sample-images/`：`sample-beach.jpg`、`sample-city.png`、`sample-food.jpg`、`sample-park.png`；
- 生成 `docs/sample-images/fake.jpg`：一个纯文本文件改名为 `.jpg`，用于演示“按文件头魔数识别、不信任扩展名”，上传给只接受 JPEG/PNG 的模板会返回 `415 UNSUPPORTED_FILE_TYPE`。

脚本开启 `java.awt.headless=true`，从系统可用字体中选择中文字体（Microsoft YaHei / Noto Sans CJK / PingFang 等），没有中文字体时退回 `SansSerif`。重复执行会覆盖上述图片。

上传素材保存在 `${APP_STORAGE_DIR}/assets/{uuid}.{ext}`，结果保存在 `${APP_STORAGE_DIR}/results/{uuid}.png`；数据库只保存 `assets/...`、`results/...` 相对路径。

---

## 7. 前后端与数据库如何连接

```text
浏览器
  │  HTML / JS（Next.js 页面，客户端渲染）
  ▼
Next.js 服务（3000）
  │  只提供页面与静态资源，不代理业务 API，不持有业务数据
  │
  │  浏览器直接 fetch：NEXT_PUBLIC_API_BASE_URL（默认 http://localhost:8080）
  │  请求头：X-User-Id；JSON 或 multipart/form-data
  ▼
Spring Boot 后端（8080）
  │  Controller → Service → MyBatis Mapper
  │  任务流水线：有界线程池（默认 2 线程）
  ▼
MySQL 8.4（Compose 服务名 mysql:3306；本地 localhost:3306）
  │  任务、阶段、素材、模板、用户持久化
  ▼
本地文件系统 / Docker 卷
  APP_STORAGE_DIR/assets、APP_STORAGE_DIR/results
```

- **前端直连 Java**：没有 Next.js API 中间层。理由：业务数据都依赖浏览器侧保存的身份，页面本就是客户端获取数据；链路更短，问题更容易定位。浏览器跨域由后端 CORS 放行（允许 `X-User-Id`，并暴露 `Location` 响应头）。
- **数据库连接**：后端使用 JDBC + HikariCP（默认最大 10 连接），MyBatis 使用注解 SQL；`map-underscore-to-camel-case: true`。
- **图片访问**：模板封面/示例结果图在 classpath `static/demo/`，公开映射 `/demo/**`；上传素材和任务结果在 `${APP_STORAGE_DIR}`，映射 `/files/**`，返回的是带 `exp`/`sig` 的签名 URL（签名机制与限制见 §12.1 第 3 条）。
- **静态资源**：`/files/**` 由后端返回（`Cache-Control: private, max-age=3600`），不是 Next.js 的 `public/`。

---

## 8. 主要接口、任务状态与后台执行

基础地址：`http://localhost:8080`。完整字段、错误体、示例见 [docs/api.md](docs/api.md)。本节只做交付说明所需的概述。

### 8.1 通用约定

- 除标注“公开”的接口外，都必须带 `X-User-Id: <正整数>`；缺失、格式错误或用户不存在返回 `401 UNAUTHORIZED`。
- 访问不属于当前用户的任务/素材返回 `404 NOT_FOUND`，不暴露资源是否存在。
- 成功响应直接返回资源对象（列表接口返回 `items` 包装）；非 2xx 统一为 `{ "code", "message", "details?" }`。
- 时间字段为 ISO-8601 UTC 字符串；`coverUrl` / `url` / `resultUrl` 是相对后端的路径，由前端拼接 `NEXT_PUBLIC_API_BASE_URL`。
- 错误码：`VALIDATION_ERROR`（400）、`UNAUTHORIZED`（401）、`NOT_FOUND`（404）、`FILE_TOO_LARGE`（413）、`UNSUPPORTED_FILE_TYPE`（415）、`DEV_API_DISABLED`（404）、`INTERNAL_ERROR`（500）。

### 8.2 接口清单

| 方法 | 路径 | 身份 | 说明 |
|---|---|---|---|
| GET | `/api/health` | 公开 | `{ "status": "UP" }`，供 Compose/前端探活 |
| GET | `/api/users` | 公开 | 演示用户列表 |
| GET | `/api/me` | `X-User-Id` | 当前身份；前端校验 localStorage 中的身份是否仍有效 |
| GET | `/api/template-categories` | 公开 | 分类 + 每个分类的 `templateCount` |
| GET | `/api/templates?category=creative` | 公开 | 模板列表；不传 `category` 返回全部；未知分类返回 `[]` |
| GET | `/api/templates/{id}` | 公开 | 模板详情；不存在返回 404 |
| POST | `/api/assets` | `X-User-Id` | `multipart/form-data`：`templateId` + `file`；成功 `201` |
| POST | `/api/tasks` | `X-User-Id` | JSON：`{ "templateId": "...", "assetIds": [101, 102] }`；成功 `202 Accepted` + `Location: /api/tasks/{id}` |
| GET | `/api/tasks/{id}` | `X-User-Id` | 查询单个任务，**只读**；不存在或不属于当前用户返回 404 |
| GET | `/api/tasks?active=true` | `X-User-Id` | 只返回当前用户 `PENDING/RUNNING` 的任务，不分页；刷新恢复用 |
| GET | `/api/tasks?page=1&size=20` | `X-User-Id` | 个人历史，按 `createdAt` 倒序分页；`size` 1–100 |
| GET | `/api/dev/simulation` | 无（需开关） | 读取模拟配置；`dev-api-enabled=false` 时 404 `DEV_API_DISABLED` |
| PUT | `/api/dev/simulation` | 无（需开关） | 运行时修改 `failStage` / `stageDelayMs`，只影响之后提交的任务 |
| GET | `/demo/**` | 公开 | 模板封面、示例结果图 |
| GET | `/files/**?exp=...&sig=...` | 签名校验 | 上传素材/任务结果；签名错误或过期 404 |

`POST /api/assets` 成功返回 `201`，字段为 `id`、`templateId`、`originalFilename`、`mimeType`、`sizeBytes`、`url`、`createdAt`；其中 `mimeType` 是按文件头识别的实际类型，`url` 是带签名的 `/files/assets/...`。`POST /api/tasks` 的请求体是 `{ "templateId": string, "assetIds": number[] }`。`GET /api/tasks` 在 `active=false` 时返回 `{ items, page, size, total }`，`active=true` 时返回 `{ items }`；列表项的 `stages` 为 `null`。模板、分类和用户字段见 [docs/api.md](docs/api.md) §2–§4。

### 8.3 任务 DTO（`TaskDTO`）

```json
{
  "id": 42,
  "templateId": "demo-postcard",
  "templateTitle": "旅行明信片",
  "templateCoverUrl": "/demo/covers/postcard.png",
  "status": "FAILED",
  "stage": "GENERATING",
  "failedStage": "GENERATING",
  "failureReason": "模拟生成失败：已按模拟配置在 GENERATING 阶段中断",
  "resultUrl": null,
  "assets": [
    { "id": 101, "slotIndex": 0, "url": "/files/assets/7c9e....jpg?exp=...&sig=..." },
    { "id": 102, "slotIndex": 1, "url": "/files/assets/1b4e....png?exp=...&sig=..." }
  ],
  "stages": [
    { "stage": "CHECKING", "status": "SUCCEEDED", "startedAt": "...", "finishedAt": "...", "message": null },
    { "stage": "GENERATING", "status": "FAILED", "startedAt": "...", "finishedAt": "...", "message": "..." }
  ],
  "createdAt": "2026-11-04T08:30:15.000Z",
  "startedAt": "2026-11-04T08:30:15.120Z",
  "finishedAt": "2026-11-04T08:30:21.300Z",
  "updatedAt": "2026-11-04T08:30:21.300Z"
}
```

| 字段 | 说明 |
|---|---|
| `status` | `PENDING` / `RUNNING` / `SUCCEEDED` / `FAILED` |
| `stage` | 当前（或最后到达的）阶段；`PENDING` 时为 `null` |
| `failedStage` | 失败所在阶段；`PENDING` 阶段被启动清理或线程池拒绝时为 `null`；服务重启中断时为中断时所在阶段 |
| `failureReason` | 面向用户的失败原因，仅 `FAILED` 时有值 |
| `resultUrl` | 成功结果图，仅 `SUCCEEDED` 时有值 |
| `stages` | 已经开始的阶段记录，按执行顺序；列表接口省略该字段（为 `null`） |
| `startedAt` / `finishedAt` | 第一个阶段开始时间 / 进入终态时间，可能为 `null` |

`POST /api/tasks` 返回的 TaskDTO 中 `status=PENDING`、`stage=null`、`stages=[]`。任务列表只返回卡片需要的字段并省略 `stages`，需要阶段明细时再调 `GET /api/tasks/{id}`。

### 8.4 状态与阶段

```text
PENDING ──start(CHECKING)──▶ RUNNING(CHECKING)
  ──▶ RUNNING(GENERATING) ──▶ RUNNING(FINALIZING) ──▶ SUCCEEDED
   │            │                    │                    │
   └────────────┴────────────────────┴────────────────────┴──▶ FAILED
```

| `status` | `stage` | `failedStage` | `resultUrl` | 含义 |
|---|---|---|---|---|
| `PENDING` | `null` | `null` | `null` | 已受理，排队等待线程 |
| `RUNNING` | `CHECKING` / `GENERATING` / `FINALIZING` | `null` | `null` | 正在执行该阶段 |
| `SUCCEEDED` | `FINALIZING` | `null` | 有值 | 三阶段全部完成 |
| `FAILED` | 失败时所在阶段 | 同 `stage` | `null` | 在该阶段失败，后续阶段不再执行 |
| `FAILED` | 中断时阶段 | 同 `stage` | `null` | 服务重启清理，阶段保持原值 |
| `FAILED` | `null` | `null` | `null` | 尚未开始就失败（线程池拒绝、PENDING 被中断） |

- 终态不可回退：所有写状态 SQL 都带 `WHERE status IN ('PENDING','RUNNING')`（成功为 `status='RUNNING'`），影响行数为 0 时流水线停止。
- 查询接口只读，GET 不会推进任务。
- 前端用轮询（默认每 1.5s）更新未完成任务；每个任务独立 `AbortController`；一轮请求全部完成后才安排下一轮（`setTimeout` 链，不是 `setInterval`）。任务进入终态后停止请求；连续 3 次查询失败后暂停该任务的自动跟踪，显示“状态暂时无法获取，已保留上次结果”和“重新查询”按钮。查询失败只设置 `syncError`，**不会**把任务改成 `FAILED`。

### 8.5 后台执行方式

1. `POST /api/tasks` 在短事务中校验模板、素材数量和归属、文件存在性，写入 `tasks`（`PENDING`）和 `task_assets`，并把当前模拟配置快照到 `sim_fail_stage` / `sim_stage_delay_ms`；事务提交后通过 `@TransactionalEventListener(AFTER_COMMIT)` 投递任务 ID。
2. 接口立即返回 `202 Accepted` + 任务对象，不等待制作完成；关闭页面不影响服务端线程。
3. 独立有界线程池 `taskPipelineExecutor`：默认 `core=2, max=2, queue=100`，可用环境变量调整；队列满时任务在返回 202 之后被标记为 `FAILED`，原因“系统繁忙，任务未能进入处理队列”。
4. `TaskPipelineRunner` 按 `CHECKING → GENERATING → FINALIZING` 执行。每个阶段开始/结束分别落库（`task_stage_logs`），阶段之间不包大事务，`sleep` 不在事务里。
   - `CHECKING`：重新读取任务素材，确认文件存在、大小和魔数类型与 `assets` 记录一致。
   - `GENERATING`：模拟耗时后取得模板预置的示例结果图作为“生成产物标识”。
   - `FINALIZING`：把示例结果图复制到 `${APP_STORAGE_DIR}/results/{uuid}.png`，写入 `result_url`。
5. 任一阶段抛异常：写阶段日志 `FAILED`、任务 `FAILED`（`failed_stage` + `failure_reason`），立即返回，后续阶段不再执行。
6. 服务启动时 `StartupCleanup` 在 `ApplicationReadyEvent` 执行一次：只处理 `created_at` 早于本次启动时刻的 `PENDING/RUNNING` 任务，标记为 `FAILED`，原因“服务重启，任务已中断”；把对应 `RUNNING` 阶段日志改为 `FAILED`。**不会恢复执行**。

模拟配置在受理时快照，所以运行中修改 `/api/dev/simulation` 只影响之后提交的任务；同一任务重放时条件相同，便于测试和演示。

---

## 9. 演示方法

以下命令默认在仓库根目录、Compose 已启动（`http://localhost:8080`）时执行。需要 `curl` 和 `jq`；没有 `jq` 时先看响应体手工取 `id`，或使用 [§9.8](#98-windows-powershell-等价命令) 的 PowerShell 版本。

先准备两个变量：

```bash
BASE=http://localhost:8080
USER_ID=1        # 1=Alice, 2=Bob, 3=Carol
```

> 前端页面操作同样能完成演示；下面给出 API 命令是为了可重复、可复制。演示任务统一用 `demo-postcard`（需要 2 张 JPEG/PNG，单张 ≤ 5MB）。

### 9.1 成功：上传两张图 → 提交 → 三阶段完成

**页面操作**：打开 <http://localhost:3000> → 顶部身份选 Alice → 点击“旅行明信片” → 两个上传位分别选择 `docs/sample-images/sample-beach.jpg` 和 `docs/sample-images/sample-city.png` → 等待两个上传位显示“已上传” → 点击“提交制作任务”。任务卡会依次显示“素材检查 → 模拟生成 → 结果整理”，约 9 秒（默认每阶段 3 秒）后变为成功并出现结果缩略图；点击缩略图可在对话框中预览大图。刷新页面后，历史和结果仍在。

**API 操作**：

```bash
# 1) 上传两张素材，取回 asset id
A1=$(curl -sS -H "X-User-Id: $USER_ID" \
  -F "templateId=demo-postcard" \
  -F "file=@docs/sample-images/sample-beach.jpg" \
  "$BASE/api/assets" | jq -r .id)

A2=$(curl -sS -H "X-User-Id: $USER_ID" \
  -F "templateId=demo-postcard" \
  -F "file=@docs/sample-images/sample-city.png" \
  "$BASE/api/assets" | jq -r .id)

echo "asset ids: $A1 $A2"

# 2) 提交任务；接口应立即返回 202 和 PENDING 任务
TASK_ID=$(curl -sS -H "X-User-Id: $USER_ID" -H 'Content-Type: application/json' \
  -d "{\"templateId\":\"demo-postcard\",\"assetIds\":[$A1,$A2]}" \
  "$BASE/api/tasks" | jq -r .id)

echo "task id: $TASK_ID"

# 3) 轮询观察阶段，进入终态后自动停止
for i in $(seq 1 20); do
  RESP=$(curl -sS -H "X-User-Id: $USER_ID" "$BASE/api/tasks/$TASK_ID")
  echo "$RESP" | jq -c '{status,stage,failedStage,resultUrl}'
  case "$(echo "$RESP" | jq -r .status)" in
    SUCCEEDED|FAILED) break ;;
  esac
  sleep 2
done
```

预期：前几次可能是 `PENDING` / `RUNNING CHECKING`，然后 `RUNNING GENERATING`、`RUNNING FINALIZING`，最后 `SUCCEEDED` 且 `resultUrl` 非空。

```bash
curl -sS -H "X-User-Id: $USER_ID" "$BASE/api/tasks/$TASK_ID" \
  | jq '{status, stage, resultUrl, stages: [.stages[] | {stage, status}]}'
```

### 9.2 指定阶段失败（三个阶段分别演示）

先确认 dev API 已开启（Compose 默认开启；本地需 `APP_SIMULATION_DEV_API_ENABLED=true`）：

```bash
curl -sS "$BASE/api/dev/simulation" | jq
# => {"failStage":"NONE","stageDelayMs":3000}
```

把每阶段耗时调成 1 秒，便于快速观察。**模拟配置在提交时快照，所以必须先改配置再提交任务**（下面的 `$A1`/`$A2` 取自 §9.1 的上传）：

```bash
# 对三个失败阶段各提交一个新任务；assets 可以复用
for STAGE in CHECKING GENERATING FINALIZING; do
  curl -sS -X PUT "$BASE/api/dev/simulation" \
    -H 'Content-Type: application/json' \
    -d "{\"failStage\":\"$STAGE\",\"stageDelayMs\":1000}" >/dev/null

  TASK_ID=$(curl -sS -H "X-User-Id: $USER_ID" -H 'Content-Type: application/json' \
    -d "{\"templateId\":\"demo-postcard\",\"assetIds\":[$A1,$A2]}" \
    "$BASE/api/tasks" | jq -r .id)

  sleep 5   # 三个 1s 阶段足够执行完；失败情况更早结束
  echo "=== failStage=$STAGE, task=$TASK_ID ==="
  curl -sS -H "X-User-Id: $USER_ID" "$BASE/api/tasks/$TASK_ID" \
    | jq -c '{status,failedStage,failureReason,resultUrl,
              stages:[.stages[]|{stage,status,message}]}'
done

# 恢复为全部成功
curl -sS -X PUT "$BASE/api/dev/simulation" \
  -H 'Content-Type: application/json' \
  -d '{"failStage":"NONE","stageDelayMs":3000}' | jq
```

预期：

- `CHECKING`：`status=FAILED`、`failedStage=CHECKING`，`stages` 只有 `CHECKING` 且为 `FAILED`，`resultUrl=null`；
- `GENERATING`：`CHECKING` 为 `SUCCEEDED`，`GENERATING` 为 `FAILED`，没有 `FINALIZING` 记录；
- `FINALIZING`：`CHECKING`、`GENERATING` 为 `SUCCEEDED`，`FINALIZING` 为 `FAILED`，`resultUrl=null`。

失败原因由后端写入，例如 `模拟生成失败：已按模拟配置在 GENERATING 阶段中断`。页面任务卡会显示失败阶段、原因，后续阶段标为“未执行”。

### 9.3 调整处理耗时

```bash
# 每阶段 10 秒，总耗时约 30 秒，便于观察 RUNNING 与多任务
curl -sS -X PUT "$BASE/api/dev/simulation" \
  -H 'Content-Type: application/json' \
  -d '{"failStage":"NONE","stageDelayMs":10000}' | jq

# 改回默认 3 秒
curl -sS -X PUT "$BASE/api/dev/simulation" \
  -H 'Content-Type: application/json' \
  -d '{"stageDelayMs":3000}' | jq
```

`stageDelayMs` 范围 0–60000；它作用于**每个阶段**（包括即将失败的那个阶段）。只影响设置之后提交的任务；已提交的任务使用受理时的快照。

### 9.4 多任务排队

线程池默认只有 2 个线程，队列容量 100。把阶段耗时调到 5 秒，连续提交 4 个任务：

```bash
curl -sS -X PUT "$BASE/api/dev/simulation" \
  -H 'Content-Type: application/json' \
  -d '{"failStage":"NONE","stageDelayMs":5000}' >/dev/null

for i in 1 2 3 4; do
  curl -sS -H "X-User-Id: $USER_ID" -H 'Content-Type: application/json' \
    -d "{\"templateId\":\"demo-postcard\",\"assetIds\":[$A1,$A2]}" \
    "$BASE/api/tasks" | jq -c '{id,status,stage}'
done

# 立刻查看未完成任务：应能看到 2 个 RUNNING、2 个 PENDING
curl -sS -H "X-User-Id: $USER_ID" "$BASE/api/tasks?active=true" \
  | jq -c '.items[] | {id,status,stage}'
```

页面上的每个任务卡独立更新，互不串扰；排队中的任务显示 `PENDING`，不会因为其他任务结束而改变自己的结果。演示完恢复：

```bash
curl -sS -X PUT "$BASE/api/dev/simulation" \
  -H 'Content-Type: application/json' -d '{"stageDelayMs":3000}' >/dev/null
```

> 队列满（默认 100）时新任务会被拒绝并标记为 `FAILED`，但 `POST /api/tasks` 已经返回 202；这是有意的取舍，见 §12。

### 9.5 刷新恢复与关闭页面

1. 把阶段耗时设为 10 秒，提交一个任务，确认任务卡显示 `RUNNING`。
2. 按 `F5` 刷新页面：前端挂载时调用 `GET /api/tasks?active=true`，把未完成任务重新加入任务表并继续轮询；页面顶部仍显示“N 个任务处理中”。
3. 点“我的作品”也能看到历史任务；历史页每页 10 条，分页加载。
4. 直接关闭标签页，等待 35 秒后重新打开 `/history`：任务仍在后台执行并已变为 `SUCCEEDED`，结果图可预览。关闭页面不会中断后端线程。

### 9.6 查询异常：查询失败 ≠ 任务失败

推荐用浏览器开发者工具模拟网络失败，不影响后端：

1. 提交一个阶段耗时 10 秒的任务，等它进入 `RUNNING`。
2. DevTools → Network → 勾选 **Offline**（或把请求 block 掉），保持 5–10 秒。
3. 任务卡显示“状态暂时无法获取，已保留上次结果”，但状态仍是 `RUNNING`，**不会变成 FAILED**；连续 3 次失败后自动轮询暂停，提示“自动查询已暂停，请手动重新查询”。
4. 取消 Offline，点击“重新查询”；轮询恢复，任务继续推进到成功。

如果一定要用“停后端”演示：

```bash
docker compose stop backend
# 等 5–10 秒，观察前端保留上次状态、暂停自动查询
docker compose start backend
# 再点“重新查询”让前端恢复请求
```

注意：后端重新启动时，启动清理会把重启前未完成的任务标记为 `FAILED`（原因“服务重启，任务已中断”），所以这个方式会同时演示 §12 的“重启不恢复”边界；它不会把任务的 `resultUrl` 变成成功结果。更干净的做法是上面的 DevTools Offline。

### 9.7 用户隔离

页面操作：Alice 提交任务 → 右上角头像 →“账号设置”中切换 Bob → “我的作品”不显示 Alice 的任务，顶部“N 个任务处理中”也按 Bob 的任务计数。切回 Alice 后记录仍在。

API 验证：

```bash
# Alice 的任务 ID（沿用上面的 $TASK_ID）
curl -sS -o /dev/null -w 'Alice 查询自己的任务: HTTP %{http_code}\n' \
  -H 'X-User-Id: 1' "$BASE/api/tasks/$TASK_ID"

# Bob 查询 Alice 的任务：404，不返回数据
curl -sS -o /dev/null -w 'Bob 查询 Alice 的任务: HTTP %{http_code}\n' \
  -H 'X-User-Id: 2' "$BASE/api/tasks/$TASK_ID"

# Bob 的历史里不包含 Alice 的任务（用 jq 搜索 id）
curl -sS -H 'X-User-Id: 2' "$BASE/api/tasks?page=1&size=100" \
  | jq --argjson id "$TASK_ID" '[.items[] | select(.id == $id)] | length'
# => 0

# Bob 试图用 Alice 的素材提交任务：400 VALIDATION_ERROR
curl -sS -o /tmp/bob-copy.json -w 'Bob 复用 Alice 素材: HTTP %{http_code}\n' \
  -H 'X-User-Id: 2' -H 'Content-Type: application/json' \
  -d "{\"templateId\":\"demo-postcard\",\"assetIds\":[$A1,$A2]}" \
  "$BASE/api/tasks"
cat /tmp/bob-copy.json | jq
```

身份头可以伪造：任何人只要加 `X-User-Id: 1` 就能以 Alice 身份调用接口。这是演示方案，不是鉴权；详见 §10 和 §12。

### 9.8 Windows PowerShell 等价命令

在 Windows PowerShell 中，`curl` 可能是 `Invoke-WebRequest` 的别名，建议显式使用 `curl.exe`；JSON 用 `ConvertFrom-Json` 解析。以下命令在仓库根目录执行：

```powershell
$BASE = "http://localhost:8080"
$H = @{ "X-User-Id" = "1" }

$a1 = (curl.exe -sS -H "X-User-Id: 1" `
  -F "templateId=demo-postcard" `
  -F "file=@docs/sample-images/sample-beach.jpg" `
  "$BASE/api/assets" | ConvertFrom-Json).id

$a2 = (curl.exe -sS -H "X-User-Id: 1" `
  -F "templateId=demo-postcard" `
  -F "file=@docs/sample-images/sample-city.png" `
  "$BASE/api/assets" | ConvertFrom-Json).id

$task = curl.exe -sS -H "X-User-Id: 1" -H "Content-Type: application/json" `
  -d "{`"templateId`":`"demo-postcard`",`"assetIds`":[$a1,$a2]}" `
  "$BASE/api/tasks" | ConvertFrom-Json

$task | Select-Object id, status, stage
curl.exe -sS -H "X-User-Id: 1" "$BASE/api/tasks/$($task.id)" | ConvertFrom-Json |
  Select-Object status, stage, failedStage, failureReason, resultUrl

# 设置模拟失败/耗时
curl.exe -sS -X PUT "$BASE/api/dev/simulation" -H "Content-Type: application/json" `
  -d '{"failStage":"GENERATING","stageDelayMs":1000}' | ConvertFrom-Json
```

---

## 10. 用户身份方案

**方案：预置演示用户 + 请求头 `X-User-Id`，不需要密码。**

- 后端 `users` 表预置 `alice(1)`、`bob(2)`、`carol(3)`；`GET /api/users` 公开返回列表，供前端身份切换器使用。
- 除公开接口（健康检查、用户列表、分类/模板、`/demo/**`、`/api/dev/**`，以及不校验身份头但需要签名 URL 的 `/files/**`）外，所有业务请求都必须带 `X-User-Id`。后端 `UserInterceptor` 解析并校验用户存在，把用户放入请求上下文；Service 层只从上下文取当前用户 ID。
- 前端把当前身份存在 `localStorage` 的 `xy.userId`；首次加载默认选列表第一个用户，`GET /api/me` 用于确认本地保存的身份仍有效（401 时回退到第一个用户，网络错误/5xx 不判定身份失效）。
- 数据隔离由后端强制执行：任务、历史、素材查询 SQL 都带 `user_id`；访问他人任务或素材统一返回 404；提交任务时逐个校验素材属于当前用户且属于该模板。
- 切换用户时前端用 `userId` 作为 `TaskProvider` 的 key 重建任务表和 tracker，旧 tracker `dispose()` 中止请求；迟到的响应会因 `userId` 不匹配被 reducer 丢弃。

**演示方法**：

1. 点击页面右上角头像，在“账号设置”对话框中切换 Alice / Bob / Carol；历史记录、任务数、提交能力随身份切换。
2. 用 `curl -H 'X-User-Id: 1'` / `-H 'X-User-Id: 2'` 调同一任务 ID，验证 404（见 §9.7）。
3. 用 Bob 的身份提交 Alice 的 `assetIds`，验证 400。

**已知边界**：请求头可以伪造，没有 token/session，不能作为真实鉴权。生产环境应替换为 Session/JWT/SSO；接口层的 `user_id` 过滤逻辑可以保留。`X-User-Id` 也不适合直接暴露在公网。

---

## 11. 完成度（R-01 ~ R-14）

| 需求 | 状态 | 实现/验证说明 |
|---|---|---|
| R-01 技术栈与职责 | 已完成 | Next.js App Router + React + TS；Java + Spring Boot + MyBatis + MySQL；模板、素材、任务、历史全部由 Java 提供并持久化；前端不实现业务持久化 |
| R-02 列表与模拟数据 | 已完成 | 3 分类、7 模板来自 `data.sql`，通过 `GET /api/templates` 获取；分类筛选走 `?category=`，刷新保留 |
| R-03 详情、上传与校验 | 已完成 | 详情页、上传位（预览/替换/移除/上传中/失败）、前端预校验 + 服务端魔数/大小/数量校验；列表/详情有加载、空、404、错误状态 |
| R-04 受理与异步 | 已完成 | `POST /api/tasks` 短事务后 202 返回；AFTER_COMMIT 投递线程池；关闭页面不中断；多任务可排队 |
| R-05 多步骤与查询 | 已完成 | CHECKING → GENERATING → FINALIZING 独立落库；`task_stage_logs`；GET 只读；终态不可回退 |
| R-06 失败与模拟控制 | 已完成 | `/api/dev/simulation` 可重复设置三个阶段失败和 0–60000ms 耗时；失败停止后续阶段；不随机失败 |
| R-07 状态表达与请求异常 | 已完成 | 三层状态分离（上传位/表单/任务）；查询失败只记 `syncError`，保留任务状态并提供“重新查询”；提交受理后按钮立即恢复 |
| R-08 多任务与查询生命周期 | 已完成 | 按任务 ID 隔离；1.5s 轮询；终态停止；无活跃任务不轮询；切换用户/卸载 dispose；旧响应按 userId/任务 ID 丢弃 |
| R-09 刷新恢复与结果记录 | 已完成 | 历史分页、创建时间、状态/阶段、失败原因、结果预览；刷新后 `GET /api/tasks?active=true` 恢复跟踪 |
| R-10 用户身份与个人记录 | 已完成 | 预置用户 + `X-User-Id`；后端强制隔离；切换器 + localStorage |
| R-11 视觉与基本可用性 | 已完成（视觉未逐项人工验收） | 列表/详情/历史布局、阶段步骤条、状态反馈；语义化 button/label/dialog、`aria-label`、`focus-visible`、小屏媒体查询。未做参考截图逐像素比对，也未做完整人工浏览器走查 |
| R-12 CI 与关键测试 | 已完成（Actions 已通过） | `.github/workflows/ci.yml` 配置 push/PR 前后端检查；后端覆盖阶段顺序/失败中断/终态/隔离；前端覆盖多任务/查询异常/生命周期。仓库已推送到 `origin/main`，Actions 运行结果以 GitHub 页面为准（已全部通过） |
| R-13 提交材料与说明 | 已完成 | 本 README 覆盖 R-13；源码、依赖锁、数据库脚本、种子数据、CI 均在仓库；实际投入见 §14，AI 使用说明见 §15，验收版本见 §17 |
| R-14 容器交付 | 已完成（冒烟通过） | 两个 Dockerfile + `docker compose up --build`；MySQL 健康检查、数据卷、非 root 运行；全新数据卷冒烟结果见 §18 |

**未做/明确不在范围**：真实 AI 生成、真实图片处理、模板 CRUD 后台、登录密码/第三方账号、支付/会员、下载/删除/重新制作、视频、国际化、多区域部署、集群/消息队列运维、重启后自动续跑。这些在题目中属于“不做”或不要求项。

---

## 12. 已知限制与取舍

### 12.1 已知限制

1. **重启后不恢复执行，启动时会把未完成任务标记为失败。**
   任务流水线在进程内线程池中执行，没有持久化队列/租约。应用启动时 `StartupCleanup` 把 `created_at` 早于启动时刻的 `PENDING` / `RUNNING` 任务改为 `FAILED`，原因“服务重启，任务已中断”，`failed_stage` 取中断时的 `stage`（未开始的 PENDING 为 `null`），对应 `RUNNING` 阶段日志也改为 `FAILED`。不会重跑、不会续跑。见 §8.5。
2. **请求头身份可以伪造。**
   `X-User-Id` 没有签名/会话校验；知道用户 ID 即可冒充。仅用于演示，不能作为真实鉴权。见 §10。
3. **`/files/**` 不做用户级鉴权。**
   只校验 HMAC 签名（`exp` + `sig`），不校验请求者是谁；任何拿到 URL 的人都能访问。签名 URL 可被转发；`/demo/**` 完全公开。签名密钥未配置时每次启动随机生成，重启后旧 URL 失效（重新查询任务会得到新 URL）。生产环境应改为按用户授权的短期 URL/对象存储签名。
4. **上传但未提交的素材不会清理。**
   上传即落盘入库；用户放弃提交后，`assets` 记录和文件会保留，没有定时清理/引用计数。任务结果文件同样没有清理策略，长期运行会增长 `uploads` 卷。
5. **测试用 H2 与 MySQL 存在差异。**
   测试使用 H2 2.3.232 的 `MODE=MySQL`，通过约束（不用 `ENUM`/`JSON`/存储过程）保持兼容；但 H2 不是 MySQL，索引行为、排序、函数、时区/精度等仍可能有差异。真正的 MySQL 由 Compose 冒烟测试补充；生产前应在 MySQL 上重跑验收。
6. **没有受理幂等、自动重试、断点续跑。** 见 §12.2。
7. **单实例、进程内线程池。** 没有消息队列/Redis/分布式锁；水平扩容后各实例不会共享任务队列。队列满时任务在 202 之后被标记失败，不会重试。
8. **轮询而非 SSE/WebSocket。** 任务数量多、轮询频率高时会增加后端请求量；当前规模可接受。前端连续 3 次查询失败会暂停自动跟踪，需要手动“重新查询”。
9. **`/api/dev/**` 无身份校验。** 只在开发/演示开启；Compose 默认 `true`，生产必须设为 `false`，否则任何能访问后端的人都能改模拟失败/耗时（只影响新任务）。
10. **`APP_FILES_SIGNING_SECRET` 在 Compose 中未透传。** 当前 `docker-compose.yml` 的 `backend.environment` 没有该变量，容器内始终随机生成；需要跨重启稳定签名时，必须给 Compose 增加透传（当前实现未做，本次只记录）。
11. **依赖审计/维护提示。** `npm ci` 当前报告 8 个 moderate 级别的传递依赖漏洞，并提示 `eslint@9.39.5` 已停止支持；本次未升级依赖，以保持锁文件和已评审版本一致。升级需单独评估/验证。
12. **`NEXT_PUBLIC_API_BASE_URL` 是构建时变量。** 修改后必须重建前端；仅重启容器无效。
13. **模拟结果图固定。** 同一模板的成功结果都是同一张预置示例图，不反映用户上传的图片内容；这是“模拟生成”的预期行为，不是真实合成。

### 12.2 受理幂等、自动重试、断点续跑的取舍

**受理幂等（未实现）**

- 现状：前端在提交中禁用按钮；后端在一个短事务中创建任务。网络重试、用户双击或多标签页仍可能创建重复任务。
- 可选方案：请求带 `clientRequestId`，`tasks` 增加 `(user_id, client_request_id)` 唯一约束；重复请求返回已存在任务（200/202），或返回冲突。需要前端生成并持久化请求 ID（刷新后仍能用），还要处理“上次请求成功但响应丢失”的语义。当前题目不要求，演示规模下代价高于收益，因此不做；前端已做按钮禁用和提交中状态。

**自动重试（未实现）**

- 现状：任何阶段失败即进入终态 `FAILED`，不自动重试。
- 理由：失败由模拟配置确定性触发，自动重试只会重复同样失败，掩盖问题；真实业务也应区分“可重试的瞬时基础设施错误”和“参数/业务错误”。生产化可以为数据库/文件系统瞬时错误增加有限次数 + 指数退避 + `attempt` 字段，但要让阶段处理器幂等（重复执行不产生重复结果），并明确重试上限；当前不做。

**断点续跑（未实现）**

- 现状：服务重启后不恢复，启动清理把未完成任务标记失败。
- 理由：进程内线程池没有持久化队列/租约；要真正续跑，需要持久化任务队列、worker 租约/心跳、阶段幂等键、已执行阶段跳过逻辑、崩溃恢复策略，以及多实例下的抢占处理。现有 `tasks.stage` + `task_stage_logs` 已经能告诉恢复逻辑“做到哪一步”，但仅靠这些字段不足以安全地多实例续跑。题目明确不要求重启恢复，且“永远卡在处理中”比“明确失败”更糟，因此选择启动清理。生产化可引入消息队列/数据库队列 + 租约，按阶段幂等重放。

**其他取舍**：选择轮询而非 SSE/WebSocket（简单、无状态、易测试）；选择 `/files/**` 签名 URL 而非 `<img>` 带请求头（浏览器 `<img>` 无法带自定义头）；选择 H2 以便本地/CI 无 Docker 跑测试，代价见上。

---

## 13. 部署与回滚

本项目按“单机 Docker Compose”交付，不要求生产环境/复杂发布平台。

### 13.1 部署步骤

1. 准备一台可运行 Docker/Compose 的机器；开放 3000（前端）和 8080（后端）端口，或在前端前面放反向代理。
2. 拉取代码并检出要部署的 commit/tag：
   ```bash
   git fetch --all --tags
   git switch --detach <commit-or-tag>
   ```
3. 准备 `.env`（不要提交）：
   ```bash
   cp .env.example .env
   # 至少改掉 MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD；
   # 若浏览器访问地址不是 localhost:8080，改 NEXT_PUBLIC_API_BASE_URL 和 APP_CORS_ALLOWED_ORIGINS
   ```
4. 构建并启动：
   ```bash
   docker compose build --pull
   docker compose up -d
   docker compose ps
   ```
5. 健康检查：
   ```bash
   curl -fsS http://localhost:8080/api/health   # {"status":"UP"}
   curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/   # 200
   ```
6. 首次启动会自动建表/写种子数据；数据卷为 `mysql-data`（数据库）和 `uploads`（素材/结果）。备份见下。

### 13.2 备份

```bash
# 逻辑备份（在 .env 已加载的仓库根目录执行）
docker compose exec -T mysql sh -c \
  'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE"' \
  > backup-$(date +%F-%H%M).sql

# 上传文件卷建议在停机窗口打包
docker run --rm -v xy-material-platform_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F-%H%M).tar.gz -C /data .
```

> Compose 项目名默认取自目录名；如果目录名不同，`docker volume ls` 里实际卷名会变（`<project>_uploads`、`<project>_mysql-data`），以实际为准。

### 13.3 回滚

1. 记录当前可用版本（commit/tag）和镜像；保留上一个已验证的 commit。
2. 如需保留当前数据库：先做 13.2 的备份。
3. 切回上一个已验证 commit，重新构建并启动：
   ```bash
   git switch --detach <last-good-commit>
   docker compose up --build -d
   docker compose ps
   curl -fsS http://localhost:8080/api/health
   ```
4. 数据卷默认保留（`docker compose down` 不会删卷；不要加 `-v`）。当前 `schema.sql` 只做 `CREATE TABLE IF NOT EXISTS`，不会删除已有表/列；若未来引入不兼容的结构变更，回滚需要同时恢复数据库备份，不能只回滚代码。
5. 前端地址变了要重新 build（`NEXT_PUBLIC_API_BASE_URL` 是构建时变量）；只回滚后端时前端可以继续用旧地址。
6. 确认回滚后的功能：打开 `/` 能看到模板、`/api/health` 正常、历史记录仍可读；必要时提交一个演示任务验证流水线。

### 13.4 说明

- 这是单机演示部署，不提供零停机、蓝绿/金丝雀、集群编排；`docker compose up -d` 会有短暂重启窗口。
- 数据库/文件卷是唯一持久数据，删除卷等于清空交付数据。
- 不提供公网地址或真实部署截图（题目不要求）。
- 生产化建议：固定 `APP_FILES_SIGNING_SECRET`、关闭 dev API、替换 `X-User-Id` 为真实鉴权、使用对象存储/清理策略、引入迁移工具和外部任务队列。

---

## 14. 实际投入

于11.5开发完成，实际开发耗时约3h

返工主要集中在两处：

- **评审后的修复**：独立评审发现服务重启后任务状态不一致、`/files` 不校验身份等问题，额外做了一轮前后端修复，详见 [§15.2](#152-一个修正问题的例子服务重启后的任务状态)。
- **界面**：先在原浅色界面上改成深色，之后按参考截图整体重做了一次；模板卡片改成竖版后，原来的横版封面会被裁掉标题，于是换成了竖版照片。

功能上的取舍（重启不续跑、不做幂等和自动重试等）见 [§12](#12-已知限制与取舍)。

---

## 15. AI 使用说明

本项目使用了 AI 编程工具。本人主要负责明确需求、拆解任务、给出约束、审查结果，ai负责代码编写。对话过程的截图见仓库根目录的 [`对话记录/`](对话记录/) 文件夹。

- **主会话**：负责理解需求、编写设计文档、给每个子任务写提示词、复核评审结论，以及界面重做。
- **子任务执行**：按提示词分别完成后端、前端、容器与 CI、独立评审和 README 等任务。

### 15.1 工作流

1. **先定规则**：仓库里有三份 `CLAUDE.md`（根目录、前端、后端），写明技术栈、验证命令、状态与阶段模型、用户隔离等硬性规则，以及提交流程：先运行验证命令，再列出要提交的文件和提交信息，经我同意才能提交。
2. **先文档后代码**：让 AI 读题后先产出 `docs/` 下的设计、接口、数据库文档和开发计划，我确认后作为前后端的约定。之后如果要偏离，必须先改文档、说明原因。
3. **拆任务**：按开发计划拆成后端三个任务、前端三个任务，加上容器与 CI、README。前后端两条线改的目录不重叠，可以同时进行；前端按 `docs/api.md` 开发，测试中模拟接口返回。每个任务的提示词都写明范围、要做的事、必须有的测试、完成标准和不在范围的内容。
4. **生成与修改**：异步流水线、多任务轮询这类复杂任务，要求先给出设计和文件清单再写代码。每次修改后都要运行对应的验证命令，并汇报实际输出；没条件验证的写明“未验证”。
5. **验证**：前端四条命令、后端 `./mvnw clean verify`、Docker Compose 冒烟和 curl 演示。另外单独派一个只读的评审任务，对照 R-01 ~ R-14 逐条在代码里找证据，不以设计文档为准。
6. **提交**：每个任务完成后由 AI 列出文件和提交信息，我同意后再提交，推送也由我决定；一次提交只做一类事。

### 15.2 一个修正问题的例子：服务重启后的任务状态

- **现象**：评审任务在 Compose 中让任务处于处理中时重启后端。重启后任务变成“失败”，但失败阶段为空，阶段日志仍是“进行中”，前端阶段条显示“未开始”，和“失败”自相矛盾。
- **定位**：主会话对照代码复核，确认启动清理只改了任务表，没有处理阶段日志。同时发现一个评审漏掉的问题：清理在应用就绪后才执行，这时已经开始接收请求，启动瞬间提交的新任务也会被当成遗留任务标记为失败。
- **修改**：清理时把失败阶段记为中断时所在的阶段，并在同一事务里把“进行中”的阶段日志改为失败；记录启动时刻，只清理在这之前创建的任务。前端对旧数据按当前阶段显示“中断于某阶段”。
- **回归**：补充测试，覆盖处理中和排队中的任务被清理、启动后创建的任务不被清理；重跑 `./mvnw clean verify`，并在 Compose 中复现重启场景确认。

### 15.3 怎样发现 AI 产出里的问题

- AI 汇报“已完成”后，对照代码和 git 状态核对，并且进行测试。




---

## 16. 素材、脚手架与开源来源

### 16.1 脚手架

- **前端**：以 Next.js 官方 `create-next-app` 为起点（App Router、TypeScript、ESLint、`src/` 目录、`@/*` 路径别名），保留其默认 `eslint.config.mjs`、`tsconfig.json` 结构，再改为本项目页面、组件和 Vitest 配置。
- **后端**：以 Spring Initializr 生成的 Maven 工程为起点（Java 21、Spring Web、Validation、Maven Wrapper），再加入 MyBatis starter、MySQL 驱动、H2 测试依赖和本项目代码。
- 脚手架生成后，业务代码、页面、样式、SQL、Docker/Compose、CI 和测试均为本项目编写；未复制第三方业务源码。

### 16.2 开源依赖

主要依赖及版本见 [§2](#2-技术版本)，均通过 Maven/npm 正常依赖引入，未修改其源码。主要项目及其许可证（以各自仓库为准）：

| 依赖 | 许可证 |
|---|---|
| Next.js | MIT |
| React / React DOM | MIT |
| TypeScript | Apache-2.0 |
| Spring Boot | Apache-2.0 |
| MyBatis / mybatis-spring-boot-starter | Apache-2.0 |
| MySQL Server（Compose 镜像） | GPLv2 |
| MySQL Connector/J | GPLv2（含 FOSS exception） |
| H2 Database | MPL 2.0 / EPL 1.0（双许可） |

### 16.3 图片与文案

- **模板封面**：7 张照片来自 [Unsplash](https://unsplash.com)，均为 [Unsplash License](https://unsplash.com/license)（免费、可商用、无需署名；不含 Unsplash+ 付费内容）。下载时用 Unsplash 图片服务按 540×960 竖版裁切为 JPEG，未做其他修改。这里仍注明作者以示尊重：

  | 文件 | 模板 | 作者 | 原图 |
  |---|---|---|---|
  | `postcard.jpg` | 旅行明信片 | Yoanna Yordanova | <https://unsplash.com/photos/X6kaLD-UjgM> |
  | `polaroid.jpg` | 拍立得相框 | Erik Mclean | <https://unsplash.com/photos/iW9y-ZyeXP8> |
  | `comic.jpg` | 漫画分镜 | Markus Spiske | <https://unsplash.com/photos/DXOMQLn_Xqw> |
  | `spring-card.jpg` | 新春贺卡 | Ben Kim | <https://unsplash.com/photos/5stFMBulvO0> |
  | `birthday.jpg` | 生日祝福 | Azizbek | <https://unsplash.com/photos/Y1Pou755ygM> |
  | `grid9.jpg` | 九宫格海报 | Tasha Kostyuk | <https://unsplash.com/photos/-sm-XDlWEaI> |
  | `poster.jpg` | 双图对比海报 | Krista Mangulsone | <https://unsplash.com/photos/9gz3wfHr65U> |

  选图时排除了画面中有明显商标或第三方受版权保护角色的照片。
- 示例结果图、4 张上传测试图由 `backend/scripts/GenDemoImages.java` 用 JDK AWT 生成（渐变/几何装饰 + 文字），不依赖外部图库、付费素材或公司内部服务。
- `docs/sample-images/fake.jpg` 是纯文本文件改扩展名，仅用于校验演示，不是图片素材。
- 模板标题、描述、演示文案为本项目编写；没有使用小影科技的品牌素材或参考截图中的受版权保护内容。
- 站点图标 `frontend/src/app/icon.svg` 为项目内简单 SVG。

---

## 17. 验收版本

验收版本以 `git tag submission-v1` 为准，完整 commit 哈希在交付消息中提供。

---

## 18. 验证记录

> 验证日期：2026-11-05。宿主机为 Windows；由于当前执行环境的沙箱限制（Vite 子进程、Mockito 自附加、Docker 命名管道），前端四条命令和后端 `clean verify` 在 Docker 隔离容器中执行，容器镜像与 CI 同版本（Node 22 / Temurin 21）。这是执行方式的说明，不改变命令内容。

| 范围 | 命令 / 操作 | 结果 |
|---|---|---|
| 前端 Lint | `npm run lint`（`node:22-alpine`） | 通过 |
| 前端类型检查 | `npm run typecheck`（`next typegen && tsc --noEmit`） | 通过 |
| 前端测试 | `npm test`（Vitest 5.1.0） | 通过（12 个测试文件，76 tests，0 failed） |
| 前端构建 | `npm run build`（Next.js 16.4.5 standalone） | 通过 |
| 后端 | `./mvnw -B clean verify`（`maven:3.9-eclipse-temurin-21`） | 通过（62 tests，0 failures / 0 errors） |
| Compose 冒烟 | 全新数据卷上 `docker compose up --build -d` | 通过；mysql / backend / frontend 均 healthy，`/api/health` 为 `{"status":"UP"}`，`/` 返回 200 |
| 成功链路 | 上传 2 张图 → `POST /api/tasks` → 轮询 `GET /api/tasks/{id}` | 通过；202 立即返回，阶段依次 `CHECKING → GENERATING → FINALIZING`，最终 `SUCCEEDED`，结果签名 URL 返回 `200 image/png` |
| 三阶段失败 | 分别设置 `failStage=CHECKING/GENERATING/FINALIZING` 后各提交一个任务 | 通过；分别只在对应阶段失败，后续阶段没有 `task_stage_logs`；失败原因已落库 |
| 多任务排队 | 2 线程、5s/阶段，连续提交 4 个任务 | 通过；查询到 2 个 `RUNNING` + 2 个 `PENDING` |
| 用户隔离 | Alice 任务 1，Bob 查询 / 列表 / 复用素材 | 通过；Bob 查询 404、历史 0 条、复用素材 400 `VALIDATION_ERROR` |
| 重启清理 | 任务在 `RUNNING` 时重启 backend 容器 | 通过；重启后任务 `FAILED`，原因“服务重启，任务已中断”，阶段日志同步 `FAILED`，未恢复执行 |
| 手工 UI 演示 | 浏览器操作 §9 场景 | 未验证；未做完整人工浏览器验收（见 §11 R-11） |

补充说明：

- `npm ci` 报告 8 个 moderate 级别的传递依赖漏洞，并提示 `eslint@9.39.5` 已停止支持；未在本次处理（§12.1 第 11 条）。
- 仓库已推送到 `origin/main`；GitHub Actions 运行结果以 GitHub 页面为准（已全部通过），CI 配置见 §4.3。
- 后端在宿主机直接运行 `./mvnw clean verify` 时，当前沙箱会阻止 Mockito/Byte Buddy 自附加；换成容器后 62 个测试全通过，属于执行环境限制，不是应用失败。
- 页面交互的自动化覆盖来自前端组件/Reducer/Tracker 测试和 `next build`；没有浏览器端到端测试，视觉与小屏的最终人工验收仍建议按 §9 走一遍。
