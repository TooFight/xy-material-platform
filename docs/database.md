# 数据库设计

> MySQL 8.4，字符集 `utf8mb4`，时间统一用 UTC 存储（`DATETIME(3)`）。
> 最终脚本位置：`backend/src/main/resources/db/schema.sql`、`db/data.sql`，由 Spring `spring.sql.init` 在启动时执行，脚本幂等。
> 为了让测试中的 H2（MySQL 模式）也能执行同一份脚本：不使用 `ENUM`、`JSON` 类型和存储过程，枚举用 `VARCHAR` 存储，由应用层校验。

## 1. ER 概览

```
users 1 ──< assets
users 1 ──< tasks >── 1 templates >── 1 template_categories
tasks 1 ──< task_assets >── 1 assets
tasks 1 ──< task_stage_logs
```

## 2. 表结构

### users 演示用户

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT | PK, AUTO_INCREMENT | 即 `X-User-Id` |
| username | VARCHAR(32) | NOT NULL, UNIQUE | |
| display_name | VARCHAR(64) | NOT NULL | |
| created_at | DATETIME(3) | NOT NULL | |

### template_categories 模板分类

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| code | VARCHAR(32) | PK | 如 `creative` |
| name | VARCHAR(32) | NOT NULL | 展示名 |
| sort_order | INT | NOT NULL DEFAULT 0 | |

### templates 模板

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | VARCHAR(64) | PK | slug，如 `demo-postcard` |
| category_code | VARCHAR(32) | NOT NULL, FK → template_categories.code | |
| title | VARCHAR(64) | NOT NULL | |
| description | VARCHAR(500) | NOT NULL | |
| cover_url | VARCHAR(255) | NOT NULL | `/demo/covers/xxx.jpg` |
| sample_result_path | VARCHAR(255) | NOT NULL | 示例结果图的 classpath 路径，供 FINALIZING 复制 |
| required_image_count | INT | NOT NULL, 1–6 | |
| accepted_mime_types | VARCHAR(128) | NOT NULL | 逗号分隔，如 `image/jpeg,image/png` |
| max_file_size_bytes | BIGINT | NOT NULL | |
| sort_order | INT | NOT NULL DEFAULT 0 | |
| created_at | DATETIME(3) | NOT NULL | |

索引：`idx_templates_category (category_code, sort_order)`

### assets 用户上传的素材

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT | PK, AUTO_INCREMENT | |
| user_id | BIGINT | NOT NULL, FK → users.id | 归属用户 |
| template_id | VARCHAR(64) | NOT NULL, FK → templates.id | 按哪个模板的规则校验 |
| storage_key | VARCHAR(128) | NOT NULL, UNIQUE | `assets/{uuid}.{ext}`，相对 `APP_STORAGE_DIR` |
| original_filename | VARCHAR(255) | NULL | 仅用于展示，已截断 |
| mime_type | VARCHAR(32) | NOT NULL | 按魔数识别的类型 |
| size_bytes | BIGINT | NOT NULL | |
| created_at | DATETIME(3) | NOT NULL | |

索引：`idx_assets_user (user_id, created_at)`

### tasks 制作任务

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT | PK, AUTO_INCREMENT | |
| user_id | BIGINT | NOT NULL, FK → users.id | |
| template_id | VARCHAR(64) | NOT NULL, FK → templates.id | |
| status | VARCHAR(16) | NOT NULL | PENDING / RUNNING / SUCCEEDED / FAILED |
| stage | VARCHAR(16) | NULL | CHECKING / GENERATING / FINALIZING |
| failed_stage | VARCHAR(16) | NULL | 失败所在阶段 |
| failure_reason | VARCHAR(500) | NULL | 面向用户的原因 |
| result_url | VARCHAR(255) | NULL | `/files/results/{uuid}.png` |
| sim_fail_stage | VARCHAR(16) | NOT NULL DEFAULT 'NONE' | 受理时的模拟配置快照 |
| sim_stage_delay_ms | INT | NOT NULL | 受理时的模拟配置快照 |
| created_at | DATETIME(3) | NOT NULL | |
| started_at | DATETIME(3) | NULL | 第一个阶段开始的时间 |
| finished_at | DATETIME(3) | NULL | 进入终态的时间 |
| updated_at | DATETIME(3) | NOT NULL | |

索引：`idx_tasks_user_created (user_id, created_at DESC)`、`idx_tasks_status (status)`（启动清理、活跃任务查询）

### task_assets 任务引用的素材

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| task_id | BIGINT | PK(task_id, slot_index), FK → tasks.id | |
| slot_index | INT | 同上 | 上传位顺序，从 0 开始 |
| asset_id | BIGINT | NOT NULL, FK → assets.id | |

### task_stage_logs 阶段执行记录

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGINT | PK, AUTO_INCREMENT | 插入顺序即执行顺序 |
| task_id | BIGINT | NOT NULL, FK → tasks.id | |
| stage | VARCHAR(16) | NOT NULL | |
| status | VARCHAR(16) | NOT NULL | RUNNING / SUCCEEDED / FAILED |
| message | VARCHAR(500) | NULL | 失败原因 |
| started_at | DATETIME(3) | NOT NULL | |
| finished_at | DATETIME(3) | NULL | |

约束与索引：`uk_stage_log (task_id, stage)`，同一任务的每个阶段最多执行一次。

## 3. 关键 SQL 约定（终态保护）

```sql
-- 进入阶段：只有未终结的任务才能推进
UPDATE tasks
   SET status = 'RUNNING', stage = #{stage},
       started_at = COALESCE(started_at, #{now}), updated_at = #{now}
 WHERE id = #{id} AND status IN ('PENDING', 'RUNNING');

-- 失败
UPDATE tasks
   SET status = 'FAILED', failed_stage = #{stage}, failure_reason = #{reason},
       finished_at = #{now}, updated_at = #{now}
 WHERE id = #{id} AND status IN ('PENDING', 'RUNNING');

-- 成功
UPDATE tasks
   SET status = 'SUCCEEDED', result_url = #{resultUrl},
       finished_at = #{now}, updated_at = #{now}
 WHERE id = #{id} AND status = 'RUNNING';

-- 所有面向用户的查询都带 user_id
SELECT ... FROM tasks WHERE id = #{id} AND user_id = #{userId};
```

影响行数为 0 时，说明任务已经处于终态（或被启动清理终结），流水线停止，不再写入。

## 4. 种子数据（data.sql）

- 用户：`alice` / `bob` / `carol`（id 1–3）。
- 分类与模板（覆盖分类切换和不同数量要求）：

| id | 分类 | 标题 | 数量 | 类型 | 大小上限 |
|---|---|---|---|---|---|
| demo-postcard | creative 创意图片 | 旅行明信片 | 2 | jpeg, png | 5MB |
| demo-polaroid | creative 创意图片 | 拍立得相框 | 1 | jpeg, png, webp | 5MB |
| demo-comic | creative 创意图片 | 漫画分镜 | 4 | jpeg, png | 3MB |
| demo-spring-card | festival 节日贺卡 | 新春贺卡 | 1 | jpeg, png | 5MB |
| demo-birthday | festival 节日贺卡 | 生日祝福 | 3 | jpeg, png | 5MB |
| demo-grid9 | collage 拼图海报 | 九宫格海报 | 6 | jpeg, png, webp | 2MB |
| demo-poster | collage 拼图海报 | 双图对比海报 | 2 | jpeg, png | 5MB |

- 模板封面放在 `backend/src/main/resources/static/demo/covers/`，是 7 张来自 Unsplash 的免费授权照片（540×960 竖版 JPEG，作者与原始链接见 README 素材来源）。
- 示例结果图放在 `backend/src/main/resources/static/demo/results/`，用脚本自行生成纯色加文字的 PNG（无版权问题）。生成方式写入 README。
- 另外在 `docs/sample-images/` 放几张可供上传测试的本地示例图片，再加一个伪造扩展名的非图片文件，用于演示类型校验。
