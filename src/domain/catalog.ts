/** 中文：投影当前已发布的专业清单，不读取旧迁移或发布工具。 English: Project released professional content without legacy migration or publishing tools. */
import type { InspectionMode, Market, Powertrain, RiskLevel, ScoreCategory, VehicleCategory } from "./types";
import { ORIGINAL_TEMPLATE_KEYS, WORKFLOW_CONTRACT_VERSION, type SteeringPosition, type TaskMeasurementField, type TaskStatus, type WorkflowApplicability, type WorkflowCatalog, type WorkflowDurationRange, type WorkflowRequirements, type WorkflowText, } from "./types";
type JsonRecord = Record<string, unknown>;
export interface WorkflowCatalogAssets {
    checklist: unknown;
    modules: unknown;
    tasks: unknown;
    templates: unknown;
}
/** 中文：携带具体目录字段抛出稳定错误，阻止无效发布资产继续投影。
 * English: Throw a stable error naming the catalog field so invalid publication assets cannot continue through projection.
 */
function invalid(field: string): never { throw new Error(`INVALID_WORKFLOW_CATALOG:${field}`); }
/** 中文：要求非空且非数组的对象作为目录记录；具体字段由后续解析器校验。
 * English: Require a non-null, non-array object as a catalog record; downstream parsers validate its fields.
 */
function record(value: unknown, field: string): JsonRecord {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return invalid(field);
    return value as JsonRecord;
}
/** 中文：确认目录集合为数组，保留成员和顺序供具体字段解析。
 * English: Require a catalog collection to be an array and retain its members and order for field-specific parsing.
 */
function array(value: unknown, field: string): unknown[] {
    if (!Array.isArray(value))
        return invalid(field);
    return value;
}
/** 中文：读取长度非零的字符串，保持发布资产原值，不进行裁剪或翻译。
 * English: Read a nonempty string while preserving the published value without trimming or translation.
 */
function text(value: unknown, field: string): string {
    if (typeof value !== "string" || value.length === 0)
        return invalid(field);
    return value;
}
/** 中文：逐项校验目录字符串数组，任一空字符串或非字符串使整个字段无效。
 * English: Validate each catalog string-array member; an empty or non-string member invalidates the field.
 */
function strings(value: unknown, field: string): string[] {
    return array(value, field).map((item) => text(item, field));
}
/** 中文：要求字段精确匹配指定字符串枚举，不为未知模式、市场或状态补默认值。
 * English: Require an exact match to the supplied string enum without defaulting unknown modes, markets, or statuses.
 */
function oneOf<T extends string>(value: unknown, choices: readonly T[], field: string): T {
    if (typeof value !== "string" || !choices.includes(value as T))
        return invalid(field);
    return value as T;
}
/** 中文：接受不低于指定下限的有限数值；整数精度等附加要求由调用方检查。
 * English: Accept finite numbers at or above the supplied minimum; callers enforce additional constraints such as integer precision.
 */
function finite(value: unknown, field: string, minimum = 0): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum)
        return invalid(field);
    return value;
}
/** 中文：把资产的 zh/en 字符串显式投影为界面的 zh-CN/en 键，保留两种原文。
 * English: Project asset zh/en strings to the UI's zh-CN/en keys while preserving both texts.
 */
function localized(value: unknown, field: string): WorkflowText {
    const source = record(value, field);
    if (typeof source.zh !== "string" || typeof source.en !== "string")
        return invalid(field);
    return { "zh-CN": source.zh, en: source.en };
}
/** 中文：解析中英文步骤数组并映射语言键，保持各语言的步骤顺序。
 * English: Parse bilingual step arrays and map locale keys while retaining each language's step order.
 */
function localizedLines(value: unknown, field: string): Record<"zh-CN" | "en", string[]> {
    const source = record(value, field);
    return { "zh-CN": strings(source.zh, field), en: strings(source.en, field) };
}
/** 中文：显式读取工具、场地、车辆状态、资格和配合要求，不从显示文案推测执行条件。
 * English: Read tool, site, vehicle-state, qualification, and cooperation requirements explicitly rather than deriving conditions from display text.
 */
function requirements(value: unknown): WorkflowRequirements {
    const source = record(value, "requirements");
    return {
        tools: strings(source.tools, "tools"), site: strings(source.site, "site"),
        vehicleState: strings(source.vehicle_state, "vehicle_state"),
        qualification: strings(source.qualification, "qualification"),
        cooperation: strings(source.cooperation, "cooperation"),
    };
}
/** 中文：校验非负且有序的时长范围，并保留估时版本、验证状态和证据引用；读取本身不证明已经实测。
 * English: Validate an ordered, nonnegative duration range and retain its estimate version, validation status, and evidence references; parsing does not establish field validation.
 */
function duration(value: unknown): WorkflowDurationRange {
    const source = record(value, "duration");
    const minSeconds = finite(source.min_seconds, "min_seconds");
    const maxSeconds = finite(source.max_seconds, "max_seconds", minSeconds);
    return {
        minSeconds, maxSeconds, estimateVersion: text(source.estimate_version, "estimate_version"),
        validationStatus: oneOf(source.validation_status, ["unvalidated", "validated"], "validation_status"),
        validationEvidenceRefs: strings(source.validation_evidence_refs, "validation_evidence_refs"),
    };
}
/** 中文：投影市场、车型、动力、左右舵和两种模式的适用枚举，并合并显式配置条件键供后续判断。
 * English: Project market, vehicle, powertrain, steering, and two-mode applicability enums, combining explicit configuration-condition keys for later evaluation.
 */
function applicability(source: JsonRecord): WorkflowApplicability {
    const vehicle = record(source.vehicle_applicability, "vehicle_applicability");
    const config = source.configuration_applicability ? record(source.configuration_applicability, "configuration_applicability") : null;
    return {
        markets: array(source.market_applicability, "markets").map((value) => oneOf<Market>(value, ["US", "CA", "CN"], "market")),
        vehicleTypes: array(vehicle.vehicle_types, "vehicle_types").map((value) => oneOf<VehicleCategory>(value, ["passenger_car", "suv", "mpv", "light_pickup"], "vehicle_type")),
        powertrains: array(vehicle.powertrains, "powertrains").map((value) => oneOf<Powertrain>(value, ["gasoline", "diesel", "hev", "phev", "erev", "bev"], "powertrain")),
        steeringPositions: array(vehicle.steering_positions, "steering_positions").map((value) => oneOf<SteeringPosition>(value, ["LHD", "RHD"], "steering_position")),
        modes: array(source.mode_applicability, "modes").map((value) => oneOf<InspectionMode>(value, ["quick", "full"], "mode")),
        configurationKeys: config ? [...new Set([
                text(config.definition_condition, "definition_condition"), text(config.position_condition, "position_condition"),
                ...(config.additional_conditions === undefined ? [] : strings(config.additional_conditions, "additional_conditions")),
            ])] : [],
    };
}
/** 中文：校验十进制字符串测量合同、最多六位小数及负值许可，保留单位和必需上下文规则。
 * English: Validate the decimal-string measurement contract, up to six decimal places, and negative-value permission while retaining unit and required-context rules.
 */
function measurement(value: unknown): TaskMeasurementField {
    const source = record(value, "measurement");
    const precision = finite(source.decimal_places, "decimal_places");
    if (!Number.isInteger(precision) || precision > 6 || source.value_type !== "decimal_string" || typeof source.negative_allowed !== "boolean")
        invalid("measurement_contract");
    return {
        fieldKey: text(source.field_key, "field_key"), label: localized(source.localized_label, "measurement_label"),
        canonicalUnit: text(source.canonical_unit, "canonical_unit"), precision,
        requiredContext: strings(source.required_context, "required_context"),
        allowedUnits: strings(source.allowed_units, "allowed_units"), negativeAllowed: source.negative_allowed,
        absentContextStatus: source.absent_context_status === undefined ? null : oneOf<"unknown">(source.absent_context_status, ["unknown"], "absent_context_status"),
        requiredForNormal: source.required_for_normal === true,
    };
}
/** 中文：拒绝目录或模板中的重复稳定键，避免多个发布成员占用同一身份。
 * English: Reject duplicate stable keys in catalogs or templates so multiple published members cannot share one identity.
 */
function ensureUnique(values: string[], field: string): void {
    if (new Set(values).size !== values.length)
        invalid(`duplicate_${field}`);
}
/** 中文：计算目录摘要并按给定哈希核验，检查版本、发布状态、成员引用、两份不可变原始模板及完整真超集。
 * English: Compute the catalog digest and check any supplied hash, then validate versions, publication state, references, both immutable originals, and the full-mode proper superset.
 */
export async function projectWorkflowCatalog(assets: WorkflowCatalogAssets, identity: {
    releaseId: string;
    checklistVersionId: string;
    scoringVersionId: string;
    workflowVersionId: string;
    expectedCatalogHash?: string;
}): Promise<WorkflowCatalog> {
    const catalogHash = await workflowHash(assets);
    if (identity.expectedCatalogHash && identity.expectedCatalogHash !== catalogHash)
        invalid("catalog_hash");
    const envelopes = Object.fromEntries(Object.entries(assets).map(([key, value]) => [key, record(value, key)]));
    for (const source of Object.values(envelopes)) {
        if (source.schema_version !== "content-contract-v1.2.0" || source.workflow_version !== identity.workflowVersionId || source.content_version !== identity.checklistVersionId)
            invalid("version_binding");
        if (source.publication_ready !== true || source.status !== "published")
            invalid("unpublished_assets");
    }
    const definitions = await Promise.all(array(envelopes.checklist.items, "items").map(async (value) => {
        const source = record(value, "definition");
        const method = record(source.method, "method");
        const safety = record(method.safety, "safety");
        const stableKey = text(source.stable_key, "stable_key");
        const definitionHash = await workflowHash(source);
        if (typeof safety.gate_required !== "boolean")
            invalid("safety_gate_required");
        const riskMap: Record<string, RiskLevel> = { low: "minor", medium: "moderate", high: "serious", critical: "serious" };
        return {
            id: stableKey, stableKey, title: localized(source.title, "title"),
            category: oneOf<ScoreCategory>(source.score_category, ["safety", "mechanical", "body", "documents"], "score_category"),
            steps: localizedLines(method.steps, "steps"), explanation: localized(method.detailed_explanation, "explanation"),
            normalSigns: localized(method.normal_observation, "normal_signs"), abnormalSigns: localized(method.abnormal_observation, "abnormal_signs"),
            safetyWarning: localized(safety.warning, "warning"), safetyGateRequired: safety.gate_required,
            warningVersion: definitionHash, stopConditions: localizedLines(safety.stop_conditions, "stop_conditions"),
            findings: array(source.findings, "findings").map((value) => {
                const finding = record(value, "finding");
                const sourceRisk = oneOf(finding.risk_level, ["low", "medium", "high", "critical"], "risk");
                return {
                    findingCode: text(finding.finding_code, "finding_code"), label: localized(finding.localized_label, "finding_label"),
                    risk: riskMap[sourceRisk], evidenceRequirements: strings(record(finding.evidence_requirements, "evidence").abnormal_requires, "abnormal_requires"),
                    requiredMeasurementFields: finding.required_measurement_fields === undefined ? [] : strings(finding.required_measurement_fields, "finding_measurement_fields"),
                };
            }),
            measurementFields: array(source.measurement_fields, "measurement_fields").map(measurement),
            reinspectionAdvice: localized(source.reinspection_advice, "reinspection_advice"), sourceRefs: strings(source.source_refs, "source_refs"),
            sourceDefinition: structuredClone(source), definitionHash,
        };
    }));
    for (const definition of definitions) {
        if (definition.findings.some((finding) => finding.requiredMeasurementFields.some((key) => !definition.measurementFields.some((field) => field.fieldKey === key))))
            invalid("finding_measurement_scope");
    }
    const modules = array(envelopes.modules.modules, "modules").map((value) => {
        const source = record(value, "module");
        return {
            stableKey: text(source.module_stable_key, "module_key"), kind: text(source.kind, "module_kind"),
            label: localized(source.localized_label, "module_label"), sortOrder: finite(source.default_sort_order, "module_order"),
            applicability: applicability(source), requirements: requirements(source.requirements),
            setupDuration: source.setup_duration_range === null ? null : duration(source.setup_duration_range),
        };
    });
    const positions = array(envelopes.modules.positions, "positions").map((value) => {
        const source = record(value, "position");
        const steering = source.steering_resolution === null ? null : record(source.steering_resolution, "steering_resolution");
        return {
            positionKey: text(source.position_key, "position_key"), moduleStableKey: text(source.module_stable_key, "position_module"),
            label: localized(source.localized_label, "position_label"), side: text(source.side, "side"),
            sideReference: oneOf(source.side_reference, ["vehicle_forward_direction"], "side_reference"),
            steeringResolution: steering ? { LHD: text(steering.LHD, "LHD"), RHD: text(steering.RHD, "RHD") } : null,
        };
    });
    const tasks = array(envelopes.tasks.tasks, "tasks").map((value) => {
        const source = record(value, "task");
        if (source.initial_status !== null)
            invalid("prefilled_task_status");
        const definition = definitions.find((item) => item.stableKey === source.checklist_item_stable_key);
        const findingCodes = strings(source.finding_codes, "task_finding_codes");
        if (!findingCodes.length || findingCodes.some((code) => !definition?.findings.some((finding) => finding.findingCode === code)))
            invalid("task_finding_scope");
        ensureUnique(findingCodes, "task_finding_codes");
        const normalRequiredMeasurementFields = source.normal_required_measurement_fields === undefined ? undefined : strings(source.normal_required_measurement_fields, "task_normal_measurement_fields");
        if (normalRequiredMeasurementFields?.some((key) => !definition?.measurementFields.some((field) => field.fieldKey === key)))
            invalid("task_measurement_scope");
        return {
            taskKey: text(source.task_key, "task_key"), checklistItemStableKey: text(source.checklist_item_stable_key, "task_definition"),
            moduleStableKey: text(source.module_stable_key, "task_module"), positionKey: text(source.position_key, "task_position"),
            aggregationKey: text(source.aggregation_key, "aggregation_key"), findingCodes, label: localized(source.localized_label, "task_label"),
            ...(normalRequiredMeasurementFields ? { normalRequiredMeasurementFields } : {}),
            scope: localized(source.localized_scope, "task_scope"), sortOrder: finite(source.default_sort_order, "task_order"),
            applicability: applicability(source), requirements: requirements(source.requirements),
            dependencies: array(source.dependencies, "dependencies").map((value) => {
                const dependency = record(value, "dependency");
                return {
                    taskKey: text(dependency.task_key, "dependency_task"),
                    relation: oneOf(dependency.relation, ["must_precede"], "dependency_relation"),
                    requiredStatuses: array(dependency.required_statuses, "required_statuses").map((status) => oneOf<TaskStatus>(status, ["normal", "abnormal", "unknown", "not_applicable"], "required_status")),
                    reason: text(dependency.reason, "dependency_reason"),
                    when: oneOf(dependency.when, ["applicable_and_in_plan"], "dependency_when"),
                };
            }),
            expectedDuration: duration(source.expected_duration_range), coverageWeight: finite(source.coverage_weight, "coverage_weight", Number.EPSILON),
        };
    });
    const originalTemplates = array(envelopes.templates.templates, "templates").map((value) => {
        const source = record(value, "template");
        const mode = oneOf<InspectionMode>(source.mode, ["quick", "full"], "template_mode");
        if (source.template_stable_key !== ORIGINAL_TEMPLATE_KEYS[mode] || source.immutable !== true || source.account_editable !== false)
            invalid("original_template_identity");
        return {
            templateKey: ORIGINAL_TEMPLATE_KEYS[mode], mode, name: localized(source.localized_label, "template_name"),
            moduleKeys: strings(source.module_keys, "template_modules"), taskKeys: strings(source.task_keys, "template_tasks"),
        };
    });
    ensureUnique(definitions.map((item) => item.stableKey), "definition");
    ensureUnique(modules.map((item) => item.stableKey), "module");
    ensureUnique(positions.map((item) => item.positionKey), "position");
    ensureUnique(tasks.map((item) => item.taskKey), "task");
    ensureUnique(originalTemplates.map((item) => item.mode), "template_mode");
    if (originalTemplates.length !== 2)
        invalid("original_template_count");
    const definitionKeys = new Set(definitions.map((item) => item.stableKey));
    const moduleKeys = new Set(modules.map((item) => item.stableKey));
    const positionKeys = new Set(positions.map((item) => item.positionKey));
    const taskKeys = new Set(tasks.map((item) => item.taskKey));
    for (const task of tasks) {
        if (!definitionKeys.has(task.checklistItemStableKey) || !moduleKeys.has(task.moduleStableKey) || !positionKeys.has(task.positionKey) || task.dependencies.some((dependency) => !taskKeys.has(dependency.taskKey)))
            invalid("orphan_task");
    }
    for (const template of originalTemplates) {
        ensureUnique(template.taskKeys, "template_task");
        ensureUnique(template.moduleKeys, "template_module");
        if (template.taskKeys.some((key) => !taskKeys.has(key)) || template.moduleKeys.some((key) => !moduleKeys.has(key)))
            invalid("orphan_template_entry");
    }
    const quick = originalTemplates.find((template) => template.mode === "quick")!;
    const full = originalTemplates.find((template) => template.mode === "full")!;
    if (full.taskKeys.length <= quick.taskKeys.length || quick.taskKeys.some((key) => !full.taskKeys.includes(key)))
        invalid("full_not_superset");
    return {
        contractVersion: WORKFLOW_CONTRACT_VERSION, releaseId: identity.releaseId,
        checklistVersionId: identity.checklistVersionId, scoringVersionId: identity.scoringVersionId,
        workflowVersionId: identity.workflowVersionId, catalogHash,
        definitions, modules, positions, tasks, originalTemplates,
    };
}
import { workflowHash } from "./canonical";
import checklist from "../content/checklist.json";
import modules from "../content/modules.json";
import tasks from "../content/tasks.json";
import templates from "../content/flows.json";
import scoring from "../content/scoring.json";
import { validateScoringRules, type ScoringRules } from "./scoring";
export interface CatalogRelease {
    catalog: WorkflowCatalog;
    rules: ScoringRules;
    rulesHash: string;
}
let installation: Promise<CatalogRelease> | undefined;
/** 中文：只投影一次捆绑内容，所有检测共享同一专业版本。 English: Project the bundled release once so every inspection uses the same professional version. */
export function loadCatalog(): Promise<CatalogRelease> {
    installation ??= (async () => {
        const rules = scoring as ScoringRules;
        const catalog = await projectWorkflowCatalog({ checklist, modules, tasks, templates }, {
            releaseId: "release-v1.2.0", checklistVersionId: "checklist-v1.2.0", scoringVersionId: "score-rule-v1.2.0", workflowVersionId: "workflow-v1.2.0", expectedCatalogHash: rules.catalogHash,
        });
        const rulesHash = await workflowHash(rules);
        await validateScoringRules(catalog, rules, rulesHash);
        return { catalog, rules, rulesHash };
    })();
    return installation;
}
