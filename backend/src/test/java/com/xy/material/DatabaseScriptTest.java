package com.xy.material;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;

/**
 * 不启动 Spring：直接在 H2（MySQL 模式）里把 schema.sql + data.sql 连续执行两次，
 * 验证两份脚本在测试数据库上幂等。
 */
class DatabaseScriptTest {

    @Test
    void schemaAndDataScriptsRunTwiceInH2MySqlMode() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:scripts;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", "")) {
            for (int run = 0; run < 2; run++) {
                executeSqlScript(connection,
                        new EncodedResource(new ClassPathResource("db/schema.sql"), StandardCharsets.UTF_8));
                executeSqlScript(connection,
                        new EncodedResource(new ClassPathResource("db/data.sql"), StandardCharsets.UTF_8));
            }

            assertThat(count(connection, "users")).isEqualTo(3);
            assertThat(count(connection, "template_categories")).isEqualTo(3);
            assertThat(count(connection, "templates")).isEqualTo(7);
            assertThat(countWhere(connection, "templates", "category_code = 'creative'")).isEqualTo(3);
            assertThat(countWhere(connection, "templates", "category_code = 'festival'")).isEqualTo(2);
            assertThat(countWhere(connection, "templates", "category_code = 'collage'")).isEqualTo(2);
            assertThat(queryString(connection, "SELECT display_name FROM users WHERE id = 1")).isEqualTo("Alice");
            assertThat(queryString(connection, "SELECT title FROM templates WHERE id = 'demo-postcard'"))
                    .isEqualTo("旅行明信片");
        }
    }

    private static long count(Connection connection, String table) throws SQLException {
        return countWhere(connection, table, null);
    }

    private static long countWhere(Connection connection, String table, String predicate) throws SQLException {
        String sql = "SELECT COUNT(*) FROM " + table + (predicate == null ? "" : " WHERE " + predicate);
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            resultSet.next();
            return resultSet.getLong(1);
        }
    }

    private static String queryString(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            assertThat(resultSet.next()).isTrue();
            return resultSet.getString(1);
        }
    }
}
