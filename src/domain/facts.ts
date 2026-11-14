/** 中文：逐部位事实的唯一校验及汇总入口，不访问存储。 English: The sole positional-fact validation and aggregation boundary, without storage access. */
import type { RiskLevel, FrozenInspectionPlan, FrozenTaskEntry, RiskAcknowledgement, TaskMeasurementValue, TaskObservation, TaskStatus } from "./types";
import { workflowCanonicalJson, workflowHash } from "./canonical";
export class TaskFactError extends Error {
    constructor(readonly code: string, readonly field: string) {
        super(`${code}: ${field}`);
        this.name = "TaskFactError";
    }
}
/** 中文：以任务事实错误码和字段中止操作，让调用方保留具体失败原因。
 * English: Abort with a task-fact error code and field so callers retain the specific failure reason.
 */
function fail(code: string, field: string): never { throw new TaskFactError(code, field); }
const statuses = new Set<TaskStatus>(["normal", "abnormal", "unknown", "not_applicable"]);
const rank: Record<RiskLevel, number> = { none: 0, minor: 1, moderate: 2, serious: 3 };
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
/** 中文：确认时间是带日期前缀且可解析的字符串，用于事实与测量时间校验。
 * English: Check for a parseable timestamp string with a date prefix when validating fact and measurement times.
 */
const isTime = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
/** 中文：仅按条目身份从本次冻结计划取任务；缺失时拒绝，不读取另一检测的任务。
 * English: Resolve a task only by entry ID in this frozen plan; reject missing entries without reading another inspection’s tasks.
 */
export function findFrozenTask(plan: FrozenInspectionPlan, entryId: string): FrozenTaskEntry {
    return plan.tasks.find((entry) => entry.entryId === entryId) ?? fail("TASK_NOT_IN_FROZEN_PLAN", "taskEntryId");
}
export interface TaskFactInput {
    status: TaskStatus | null;
    resolutionReason: string | null;
    riskAcknowledgement: RiskAcknowledgement | null;
    findingCodes: string[];
    note: string;
    measurementValues: TaskMeasurementValue[];
    evidenceFileIds: string[];
    inspectedAt: string | null;
}
/** 中文：仅用字符串规范固定精度读数，拒绝超精度而不舍入，补足小数位并归一负零；不经过浮点数。
 * English: Normalize fixed-precision readings with strings only: reject excess precision rather than rounding, pad decimals, and normalize negative zero without floating-point conversion.
 */
export function fixedTaskDecimal(value: unknown, precision: number, negativeAllowed: boolean): string {
    if (typeof value !== "string" || value.length > 48 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
        || !Number.isSafeInteger(precision) || precision < 0 || precision > 12)
        fail("INVALID_TASK_MEASUREMENT", "value");
    const text = value as string;
    if (text.startsWith("-") && !negativeAllowed)
        fail("INVALID_TASK_MEASUREMENT", "negative");
    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > precision)
        fail("INVALID_TASK_MEASUREMENT", "precision");
    const normalizedWhole = /^-0$/.test(whole) && !/[1-9]/.test(fraction) ? "0" : whole;
    return precision ? `${normalizedWhole}.${fraction.padEnd(precision, "0")}` : normalizedWhole;
}
/** 中文：按冻结任务严格校验新事实的状态、理由、安全确认、迹象、证据身份及测量上下文；保留未选择状态并返回规范化副本。
 * English: Strictly validate new facts against the frozen task's status, reasons, safety acknowledgement, findings, evidence IDs, and measurement context, returning normalized data while preserving an unselected status.
 */
export function normalizeTaskFacts(entry: FrozenTaskEntry, input: TaskFactInput): TaskFactInput {
    if (!input || typeof input !== "object" || (input.status !== null && !statuses.has(input.status)))
        fail("INVALID_TASK_STATUS", "status");
    if (typeof input.note !== "string" || input.note.length > 20000)
        fail("INVALID_TASK_FACT", "note");
    if (input.resolutionReason !== null && (typeof input.resolutionReason !== "string" || input.resolutionReason.length > 2000))
        fail("INVALID_TASK_FACT", "resolutionReason");
    const reason = input.resolutionReason?.trim() || null;
    if (input.status === "unknown" && !reason)
        fail("TASK_REASON_REQUIRED", "resolutionReason");
    if (input.status === "not_applicable" && entry.applicable && !reason)
        fail("TASK_REASON_REQUIRED", "resolutionReason");
    if (!entry.applicable && (input.status === "normal" || input.status === "abnormal"))
        fail("TASK_SCOPE_INVALID", "status");
    if (input.status !== null && !isTime(input.inspectedAt))
        fail("TASK_TIME_REQUIRED", "inspectedAt");
    if (input.inspectedAt !== null && !isTime(input.inspectedAt))
        fail("INVALID_TASK_FACT", "inspectedAt");
    const ack = input.riskAcknowledgement;
    if (ack !== null && (!ack || typeof ack !== "object" || typeof ack.warningVersion !== "string"
        || !["continue", "skip_for_reinspection"].includes(ack.decision) || !isTime(ack.decidedAt)))
        fail("INVALID_TASK_FACT", "riskAcknowledgement");
    if (entry.definition.safetyGateRequired && (input.status === "normal" || input.status === "abnormal")
        && (ack?.decision !== "continue" || ack.warningVersion !== entry.definition.warningVersion))
        fail("TASK_SAFETY_ACK_REQUIRED", "riskAcknowledgement");
    if (!Array.isArray(input.findingCodes) || input.findingCodes.some((code) => typeof code !== "string")
        || new Set(input.findingCodes).size !== input.findingCodes.length)
        fail("INVALID_TASK_FINDING", "findingCodes");
    const findingCodes = [...input.findingCodes].sort();
    if (findingCodes.some((code) => !entry.definition.findings.some((finding) => finding.findingCode === code)))
        fail("INVALID_TASK_FINDING", "findingCodes");
    if (findingCodes.some((code) => !entry.task.findingCodes.includes(code)))
        fail("INVALID_TASK_FINDING", "taskFindingScope");
    if (input.status !== "abnormal" && findingCodes.length)
        fail("INVALID_TASK_FINDING", "status");
    if (input.status === "abnormal" && findingCodes.length === 0)
        fail("TASK_FINDING_REQUIRED", "findingCodes");
    if (!Array.isArray(input.evidenceFileIds) || input.evidenceFileIds.some((id) => typeof id !== "string" || !identifier.test(id))
        || new Set(input.evidenceFileIds).size !== input.evidenceFileIds.length)
        fail("INVALID_TASK_EVIDENCE", "evidenceFileIds");
    if (!Array.isArray(input.measurementValues))
        fail("INVALID_TASK_MEASUREMENT", "measurementValues");
    const fields = entry.definition.measurementFields;
    const seen = new Set<string>();
    const measurementValues = input.measurementValues.map((value) => {
        if (!value || typeof value !== "object")
            return fail("INVALID_TASK_MEASUREMENT", "shape");
        const field = fields.find((candidate) => candidate.fieldKey === value.fieldKey);
        if (!field || seen.has(value.fieldKey))
            return fail("INVALID_TASK_MEASUREMENT", "fieldKey");
        seen.add(value.fieldKey);
        if (!field.allowedUnits.includes(value.unit))
            fail("INVALID_TASK_MEASUREMENT", "unit");
        if (typeof value.method !== "string" || typeof value.tool !== "string" || (value.measuredAt !== "" && !isTime(value.measuredAt)))
            fail("INVALID_TASK_MEASUREMENT", "context");
        if (!value.context || typeof value.context !== "object" || Array.isArray(value.context)
            || Object.values(value.context).some((item) => typeof item !== "string" || item.length > 2000))
            fail("INVALID_TASK_MEASUREMENT", "context");
        return { ...value, value: fixedTaskDecimal(value.value, field.precision, field.negativeAllowed), context: { ...value.context } };
    }).sort((a, b) => a.fieldKey.localeCompare(b.fieldKey, "en"));
    const missingContext = taskMeasurementLimitations(entry, measurementValues);
    if (input.status === "normal") {
        const requiredFields = entry.task.normalRequiredMeasurementFields ?? fields.filter((field) => field.requiredForNormal).map((field) => field.fieldKey);
        if (requiredFields.some((fieldKey) => !seen.has(fieldKey) || missingContext.some((limitation) => limitation.fieldKey === fieldKey))
            || fields.some((field) => (field.absentContextStatus === "unknown" && missingContext.some((limitation) => limitation.fieldKey === field.fieldKey)))) {
            fail("TASK_MEASUREMENT_CONTEXT_REQUIRED", "measurementValues");
        }
    }
    if (input.status === "abnormal") {
        const requiredFields = entry.definition.findings.filter((finding) => findingCodes.includes(finding.findingCode)).flatMap((finding) => finding.requiredMeasurementFields ?? []) ?? [];
        if (requiredFields.some((fieldKey) => !seen.has(fieldKey)
            || missingContext.some((limitation) => limitation.fieldKey === fieldKey))) {
            fail("TASK_MEASUREMENT_CONTEXT_REQUIRED", "measurementValues");
        }
    }
    return { status: input.status, resolutionReason: reason ?? (input.status === "not_applicable" ? entry.applicabilityReason : null),
        riskAcknowledgement: ack ? { ...ack } : null, findingCodes, note: input.note,
        measurementValues, evidenceFileIds: [...input.evidenceFileIds].sort(), inspectedAt: input.status === null ? null : input.inspectedAt };
}
/** 中文：逐读数列出缺失定义或必需上下文；缺项保持可见限制，不自动补造工具、方法或时间。
 * English: List missing definitions or required context for each reading, preserving visible limitations without inventing a tool, method, or time.
 */
export function taskMeasurementLimitations(entry: FrozenTaskEntry, values: TaskMeasurementValue[]) {
    const fields = entry.definition.measurementFields;
    return values.flatMap((value) => {
        const field = fields.find((candidate) => candidate.fieldKey === value.fieldKey);
        if (!field)
            return [{ fieldKey: value.fieldKey, missing: ["definition"] }];
        const available: Record<string, string> = { ...value.context, method: value.method, tool: value.tool, measured_at: value.measuredAt, observed_at: value.measuredAt, measuredAt: value.measuredAt, time: value.measuredAt };
        const missing = field.requiredContext.filter((key) => !available[key]?.trim());
        return missing.length ? [{ fieldKey: value.fieldKey, missing }] : [];
    });
}
/** 中文：生成未检查事实，供表单与新检测使用。 English: Create unassessed facts for forms and new inspections. */
export function emptyTaskFacts(): TaskFactInput { return { status: null, resolutionReason: null, riskAcknowledgement: null, findingCodes: [], note: "", measurementValues: [], evidenceFileIds: [], inspectedAt: null }; }
/** 中文：从观察提取可编辑事实，不把身份字段交给表单修改。 English: Extract editable facts without allowing forms to change record identity. */
export function taskFactInput(observation?: TaskObservation): TaskFactInput {
    if (!observation)
        return emptyTaskFacts();
    const { status, resolutionReason, riskAcknowledgement, findingCodes, note, measurementValues, evidenceFileIds, inspectedAt } = observation;
    return structuredClone({ status, resolutionReason, riskAcknowledgement, findingCodes, note, measurementValues, evidenceFileIds, inspectedAt });
}
export interface TaskFactContext {
    inspectionId: string;
    now: string;
}
/** 中文：由检测与任务构造独立身份，未提供事实保持未检查。 English: Bind a new fact to its inspection and task, leaving absent facts unassessed. */
export async function createTaskObservation(plan: FrozenInspectionPlan, taskEntryId: string, context: TaskFactContext, input?: TaskFactInput): Promise<TaskObservation> {
    const entry = findFrozenTask(plan, taskEntryId);
    const id = `taskobs_${await workflowHash(["vhc-task-v1.3", context.inspectionId, entry.entryId])}`;
    return { id, inspectionId: context.inspectionId, taskEntryId: entry.entryId, taskKey: entry.taskKey, checklistItemId: entry.definition.id,
        ...normalizeTaskFacts(entry, input ?? emptyTaskFacts()), version: 1, createdAt: context.now, updatedAt: context.now };
}
/** 中文：核对检测及任务身份并验证保存事实，拒绝跨检测混合。 English: Verify inspection/task identities and facts, rejecting records mixed across inspections. */
export function indexTaskObservations(plan: FrozenInspectionPlan, observations: TaskObservation[]): Map<string, TaskObservation> {
    if (new Set(observations.map(f => f.inspectionId)).size > 1)
        fail("TASK_SCOPE_INVALID", "inspectionId");
    const result = new Map<string, TaskObservation>();
    for (const fact of observations) {
        const entry = findFrozenTask(plan, fact.taskEntryId);
        if (result.has(entry.entryId) || fact.taskKey !== entry.taskKey || fact.checklistItemId !== entry.definition.id)
            fail("TASK_SCOPE_INVALID", "identity");
        normalizeTaskFacts(entry, fact);
        result.set(entry.entryId, fact);
    }
    return result;
}
export type AggregateStatus = TaskStatus | "incomplete";
export interface TaskAggregate {
    key: string;
    taskEntryIds: string[];
    checklistItemIds: string[];
    status: AggregateStatus;
    completeness: "complete" | "incomplete";
    risk: RiskLevel;
    findings: {
        taskEntryId: string;
        checklistItemId: string;
        findingCode: string;
        risk: RiskLevel;
    }[];
    reasons: {
        taskEntryId: string;
        status: "unknown" | "not_applicable";
        reason: string;
    }[];
    evidenceFileIds: string[];
}
/** 中文：仅汇总适用任务，异常优先，完整性另算，并收集最高风险、原因与去重证据。
 * English: Fold applicable tasks prioritize abnormal results, track completeness separately, and collect the highest risk, reasons, and unique evidence.
 */
function foldTasks(key: string, entries: FrozenTaskEntry[], facts: Map<string, TaskObservation>): TaskAggregate {
    const applicable = entries.filter((entry) => entry.applicable);
    const selected = applicable.map((entry) => ({ entry, fact: facts.get(entry.entryId) }));
    const incomplete = selected.some(({ fact }) => fact?.status == null);
    const has = (status: TaskStatus) => selected.some(({ fact }) => fact?.status === status);
    const status: AggregateStatus = has("abnormal") ? "abnormal" : incomplete ? "incomplete"
        : has("unknown") ? "unknown" : has("normal") ? "normal" : "not_applicable";
    const findings = selected.flatMap(({ entry, fact }) => fact?.status === "abnormal"
        ? fact.findingCodes.map((findingCode) => ({ taskEntryId: entry.entryId, checklistItemId: entry.definition.id, findingCode,
            risk: entry.definition.findings.find((finding) => finding.findingCode === findingCode)!.risk })) : []);
    const risk = findings.reduce<RiskLevel>((current, finding) => rank[finding.risk] > rank[current] ? finding.risk : current, "none");
    return { key, taskEntryIds: entries.map((entry) => entry.entryId).sort(), checklistItemIds: [...new Set(entries.map((entry) => entry.definition.id))].sort(),
        status, completeness: incomplete ? "incomplete" : "complete", risk, findings,
        reasons: selected.flatMap(({ entry, fact }) => fact && (fact.status === "unknown" || fact.status === "not_applicable")
            ? [{ taskEntryId: entry.entryId, status: fact.status, reason: fact.resolutionReason ?? entry.applicabilityReason }] : []),
        evidenceFileIds: [...new Set(selected.flatMap(({ fact }) => fact?.evidenceFileIds ?? []))].sort() };
}
/** 中文：同一专业概念跨部位汇总，保留各部位事实。 English: Aggregate positions by professional concept while retaining every positional fact. */
export function aggregateTaskFacts(plan: FrozenInspectionPlan, observations: TaskObservation[]) {
    const facts = indexTaskObservations(plan, observations), groups = new Map<string, FrozenTaskEntry[]>();
    for (const entry of plan.tasks) {
        if (!entry.aggregationKey)
            fail("INVALID_FROZEN_PLAN", "aggregationKey");
        groups.set(entry.aggregationKey, [...(groups.get(entry.aggregationKey) ?? []), entry]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, entries]) => foldTasks(key, entries, facts));
}
/** 中文：只从已保存状态判定真实前置条件，不生成确认。 English: Check prerequisites from saved facts without fabricating confirmations. */
export function taskDependencyBlockers(plan: FrozenInspectionPlan, taskEntryId: string, observations: TaskObservation[]): string[] {
    const entry = findFrozenTask(plan, taskEntryId), facts = indexTaskObservations(plan, observations);
    return entry.dependencies.flatMap(dependency => plan.tasks.filter(t => t.taskKey === dependency.taskKey && t.applicable).filter(t => {
        const status = facts.get(t.entryId)?.status;
        return status == null || (dependency.requiredStatuses.length > 0 && !dependency.requiredStatuses.includes(status));
    }).map(t => t.entryId));
}
export interface BatchNormalUndo {
    before: TaskObservation[];
    afterVersions: Record<string, number>;
}
/** 中文：批量正常仍逐项遵守安全、测量及前置条件；返回可撤销记录。 English: Batch normal obeys each task's safety, measurement and prerequisite rules and returns undo data. */
export function markSelectedTasksNormal(plan: FrozenInspectionPlan, observations: TaskObservation[], entryIds: string[], context: {
    now: string;
}) {
    if (!entryIds.length || new Set(entryIds).size !== entryIds.length)
        fail("INVALID_TASK_BATCH", "selection");
    const facts = indexTaskObservations(plan, observations), selected = entryIds.map(id => ({ entry: findFrozenTask(plan, id), fact: facts.get(id) }));
    if (new Set(selected.map(({ entry }) => entry.definition.id)).size !== 1)
        fail("INVALID_TASK_BATCH", "sameConcept");
    const before: TaskObservation[] = [], replacements = new Map<string, TaskObservation>();
    for (const { entry, fact } of selected) {
        if (!fact || !entry.applicable || taskDependencyBlockers(plan, entry.entryId, observations).length)
            fail("INVALID_TASK_BATCH", "eligibleSelection");
        before.push(structuredClone(fact));
        const next = normalizeTaskFacts(entry, { ...fact, status: "normal", resolutionReason: null, findingCodes: [], inspectedAt: context.now });
        replacements.set(entry.entryId, { ...fact, ...next, version: fact.version + 1, updatedAt: context.now });
    }
    return { observations: observations.map(f => replacements.get(f.taskEntryId) ?? f), undo: { before, afterVersions: Object.fromEntries([...replacements.values()].map(f => [f.id, f.version])) } satisfies BatchNormalUndo, affectedCount: replacements.size };
}
/** 中文：只撤销未被后续修改覆盖的事实。 English: Undo only facts that have not been edited since the batch. */
export function undoTaskBatch(observations: TaskObservation[], undo: BatchNormalUndo, context: {
    now: string;
}) {
    const previous = new Map(undo.before.map(f => [f.id, f])), restored: string[] = [], conflicts: string[] = [];
    const next = observations.map(f => {
        const before = previous.get(f.id);
        if (!before)
            return f;
        if (f.version !== undo.afterVersions[f.id]) {
            conflicts.push(f.taskEntryId);
            return f;
        }
        restored.push(f.taskEntryId);
        return { ...structuredClone(before), version: f.version + 1, updatedAt: context.now };
    });
    return { observations: next, restored, conflicts };
}
/** 中文：执行约束是快转全复用的必要条件，不能仅比较任务名称。 English: Continuation requires matching execution constraints, not merely a matching task name. */
function executionConditions(entry: FrozenTaskEntry) { return workflowCanonicalJson({ requirements: entry.requirements, dependencies: entry.dependencies, applicability: entry.task.applicability, scope: entry.task.scope, findingCodes: entry.task.findingCodes, normalRequiredMeasurementFields: entry.task.normalRequiredMeasurementFields ?? null }); }
/** 中文：快转全生成新身份，仅继承相同上下文、部位、定义和执行条件的事实与照片引用；原检测不变。 English: Continue quick into full with new identities, copying facts and photo references only for matching context, position, definition and execution constraints; the source stays unchanged. */
export async function continueQuickTaskFacts(sourcePlan: FrozenInspectionPlan, targetPlan: FrozenInspectionPlan, sourceFacts: TaskObservation[], context: TaskFactContext): Promise<TaskObservation[]> {
    if (sourcePlan.mode !== "quick" || targetPlan.mode !== "full" || sourceFacts.some(f => f.inspectionId === context.inspectionId))
        fail("TASK_SCOPE_INVALID", "continuedFromQuick");
    const facts = indexTaskObservations(sourcePlan, sourceFacts), sameContext = workflowCanonicalJson(sourcePlan.context) === workflowCanonicalJson(targetPlan.context);
    return Promise.all(targetPlan.tasks.map(entry => {
        const matched = sourcePlan.tasks.filter(s => s.taskKey === entry.taskKey && s.positionKey === entry.positionKey && s.applicable === entry.applicable && s.definition.definitionHash === entry.definition.definitionHash && executionConditions(s) === executionConditions(entry));
        const source = sameContext && matched.length === 1 ? facts.get(matched[0].entryId) : undefined;
        return createTaskObservation(targetPlan, entry.entryId, context, source ? taskFactInput(source) : undefined);
    }));
}
/** 中文：只有明确的铭牌与文件逐位核对正常才确认VIN；任何已记录的身份矛盾都会否决，资料文字不参与。 English: Confirm VIN only from an explicit normal plate/document comparison; any recorded identity mismatch vetoes it, and material text never participates. */
export function isVinVerified(plan: FrozenInspectionPlan, observations: TaskObservation[]): boolean {
    const facts = indexTaskObservations(plan, observations);
    const identityTasks = plan.tasks.filter(entry => entry.applicable && entry.aggregationKey === "AGG-VEHICLE-IDENTITY");
    if (identityTasks.some(entry => facts.get(entry.entryId)?.status === "abnormal"))
        return false;
    return identityTasks.some(entry => ["TASK-12-0001-C04-01", "TASK-12-0101-C01-01"].includes(entry.taskKey) && facts.get(entry.entryId)?.status === "normal");
}
