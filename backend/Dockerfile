# syntax=docker/dockerfile:1

# 构建阶段：使用 Maven 3.9 + JDK 21，与 CI 的 Temurin 21 保持一致。
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /workspace

# mvnw 以 100755 入库；这里再 chmod 一次，避免 Windows 检出后权限丢失。
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw

# 先只复制 pom，利用依赖下载层缓存；源码变化时只重新编译。
RUN ./mvnw -B -q dependency:go-offline

COPY src ./src
RUN ./mvnw -B clean package -DskipTests

# 运行阶段：仅保留 JRE，并以非 root 用户运行。
FROM eclipse-temurin:21-jre AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --create-home --home-dir /app --shell /usr/sbin/nologin app \
    && mkdir -p /data/uploads \
    && chown -R app:app /app /data/uploads

WORKDIR /app

COPY --from=build --chown=app:app /workspace/target/*.jar /app/app.jar

ENV APP_STORAGE_DIR=/data/uploads \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"

USER 10001:10001

EXPOSE 8080

# Compose 会覆盖为 service healthcheck；保留独立运行镜像时的 /api/health 探测。
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=10 \
    CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
