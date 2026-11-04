-- 种子数据：3 个演示用户、3 个分类、7 个模板。
-- 使用 ON DUPLICATE KEY UPDATE 主键自赋值保证重复执行不报错；
-- 不使用 MySQL 已弃用的 VALUES() 写法，MySQL 8.4 与 H2 MySQL 模式均支持。
-- 时间为 UTC 固定值，避免不同机器的时区影响测试断言。

INSERT INTO users (id, username, display_name, created_at)
VALUES (1, 'alice', 'Alice', '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO users (id, username, display_name, created_at)
VALUES (2, 'bob', 'Bob', '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO users (id, username, display_name, created_at)
VALUES (3, 'carol', 'Carol', '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO template_categories (code, name, sort_order)
VALUES ('creative', '创意图片', 1)
ON DUPLICATE KEY UPDATE code = code;

INSERT INTO template_categories (code, name, sort_order)
VALUES ('festival', '节日贺卡', 2)
ON DUPLICATE KEY UPDATE code = code;

INSERT INTO template_categories (code, name, sort_order)
VALUES ('collage', '拼图海报', 3)
ON DUPLICATE KEY UPDATE code = code;

INSERT INTO templates (id, category_code, title, description, cover_url, sample_result_path,
                       required_image_count, accepted_mime_types, max_file_size_bytes, sort_order, created_at)
VALUES ('demo-postcard', 'creative', '旅行明信片',
        '上传 2 张照片，模拟生成一张旅行明信片', '/demo/covers/postcard.png', 'static/demo/results/postcard.png',
        2, 'image/jpeg,image/png', 5242880, 1, '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO templates (id, category_code, title, description, cover_url, sample_result_path,
                       required_image_count, accepted_mime_types, max_file_size_bytes, sort_order, created_at)
VALUES ('demo-polaroid', 'creative', '拍立得相框',
        '上传 1 张照片，生成一张带白边的拍立得相框', '/demo/covers/polaroid.png', 'static/demo/results/polaroid.png',
        1, 'image/jpeg,image/png,image/webp', 5242880, 2, '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO templates (id, category_code, title, description, cover_url, sample_result_path,
                       required_image_count, accepted_mime_types, max_file_size_bytes, sort_order, created_at)
VALUES ('demo-comic', 'creative', '漫画分镜',
        '上传 4 张照片，拼接成四格漫画分镜', '/demo/covers/comic.png', 'static/demo/results/comic.png',
        4, 'image/jpeg,image/png', 3145728, 3, '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO templates (id, category_code, title, description, cover_url, sample_result_path,
                       required_image_count, accepted_mime_types, max_file_size_bytes, sort_order, created_at)
VALUES ('demo-spring-card', 'festival', '新春贺卡',
        '上传 1 张照片，生成一张新春贺卡', '/demo/covers/spring-card.png', 'static/demo/results/spring-card.png',
        1, 'image/jpeg,image/png', 5242880, 4, '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO templates (id, category_code, title, description, cover_url, sample_result_path,
                       required_image_count, accepted_mime_types, max_file_size_bytes, sort_order, created_at)
VALUES ('demo-birthday', 'festival', '生日祝福',
        '上传 3 张照片，合成生日祝福卡片', '/demo/covers/birthday.png', 'static/demo/results/birthday.png',
        3, 'image/jpeg,image/png', 5242880, 5, '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO templates (id, category_code, title, description, cover_url, sample_result_path,
                       required_image_count, accepted_mime_types, max_file_size_bytes, sort_order, created_at)
VALUES ('demo-grid9', 'collage', '九宫格海报',
        '上传 6 张照片，拼成九宫格海报', '/demo/covers/grid9.png', 'static/demo/results/grid9.png',
        6, 'image/jpeg,image/png,image/webp', 2097152, 6, '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO templates (id, category_code, title, description, cover_url, sample_result_path,
                       required_image_count, accepted_mime_types, max_file_size_bytes, sort_order, created_at)
VALUES ('demo-poster', 'collage', '双图对比海报',
        '上传 2 张照片，生成双图对比海报', '/demo/covers/poster.png', 'static/demo/results/poster.png',
        2, 'image/jpeg,image/png', 5242880, 7, '2026-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE id = id;
