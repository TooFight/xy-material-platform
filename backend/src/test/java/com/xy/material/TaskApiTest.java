package com.xy.material;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xy.material.asset.AssetService;
import com.xy.material.support.TestImages;
import com.xy.material.task.Sleeper;
import com.xy.material.task.StageLogDto;
import com.xy.material.task.StageLogStatus;
import com.xy.material.task.StartupCleanup;
import com.xy.material.task.TaskAssetDto;
import com.xy.material.task.TaskDto;
import com.xy.material.task.TaskMapper;
import com.xy.material.task.TaskQueryService;
import com.xy.material.task.TaskRow;
import com.xy.material.task.TaskStage;
import com.xy.material.task.TaskStatus;
import com.xy.material.task.TaskStore;
import com.xy.material.task.simulation.SimulationConfig;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TaskApiTest.TestConfig.class)
class TaskApiTest {

    private static final long USER_A = 1L;
    private static final long USER_B = 3L;
    private static final Path STORAGE_DIR = createStorageDirectory();

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registry.add("app.storage.dir", STORAGE_DIR::toString);
    }

    @AfterAll
    static void cleanStorage() throws IOException {
        deleteRecursively(STORAGE_DIR);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AssetService assetService;

    @Autowired
    private TaskQueryService taskQueryService;

    @Autowired
    private TaskMapper taskMapper;

    @Autowired
    private TaskStore taskStore;

    @Autowired
    private SimulationConfig simulationConfig;

    @Autowired
    private StartupCleanup startupCleanup;

    @Autowired
    private ControlledSleeper controlledSleeper;

    @BeforeEach
    void resetState() {
        controlledSleeper.clear();
        simulationConfig.update("NONE", 0);
    }

    @AfterEach
    void releaseSleeper() {
        controlledSleeper.release();
        simulationConfig.update("NONE", 0);
    }

    @Test
    void successfulTaskExecutesStagesInOrderAndStoresResult() throws Exception {
        simulationConfig.update("NONE", 0);
        long asset1 = uploadAsset(USER_A, "demo-postcard", "jpg");
        long asset2 = uploadAsset(USER_A, "demo-postcard", "png");

        MvcResult result = postTask(USER_A, "demo-postcard", List.of(asset1, asset2))
                .andExpect(status().isAccepted())
                .andExpect(header().string("Location", matchesPattern("/api/tasks/\\d+")))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.stage").value(nullValue()))
                .andExpect(jsonPath("$.stages").isEmpty())
                .andReturn();
        long taskId = readId(result);

        TaskDto task = awaitStatus(USER_A, taskId, TaskStatus.SUCCEEDED);

        assertThat(task.templateId()).isEqualTo("demo-postcard");
        assertThat(task.templateTitle()).isEqualTo("旅行明信片");
        assertThat(task.templateCoverUrl()).isEqualTo("/demo/covers/postcard.png");
        assertThat(task.status()).isEqualTo(TaskStatus.SUCCEEDED);
        assertThat(task.stage()).isEqualTo(TaskStage.FINALIZING);
        assertThat(task.failedStage()).isNull();
        assertThat(task.failureReason()).isNull();
        assertThat(task.resultUrl()).isNotBlank();
        assertThat(task.createdAt()).isNotNull();
        assertThat(task.startedAt()).isNotNull();
        assertThat(task.finishedAt()).isNotNull();
        assertThat(task.finishedAt()).isAfterOrEqualTo(task.startedAt());
        assertThat(task.updatedAt()).isAfterOrEqualTo(task.createdAt());

        assertThat(task.assets()).hasSize(2);
        assertThat(task.assets()).extracting(TaskAssetDto::id).containsExactly(asset1, asset2);
        assertThat(task.assets()).extracting(TaskAssetDto::slotIndex).containsExactly(0, 1);
        assertThat(task.assets()).extracting(TaskAssetDto::url).allMatch(url -> url.startsWith("/files/assets/"));

        assertThat(task.stages()).hasSize(3);
        assertThat(task.stages()).extracting(StageLogDto::stage)
                .containsExactly(TaskStage.CHECKING, TaskStage.GENERATING, TaskStage.FINALIZING);
        assertThat(task.stages()).extracting(StageLogDto::status)
                .containsOnly(StageLogStatus.SUCCEEDED);
        assertThat(task.stages()).extracting(StageLogDto::message).containsOnlyNulls();

        Instant previousFinish = null;
        for (StageLogDto stage : task.stages()) {
            assertThat(stage.startedAt()).isNotNull();
            assertThat(stage.finishedAt()).isNotNull();
            assertThat(stage.finishedAt()).isAfterOrEqualTo(stage.startedAt());
            if (previousFinish != null) {
                assertThat(stage.startedAt()).isAfterOrEqualTo(previousFinish);
            }
            previousFinish = stage.finishedAt();
        }

        Path resultFile = storedFile(task.resultUrl());
        assertThat(resultFile).isRegularFile();
        byte[] expected;
        try (var input = new ClassPathResource("static/demo/results/postcard.png").getInputStream()) {
            expected = input.readAllBytes();
        }
        assertThat(Files.readAllBytes(resultFile)).isEqualTo(expected);
    }

    @ParameterizedTest
    @EnumSource(TaskStage.class)
    void failureAtEachStageStopsPipeline(TaskStage failedStage) throws Exception {
        simulationConfig.update(failedStage.name(), 0);
        long asset1 = uploadAsset(USER_A, "demo-postcard", "jpg");
        long asset2 = uploadAsset(USER_A, "demo-postcard", "png");

        long taskId = submitAccepted(USER_A, "demo-postcard", List.of(asset1, asset2));
        TaskDto task = awaitStatus(USER_A, taskId, TaskStatus.FAILED);

        assertThat(task.status()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.failedStage()).isEqualTo(failedStage);
        assertThat(task.stage()).isEqualTo(failedStage);
        assertThat(task.failureReason()).isNotBlank();
        assertThat(task.failureReason()).isEqualTo("模拟" + failedStage.simulationLabel()
                + "失败：已按模拟配置在 " + failedStage.name() + " 阶段中断");
        assertThat(task.resultUrl()).isNull();
        assertThat(task.finishedAt()).isNotNull();

        int expectedStages = failedStage.ordinal() + 1;
        assertThat(task.stages()).hasSize(expectedStages);
        for (int index = 0; index < expectedStages; index++) {
            StageLogDto stage = task.stages().get(index);
            assertThat(stage.stage()).isEqualTo(TaskStage.values()[index]);
            assertThat(stage.status()).isEqualTo(
                    index == expectedStages - 1 ? StageLogStatus.FAILED : StageLogStatus.SUCCEEDED);
            assertThat(stage.finishedAt()).isAfterOrEqualTo(stage.startedAt());
            if (index == expectedStages - 1) {
                assertThat(stage.message()).isEqualTo(task.failureReason());
            } else {
                assertThat(stage.message()).isNull();
            }
        }
    }

    @Test
    void postReturnsBeforePipelineCompletes() throws Exception {
        controlledSleeper.block();
        simulationConfig.update("NONE", 0);
        long asset1 = uploadAsset(USER_A, "demo-postcard", "jpg");
        long asset2 = uploadAsset(USER_A, "demo-postcard", "png");

        long taskId;
        long elapsedMillis;
        try {
            long start = System.nanoTime();
            taskId = submitAccepted(USER_A, "demo-postcard", List.of(asset1, asset2));
            elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);

            assertThat(elapsedMillis).isLessThan(2000);
            TaskDto immediate = taskQueryService.getTask(USER_A, taskId);
            assertThat(immediate.status()).isIn(TaskStatus.PENDING, TaskStatus.RUNNING);
        } finally {
            controlledSleeper.release();
        }

        awaitStatus(USER_A, taskId, TaskStatus.SUCCEEDED);
    }

    @Test
    void terminalTaskCannotBeAdvancedOrChanged() throws Exception {
        long taskId = runSuccessfulTask();
        TaskDto before = taskQueryService.getTask(USER_A, taskId);

        assertThat(taskStore.enterStage(taskId, TaskStage.GENERATING)).isFalse();
        assertThat(taskStore.fail(taskId, TaskStage.GENERATING, "should-not-change")).isFalse();
        assertThat(taskStore.succeed(taskId, "/files/results/changed.png")).isFalse();

        TaskDto after = taskQueryService.getTask(USER_A, taskId);
        assertThat(after.status()).isEqualTo(TaskStatus.SUCCEEDED);
        assertThat(after.resultUrl()).isEqualTo(before.resultUrl());
        assertThat(after.failureReason()).isNull();
        assertThat(after.stages()).hasSize(3);
        assertThat(taskMapper.findById(taskId).orElseThrow().getStatus()).isEqualTo(TaskStatus.SUCCEEDED);
    }

    @Test
    void queryingPendingTaskDoesNotAdvanceIt() throws Exception {
        TaskRow pending = newTask(USER_A, TaskStatus.PENDING, null);
        assertThat(taskMapper.insert(pending)).isEqualTo(1);
        long taskId = pending.getId();

        TaskDto first = taskQueryService.getTask(USER_A, taskId);
        TaskDto second = taskQueryService.getTask(USER_A, taskId);

        assertThat(first.status()).isEqualTo(TaskStatus.PENDING);
        assertThat(second.status()).isEqualTo(TaskStatus.PENDING);
        assertThat(second.stages()).isEmpty();
        assertThat(taskMapper.findById(taskId).orElseThrow().getStatus()).isEqualTo(TaskStatus.PENDING);
    }

    @Test
    void userCannotSeeOrUseAnotherUsersTask() throws Exception {
        long taskId = runSuccessfulTask();
        long asset1 = uploadAsset(USER_A, "demo-postcard", "jpg");
        long asset2 = uploadAsset(USER_A, "demo-postcard", "png");

        mockMvc.perform(get("/api/tasks/" + taskId).header("X-User-Id", String.valueOf(USER_B)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        MvcResult listResult = mockMvc.perform(get("/api/tasks").header("X-User-Id", String.valueOf(USER_B)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode items = objectMapper.readTree(listResult.getResponse().getContentAsByteArray()).get("items");
        for (JsonNode item : items) {
            assertThat(item.get("id").asLong()).isNotEqualTo(taskId);
        }

        postTask(USER_B, "demo-postcard", List.of(asset1, asset2))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void submitRejectsWrongAssetCount() throws Exception {
        long asset = uploadAsset(USER_A, "demo-postcard", "png");
        postTask(USER_A, "demo-postcard", List.of(asset))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void submitRejectsDuplicateAssetIds() throws Exception {
        long asset1 = uploadAsset(USER_A, "demo-postcard", "jpg");
        long asset2 = uploadAsset(USER_A, "demo-postcard", "png");
        postTask(USER_A, "demo-postcard", List.of(asset1, asset1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        assertThat(asset2).isPositive();
    }

    @Test
    void submitRejectsAssetFromOtherTemplate() throws Exception {
        long postcard = uploadAsset(USER_A, "demo-postcard", "png");
        long polaroid = uploadAsset(USER_A, "demo-polaroid", "png");
        postTask(USER_A, "demo-postcard", List.of(postcard, polaroid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void submitRejectsAssetFromOtherUser() throws Exception {
        long mine = uploadAsset(USER_A, "demo-postcard", "png");
        long others = uploadAsset(USER_B, "demo-postcard", "png");
        postTask(USER_A, "demo-postcard", List.of(mine, others))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void submitRejectsUnknownTemplate() throws Exception {
        long asset1 = uploadAsset(USER_A, "demo-postcard", "jpg");
        long asset2 = uploadAsset(USER_A, "demo-postcard", "png");
        postTask(USER_A, "missing-template", List.of(asset1, asset2))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void simulationConfigIsSnapshottedAtAcceptance() throws Exception {
        simulationConfig.update("GENERATING", 0);
        long asset1 = uploadAsset(USER_A, "demo-postcard", "jpg");
        long asset2 = uploadAsset(USER_A, "demo-postcard", "png");

        long taskId = submitAccepted(USER_A, "demo-postcard", List.of(asset1, asset2));
        TaskRow row = taskMapper.findById(taskId).orElseThrow();
        assertThat(row.getSimFailStage()).isEqualTo("GENERATING");
        assertThat(row.getSimStageDelayMs()).isZero();

        simulationConfig.update("NONE", 0);
        TaskDto task = awaitStatus(USER_A, taskId, TaskStatus.FAILED);
        assertThat(task.failedStage()).isEqualTo(TaskStage.GENERATING);
    }

    @Test
    void startupCleanupFailsUnfinishedTasksOnly() {
        TaskRow pending = newTask(USER_A, TaskStatus.PENDING, null);
        TaskRow running = newTask(USER_A, TaskStatus.RUNNING, TaskStage.CHECKING);
        TaskRow succeeded = newTask(USER_A, TaskStatus.SUCCEEDED, TaskStage.FINALIZING);
        taskMapper.insert(pending);
        taskMapper.insert(running);
        taskMapper.insert(succeeded);

        startupCleanup.cleanup();

        TaskRow cleanedPending = taskMapper.findById(pending.getId()).orElseThrow();
        assertThat(cleanedPending.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(cleanedPending.getFailedStage()).isNull();
        assertThat(cleanedPending.getFailureReason()).isEqualTo("服务重启，任务已中断");

        TaskRow cleanedRunning = taskMapper.findById(running.getId()).orElseThrow();
        assertThat(cleanedRunning.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(cleanedRunning.getFailedStage()).isNull();
        assertThat(cleanedRunning.getFailureReason()).isEqualTo("服务重启，任务已中断");

        TaskRow untouched = taskMapper.findById(succeeded.getId()).orElseThrow();
        assertThat(untouched.getStatus()).isEqualTo(TaskStatus.SUCCEEDED);
        assertThat(untouched.getResultUrl()).isEqualTo("/files/results/existing.png");
    }

    @Test
    void taskListPaginatesAndOmitsStages() throws Exception {
        long taskId = runSuccessfulTask();

        MvcResult pageResult = mockMvc.perform(get("/api/tasks")
                        .header("X-User-Id", String.valueOf(USER_A)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(20))
                .andReturn();
        JsonNode page = objectMapper.readTree(pageResult.getResponse().getContentAsByteArray());
        assertThat(page.get("total").asLong()).isGreaterThanOrEqualTo(1);
        JsonNode target = null;
        for (JsonNode item : page.get("items")) {
            if (item.get("id").asLong() == taskId) {
                target = item;
            }
        }
        assertThat(target).isNotNull();
        assertThat(target.get("stages").isNull()).isTrue();

        MvcResult activeResult = mockMvc.perform(get("/api/tasks")
                        .param("active", "true")
                        .header("X-User-Id", String.valueOf(USER_A)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode active = objectMapper.readTree(activeResult.getResponse().getContentAsByteArray());
        assertThat(active.has("page")).isFalse();
        assertThat(active.get("items").isArray()).isTrue();
        for (JsonNode item : active.get("items")) {
            assertThat(item.get("id").asLong()).isNotEqualTo(taskId);
        }
    }

    private long runSuccessfulTask() throws Exception {
        simulationConfig.update("NONE", 0);
        long asset1 = uploadAsset(USER_A, "demo-postcard", "jpg");
        long asset2 = uploadAsset(USER_A, "demo-postcard", "png");
        long taskId = submitAccepted(USER_A, "demo-postcard", List.of(asset1, asset2));
        awaitStatus(USER_A, taskId, TaskStatus.SUCCEEDED);
        return taskId;
    }

    private long uploadAsset(long userId, String templateId, String format) {
        boolean jpeg = "jpg".equals(format);
        byte[] bytes = jpeg ? TestImages.jpeg() : TestImages.png();
        String contentType = jpeg ? MediaType.IMAGE_JPEG_VALUE : MediaType.IMAGE_PNG_VALUE;
        return assetService.upload(userId, templateId,
                new MockMultipartFile("file", "asset." + format, contentType, bytes)).id();
    }

    private ResultActions postTask(long userId, String templateId, List<Long> assetIds) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "templateId", templateId,
                "assetIds", assetIds
        ));
        return mockMvc.perform(post("/api/tasks")
                .header("X-User-Id", String.valueOf(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private long submitAccepted(long userId, String templateId, List<Long> assetIds) throws Exception {
        MvcResult result = postTask(userId, templateId, assetIds)
                .andExpect(status().isAccepted())
                .andReturn();
        return readId(result);
    }

    private long readId(MvcResult result) throws IOException {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray()).get("id").asLong();
    }

    private TaskDto awaitStatus(long userId, long taskId, TaskStatus expected) {
        await().atMost(Duration.ofSeconds(10))
                .pollInterval(Duration.ofMillis(50))
                .untilAsserted(() -> assertThat(taskQueryService.getTask(userId, taskId).status())
                        .isEqualTo(expected));
        return taskQueryService.getTask(userId, taskId);
    }

    private TaskRow newTask(long userId, TaskStatus status, TaskStage stage) {
        LocalDateTime now = LocalDateTime.now(Clock.systemUTC()).truncatedTo(ChronoUnit.MILLIS);
        TaskRow task = new TaskRow();
        task.setUserId(userId);
        task.setTemplateId("demo-postcard");
        task.setStatus(status);
        task.setStage(stage);
        task.setSimFailStage("NONE");
        task.setSimStageDelayMs(0);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        if (status == TaskStatus.RUNNING) {
            task.setStartedAt(now);
        }
        if (status == TaskStatus.SUCCEEDED) {
            task.setStartedAt(now);
            task.setFinishedAt(now);
            task.setResultUrl("/files/results/existing.png");
        }
        return task;
    }

    private Path storedFile(String url) {
        return STORAGE_DIR.resolve(url.substring("/files/".length())).normalize();
    }

    private static Path createStorageDirectory() {
        try {
            return Files.createTempDirectory("xy-task-api-");
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private static void deleteRecursively(Path root) throws IOException {
        if (!Files.exists(root)) {
            return;
        }
        try (var paths = Files.walk(root)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // 临时目录清理失败不影响测试结论。
                }
            });
        }
    }

    static class ControlledSleeper implements Sleeper {

        private final AtomicReference<CountDownLatch> gate = new AtomicReference<>();

        @Override
        public void sleep(long millis) throws InterruptedException {
            CountDownLatch latch = gate.get();
            if (latch != null && !latch.await(10, TimeUnit.SECONDS)) {
                throw new InterruptedException("controlled sleeper timed out");
            }
        }

        void block() {
            gate.set(new CountDownLatch(1));
        }

        void release() {
            CountDownLatch latch = gate.getAndSet(null);
            if (latch != null) {
                latch.countDown();
            }
        }

        void clear() {
            release();
        }
    }

    @TestConfiguration
    static class TestConfig {

        @Bean
        @Primary
        ControlledSleeper controlledSleeper() {
            return new ControlledSleeper();
        }
    }
}
