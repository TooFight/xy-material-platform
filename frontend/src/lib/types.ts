/**
 * 前后端共享类型，字段名与枚举值以 docs/api.md 为准。
 * 修改 TaskStatus / TaskStage 时必须同步后端枚举。
 */

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type TaskStage = "CHECKING" | "GENERATING" | "FINALIZING";

export type StageLogStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

/** GET /api/users、GET /api/me 返回的用户。 */
export interface UserDTO {
  id: number;
  username: string;
  displayName: string;
}

/** 模板列表 / 详情里内嵌的分类摘要。 */
export interface TemplateCategoryRef {
  code: string;
  name: string;
}

/** GET /api/template-categories 返回的分类。 */
export interface TemplateCategory extends TemplateCategoryRef {
  templateCount: number;
}

/** GET /api/templates 的列表项（只含卡片需要的字段）。 */
export interface TemplateSummary {
  id: string;
  title: string;
  category: TemplateCategoryRef;
  coverUrl: string;
  requiredImageCount: number;
}

/** GET /api/templates/{id} 的详情。 */
export interface TemplateDetail extends TemplateSummary {
  description: string;
  acceptedMimeTypes: string[];
  maxFileSizeBytes: number;
}

/** POST /api/assets 的响应。 */
export interface AssetDTO {
  id: number;
  templateId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface TaskAssetDTO {
  id: number;
  slotIndex: number;
  url: string;
}

export interface TaskStageLogDTO {
  stage: TaskStage;
  status: StageLogStatus;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
}

export interface TaskDTO {
  id: number;
  templateId: string;
  templateTitle: string;
  templateCoverUrl: string;
  status: TaskStatus;
  stage: TaskStage | null;
  failedStage: TaskStage | null;
  failureReason: string | null;
  resultUrl: string | null;
  assets: TaskAssetDTO[];
  /** 列表接口省略阶段明细时为 null。 */
  stages: TaskStageLogDTO[] | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

/** GET /api/tasks（active=false）的分页响应。 */
export interface TaskListResponse {
  items: TaskDTO[];
  page: number;
  size: number;
  total: number;
}

/** GET /api/tasks?active=true 的响应。 */
export interface ActiveTaskListResponse {
  items: TaskDTO[];
}

/** 所有非 2xx 响应的统一错误体。 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface HealthResponse {
  status: "UP";
}

export type SimulationFailStage = "NONE" | TaskStage;

/** GET / PUT /api/dev/simulation（仅开发环境）。 */
export interface SimulationConfig {
  failStage: SimulationFailStage;
  stageDelayMs: number;
}
