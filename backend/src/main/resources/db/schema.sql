-- 素材制作平台数据库结构。
-- 目标：MySQL 8.4 与 H2 2.x (MODE=MySQL) 均可执行；脚本幂等，可重复运行。
-- 约定：不使用 ENUM / JSON 类型和存储过程，枚举值以 VARCHAR 存储、由应用层校验。
-- 时间统一按 UTC 存储，使用 DATETIME(3)。

CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(32) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_username UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS template_categories (
    code VARCHAR(32) NOT NULL,
    name VARCHAR(32) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (code)
);

CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(64) NOT NULL,
    category_code VARCHAR(32) NOT NULL,
    title VARCHAR(64) NOT NULL,
    description VARCHAR(500) NOT NULL,
    cover_url VARCHAR(255) NOT NULL,
    sample_result_path VARCHAR(255) NOT NULL,
    required_image_count INT NOT NULL,
    accepted_mime_types VARCHAR(128) NOT NULL,
    max_file_size_bytes BIGINT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_templates_required_count CHECK (required_image_count BETWEEN 1 AND 6),
    CONSTRAINT fk_templates_category FOREIGN KEY (category_code) REFERENCES template_categories (code),
    KEY idx_templates_category (category_code, sort_order)
);

CREATE TABLE IF NOT EXISTS assets (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    template_id VARCHAR(64) NOT NULL,
    storage_key VARCHAR(128) NOT NULL,
    original_filename VARCHAR(255) NULL,
    mime_type VARCHAR(32) NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_assets_storage_key UNIQUE (storage_key),
    CONSTRAINT fk_assets_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_assets_template FOREIGN KEY (template_id) REFERENCES templates (id),
    KEY idx_assets_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    template_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    stage VARCHAR(16) NULL,
    failed_stage VARCHAR(16) NULL,
    failure_reason VARCHAR(500) NULL,
    result_url VARCHAR(255) NULL,
    sim_fail_stage VARCHAR(16) NOT NULL DEFAULT 'NONE',
    sim_stage_delay_ms INT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    started_at DATETIME(3) NULL,
    finished_at DATETIME(3) NULL,
    updated_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_tasks_template FOREIGN KEY (template_id) REFERENCES templates (id),
    KEY idx_tasks_user_created (user_id, created_at DESC),
    KEY idx_tasks_status (status)
);

CREATE TABLE IF NOT EXISTS task_assets (
    task_id BIGINT NOT NULL,
    slot_index INT NOT NULL,
    asset_id BIGINT NOT NULL,
    PRIMARY KEY (task_id, slot_index),
    CONSTRAINT fk_task_assets_task FOREIGN KEY (task_id) REFERENCES tasks (id),
    CONSTRAINT fk_task_assets_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE IF NOT EXISTS task_stage_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    stage VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    message VARCHAR(500) NULL,
    started_at DATETIME(3) NOT NULL,
    finished_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_stage_log UNIQUE (task_id, stage),
    CONSTRAINT fk_stage_logs_task FOREIGN KEY (task_id) REFERENCES tasks (id)
);
