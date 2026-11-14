/** 中文：内置检测的共享领域类型，无账号、同步或个人模板。 English: Shared types for built-in inspections, without account, sync or personal templates. */
export type Locale = "zh-CN" | "en";
export type InspectionMode = "quick" | "full";
export type Market = "US" | "CA" | "CN";
export type VehicleCategory = "passenger_car" | "suv" | "mpv" | "light_pickup";
export type Powertrain = "gasoline" | "diesel" | "hev" | "phev" | "erev" | "bev";
export type RiskLevel = "none" | "minor" | "moderate" | "serious";
export type ScoreCategory = "safety" | "mechanical" | "body" | "documents";
export interface LocalizedUnitPreferences {
    distance: "mile" | "km";
    temperature: "F" | "C";
    pressure: "PSI" | "kPa";
    currency: "USD" | "CAD" | "CNY";
}
export interface RiskAcknowledgement {
    warningVersion: string;
    decision: "continue" | "skip_for_reinspection";
    decidedAt: string;
}
export const WORKFLOW_CONTRACT_VERSION = "workflow-v1.2.0" as const;
export const FROZEN_PLAN_CONTRACT_VERSION = "vhc-inspection-plan-v1.3" as const;
export const ORIGINAL_TEMPLATE_KEYS = { quick: "VHC-TEMPLATE-QUICK-ORIGINAL", full: "VHC-TEMPLATE-FULL-ORIGINAL" } as const;
export type OriginalTemplateKey = typeof ORIGINAL_TEMPLATE_KEYS[InspectionMode];
export type WorkflowText = Record<Locale, string>;
export type TaskStatus = "normal" | "abnormal" | "unknown" | "not_applicable";
export type SteeringPosition = "LHD" | "RHD";
export interface WorkflowDependency {
    taskKey: string;
    relation: "must_precede";
    requiredStatuses: TaskStatus[];
    reason: string;
    when: "applicable_and_in_plan";
}
export interface WorkflowRequirements {
    tools: string[];
    site: string[];
    vehicleState: string[];
    qualification: string[];
    cooperation: string[];
}
export interface WorkflowApplicability {
    markets: Market[];
    vehicleTypes: VehicleCategory[];
    powertrains: Powertrain[];
    steeringPositions: SteeringPosition[];
    modes: InspectionMode[];
    /** 中文：只排除已明确缺少的配置。 English: Exclude only explicitly absent equipment. */
    configurationKeys: string[];
}
export interface WorkflowDurationRange {
    minSeconds: number;
    maxSeconds: number;
    estimateVersion: string;
    validationStatus: "unvalidated" | "validated";
    validationEvidenceRefs: string[];
}
export interface WorkflowPosition {
    positionKey: string;
    moduleStableKey: string;
    label: WorkflowText;
    side: string;
    sideReference: "vehicle_forward_direction";
    steeringResolution: Record<SteeringPosition, string> | null;
}
export interface WorkflowModuleDefinition {
    stableKey: string;
    kind: string;
    label: WorkflowText;
    sortOrder: number;
    applicability: WorkflowApplicability;
    requirements: WorkflowRequirements;
    setupDuration: WorkflowDurationRange | null;
}
export interface TaskMeasurementField {
    fieldKey: string;
    label: WorkflowText;
    canonicalUnit: string;
    precision: number;
    requiredContext: string[];
    allowedUnits: string[];
    negativeAllowed: boolean;
    /** 中文：缺少专业测量上下文时不能记为正常。 English: Missing required measurement context cannot confirm a normal result. */
    absentContextStatus?: "unknown" | null;
    requiredForNormal?: boolean;
}
export interface WorkflowFinding {
    findingCode: string;
    label: WorkflowText;
    risk: RiskLevel;
    evidenceRequirements: string[];
    requiredMeasurementFields?: string[];
}
export interface WorkflowChecklistDefinition {
    id: string;
    stableKey: string;
    title: WorkflowText;
    category: ScoreCategory;
    steps: Record<Locale, string[]>;
    explanation: WorkflowText;
    normalSigns: WorkflowText;
    abnormalSigns: WorkflowText;
    safetyWarning: WorkflowText;
    safetyGateRequired: boolean;
    warningVersion: string;
    stopConditions: Record<Locale, string[]>;
    findings: WorkflowFinding[];
    measurementFields: TaskMeasurementField[];
    reinspectionAdvice: WorkflowText;
    sourceRefs: string[];
    /** 中文：保留来源定义中的插图、方法及出处。 English: Preserve source illustrations, methods and provenance beyond the display projection. */
    sourceDefinition: Record<string, unknown>;
    definitionHash: string;
}
export interface WorkflowTaskDefinition {
    taskKey: string;
    checklistItemStableKey: string;
    moduleStableKey: string;
    positionKey: string;
    aggregationKey: string;
    /** 中文：仅允许此部位任务适用的迹象。 English: Allow only findings scoped to this positional task. */
    findingCodes: string[];
    normalRequiredMeasurementFields?: string[];
    label: WorkflowText;
    scope: WorkflowText;
    sortOrder: number;
    applicability: WorkflowApplicability;
    requirements: WorkflowRequirements;
    dependencies: WorkflowDependency[];
    expectedDuration: WorkflowDurationRange;
    coverageWeight: number;
}
export interface OriginalInspectionTemplate {
    templateKey: OriginalTemplateKey;
    mode: InspectionMode;
    name: WorkflowText;
    moduleKeys: string[];
    taskKeys: string[];
}
export interface WorkflowCatalog {
    contractVersion: typeof WORKFLOW_CONTRACT_VERSION;
    releaseId: string;
    checklistVersionId: string;
    scoringVersionId: string;
    workflowVersionId: string;
    catalogHash: string;
    definitions: WorkflowChecklistDefinition[];
    positions: WorkflowPosition[];
    modules: WorkflowModuleDefinition[];
    tasks: WorkflowTaskDefinition[];
    originalTemplates: OriginalInspectionTemplate[];
}
export interface WorkflowVehicleContext {
    market: Market;
    category: VehicleCategory;
    powertrain: Powertrain;
    steeringPosition: SteeringPosition;
    units: LocalizedUnitPreferences;
    /** 中文：未知配置保留适用。 English: Unknown equipment remains applicable. */
    configuration: Record<string, {
        present: boolean;
        reason: string;
    }>;
}
export interface FrozenSectionEntry {
    entryId: string;
    name: WorkflowText;
    baseModuleStableKey: string;
    sortOrder: number;
    requirements: WorkflowRequirements;
    setupDuration: WorkflowDurationRange | null;
    moduleDefinition: WorkflowModuleDefinition;
}
export interface FrozenTaskEntry {
    entryId: string;
    sectionEntryId: string;
    taskKey: string;
    positionKey: string;
    positionLabel: WorkflowText;
    aggregationKey: string;
    sortOrder: number;
    applicable: boolean;
    applicabilityReason: string;
    coverageWeight: number;
    requirements: WorkflowRequirements;
    dependencies: WorkflowDependency[];
    expectedDuration: WorkflowDurationRange | null;
    task: WorkflowTaskDefinition;
    definition: WorkflowChecklistDefinition;
}
export interface FrozenInspectionPlan {
    contractVersion: typeof FROZEN_PLAN_CONTRACT_VERSION;
    workflowContractVersion: typeof WORKFLOW_CONTRACT_VERSION;
    templateName: WorkflowText;
    baseTemplateKey: OriginalTemplateKey;
    mode: InspectionMode;
    contentReleaseId: string;
    checklistVersionId: string;
    scoringVersionId: string;
    workflowVersionId: string;
    catalogHash: string;
    context: WorkflowVehicleContext;
    sections: FrozenSectionEntry[];
    positions: WorkflowPosition[];
    /** 中文：包含按车辆条件排除的任务，便于解释范围。 English: Retain excluded entries to explain vehicle applicability. */
    tasks: FrozenTaskEntry[];
    standardCoverageDenominator: number;
    durationEstimate: WorkflowDurationRange;
    durationBreakdown: {
        taskEntryIds: string[];
        sectionEntryIds: string[];
    };
    snapshotHash: string;
}
export interface TaskMeasurementValue {
    fieldKey: string;
    /** 中文：以固定精度十进制文字保存读数。 English: Store readings as fixed-precision decimal strings. */
    value: string;
    unit: string;
    method: string;
    tool: string;
    measuredAt: string;
    context: Record<string, string>;
}
export interface TaskObservation {
    id: string;
    inspectionId: string;
    taskEntryId: string;
    taskKey: string;
    checklistItemId: string;
    status: TaskStatus | null;
    resolutionReason: string | null;
    riskAcknowledgement: RiskAcknowledgement | null;
    findingCodes: string[];
    note: string;
    measurementValues: TaskMeasurementValue[];
    evidenceFileIds: string[];
    inspectedAt: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
}
