/** 中文：保留 score-rule-v1.2.0 专业评分算法，补充资料不进入输入。 English: Preserve the score-rule-v1.2.0 algorithm; supplementary materials never enter its input. */
import type { RiskLevel, ScoreCategory } from "./types";
import { type FrozenInspectionPlan, type TaskObservation, type WorkflowCatalog, type WorkflowChecklistDefinition, type WorkflowText } from "./types";
import { aggregateTaskFacts, indexTaskObservations, taskMeasurementLimitations, type TaskAggregate } from "./facts";
import { workflowCanonicalJson, workflowHash } from "./canonical";
export const SCORING_VERSION = "score-rule-v1.2.0" as const;
const categories: ScoreCategory[] = ["safety", "mechanical", "body", "documents"];
const risks: RiskLevel[] = ["none", "minor", "moderate", "serious"];
export interface AggregateScoringRule {
    aggregationKey: string;
    category: ScoreCategory;
    weight: number;
    role: "vehicle_condition" | "execution_gate_unscored";
    penalties: Record<RiskLevel, number>;
    safetyCaps: Record<RiskLevel, number | null>;
    reviewFamily: "structure" | "water" | "heat" | "battery" | null;
    sourceDefinitionKeys: string[];
}
export interface ScoringRules {
    contractVersion: "aggregate-scoring-rules-v1";
    scoringVersionId: typeof SCORING_VERSION;
    algorithm: "weighted-aggregate-deduction-v1";
    catalogHash: string;
    parameters: {
        lowCoverageThreshold: 80;
        noConfirmedEvidenceScore: number;
        missingEvidenceConfidencePenalty: number;
        maxMissingEvidenceConfidencePenalty: number;
        unverifiedVinConfidencePenalty: number;
        quickCompletenessCap: number;
        quickConfidenceCap: number;
        confidenceBands: {
            mediumMinimum: number;
            highMinimum: number;
        };
    };
    rules: AggregateScoringRule[];
}
export interface Coverage {
    numerator: number;
    denominator: number;
    /** 中文：未四舍五入比例用于80%门槛。 English: Unrounded percentage controls the 80% boundary. */
    percent: number;
    confirmedTaskEntryIds: string[];
    unknownTaskEntryIds: string[];
    incompleteTaskEntryIds: string[];
    manualNotApplicableTaskEntryIds: string[];
    excludedTaskEntryIds: string[];
}
export interface ScoredAggregate extends TaskAggregate {
    category: ScoreCategory;
    role: AggregateScoringRule["role"];
    weight: number;
    applicable: boolean;
    confirmed: boolean;
    penalty: number;
    safetyCap: number | null;
    evidenceMissing: boolean;
}
export interface RiskReview {
    family: NonNullable<AggregateScoringRule["reviewFamily"]>;
    aggregationKeys: string[];
    taskEntryIds: string[];
    evidenceFileIds: string[];
    documentedLocationCount: number;
    confidence: "limited" | "multiple_observations";
    conclusion: "visible_facts_require_verification";
    message: WorkflowText;
}
export interface ScoreResult {
    scoringVersionId: typeof SCORING_VERSION;
    rulesHash: string;
    inputHash: string;
    completion: {
        completedCount: number;
        applicableVisibleCount: number;
        percent: number;
    };
    standardCoverage: Coverage;
    aggregates: ScoredAggregate[];
    total: number;
    components: {
        category: ScoreCategory;
        score: number | null;
        applicableWeight: number;
        confirmedWeight: number;
        weightedDeductions: number;
    }[];
    evidenceCompleteness: number;
    confidence: number;
    confidenceBand: "low" | "medium" | "high";
    overallRisk: RiskLevel;
    safetyCapApplied: number | null;
    limitedEvidence: boolean;
    scoreProminence: "secondary" | "primary";
    coverageMessage: WorkflowText | null;
    quickScreening: boolean;
    professionalReinspectionRequired: boolean;
    missingEvidenceAggregationKeys: string[];
    executionAlertAggregationKeys: string[];
    unqualifiedMeasurements: {
        taskEntryId: string;
        fieldKey: string;
        missing: string[];
    }[];
    riskReviews: RiskReview[];
}
/** 中文：只接收冻结计划和任务事实；规则来自应用捆绑的专业版本。 English: Accept frozen plans and task facts with rules supplied by the bundled professional release. */
export interface ScoringInput {
    plan: FrozenInspectionPlan;
    taskObservations: TaskObservation[];
    rules: ScoringRules;
    expectedRulesHash: string;
    vinVerified: boolean;
}
/** 中文：统一拒绝不可信评分输入。 English: Rejects inconsistent scoring inputs. */
function fail(field: string): never { throw new Error(`INVALID_SCORING:${field}`); }
/** 中文：仅对展示分数保留一位小数。 English: Rounds display scores only. */
function rounded(value: number): number { return Math.max(0, Math.min(100, Math.round(value * 10) / 10)); }
/** 中文：比例不提前舍入，以免79.96%误过80%门槛。 English: Preserves the exact ratio at the coverage boundary. */
function percentage(numerator: number, denominator: number): number { return denominator === 0 ? 0 : numerator / denominator * 100; }
/** 中文：以代码点排序保证跨运行时稳定。 English: Uses code-point ordering for deterministic output. */
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
/** 中文：核对评分规则结构和内容摘要，不制造计划或观察。 English: Check scoring-rule shape and content hashes without fabricating plans or observations. */
async function validateRuleSet(rules: ScoringRules, expectedHash: string): Promise<Map<string, AggregateScoringRule>> {
    if (rules.contractVersion !== "aggregate-scoring-rules-v1" || rules.algorithm !== "weighted-aggregate-deduction-v1"
        || rules.scoringVersionId !== SCORING_VERSION || !/^[a-f0-9]{64}$/.test(rules.catalogHash))
        fail("rule_identity");
    if (await workflowHash(rules) !== expectedHash)
        fail("rules_hash");
    const p = rules.parameters;
    const parameterKeys = ["lowCoverageThreshold", "noConfirmedEvidenceScore", "missingEvidenceConfidencePenalty", "maxMissingEvidenceConfidencePenalty", "unverifiedVinConfidencePenalty", "quickCompletenessCap", "quickConfidenceCap"] as const;
    if (p.lowCoverageThreshold !== 80 || parameterKeys.some((key) => !Number.isInteger(p[key]) || p[key] < 0 || p[key] > 100)
        || Object.keys(p).some((key) => ![...parameterKeys, "confidenceBands"].includes(key))
        || p.quickCompletenessCap > 89 || p.quickConfidenceCap > 79
        || !Number.isInteger(p.confidenceBands.mediumMinimum) || !Number.isInteger(p.confidenceBands.highMinimum)
        || p.confidenceBands.mediumMinimum < 1 || p.confidenceBands.highMinimum > 100
        || p.confidenceBands.mediumMinimum >= p.confidenceBands.highMinimum)
        fail("parameters");
    if (!Array.isArray(rules.rules) || rules.rules.length === 0)
        fail("rules_empty");
    const byKey = new Map<string, AggregateScoringRule>();
    for (const rule of rules.rules) {
        if (byKey.has(rule.aggregationKey) || !rule.aggregationKey || !categories.includes(rule.category)
            || !["vehicle_condition", "execution_gate_unscored"].includes(rule.role)
            || !Number.isInteger(rule.weight) || rule.weight < 0 || rule.weight > 1000
            || ![null, "structure", "water", "heat", "battery"].includes(rule.reviewFamily)
            || !rule.sourceDefinitionKeys.length || new Set(rule.sourceDefinitionKeys).size !== rule.sourceDefinitionKeys.length)
            fail("rule_shape");
        for (const risk of risks) {
            if (!Number.isInteger(rule.penalties[risk]) || rule.penalties[risk] < 0 || rule.penalties[risk] > 100)
                fail("penalty");
            const cap = rule.safetyCaps[risk];
            if (cap !== null && (!Number.isInteger(cap) || cap < 0 || cap > 99 || risk !== "serious" || rule.category !== "safety"))
                fail("cap");
        }
        if (rule.penalties.none !== 0 || (rule.role === "vehicle_condition" && rule.weight === 0)
            || (rule.role === "execution_gate_unscored" && (rule.weight !== 0 || risks.some((risk) => rule.penalties[risk] !== 0 || rule.safetyCaps[risk] !== null))))
            fail("role");
        byKey.set(rule.aggregationKey, rule);
    }
    return byKey;
}
/** 中文：源内容角色与094的零计分约束不可被发布规则更改。 English: Source roles and the execution gate's zero-scoring constraints cannot be changed by rule publication. */
function validateRuleSource(rule: AggregateScoringRule, definition: WorkflowChecklistDefinition): void {
    const sourceAggregation = definition.sourceDefinition.score_aggregation as Record<string, unknown>;
    if (sourceAggregation?.scoring_role !== rule.role)
        fail("source_scoring_role");
    if (rule.role === "execution_gate_unscored" && workflowCanonicalJson(sourceAggregation.score_rule_constraints)
        !== workflowCanonicalJson({ weight: 0, abnormal_penalty: 0, safety_cap: null }))
        fail("execution_gate_constraints");
}
/** 中文：保留原专业版本明确裁定的七组跨类别概念。 English: Preserve the seven explicit cross-category decisions from the professional release. */
const crossCategoryDecisions: Record<string, ScoreCategory> = {
    "AGG-COOLANT-CONTAMINATION": "mechanical", "AGG-WATER-TRACES": "body", "AGG-WEATHER-SEAL": "body",
    "AGG-WINDOW-OPERATION": "mechanical", "AGG-SEAT-ADJUSTMENT": "mechanical", "AGG-CABIN-ODOR": "mechanical", "AGG-CABIN-MOVEMENT-NOISE": "mechanical",
};
/** 中文：冻结版本的可信度与复核边界不能借重封哈希悄然改变。 English: Re-sealing a hash cannot silently change this frozen version's confidence and review boundaries. */
const frozenParameters: ScoringRules["parameters"] = {
    lowCoverageThreshold: 80, noConfirmedEvidenceScore: 50, missingEvidenceConfidencePenalty: 5,
    maxMissingEvidenceConfidencePenalty: 15, unverifiedVinConfidencePenalty: 10, quickCompletenessCap: 89,
    quickConfidenceCap: 79, confidenceBands: { mediumMinimum: 50, highMinimum: 80 },
};
const frozenReviewFamilies: Record<string, AggregateScoringRule["reviewFamily"]> = {
    "AGG-STRUCTURAL-CONDITION": "structure", "AGG-WATER-TRACES": "water", "AGG-BURN-MELT-APPEARANCE": "heat", "AGG-12-0208": "battery",
};
/** 中文：加载内容时核对目录与规则的完整集合、角色、分类、权重和摘要。 English: Validate complete catalog/rule sets, roles, categories, weights and hashes when loading content. */
export async function validateScoringRules(sourceCatalog: WorkflowCatalog, sourceRules: ScoringRules, expectedHash: string): Promise<void> {
    const catalog = structuredClone(sourceCatalog), rules = structuredClone(sourceRules);
    const byKey = await validateRuleSet(rules, expectedHash);
    if (catalog.contractVersion !== "workflow-v1.2.0" || catalog.catalogHash !== rules.catalogHash || catalog.scoringVersionId !== rules.scoringVersionId)
        fail("catalog_identity");
    if (workflowCanonicalJson(rules.parameters) !== workflowCanonicalJson(frozenParameters))
        fail("frozen_parameters");
    const definitions = new Map(catalog.definitions.map((definition) => [definition.stableKey, definition]));
    if (definitions.size !== catalog.definitions.length)
        fail("catalog_definition_identity");
    const groups = new Map<string, {
        definitions: Set<string>;
        categories: Set<ScoreCategory>;
        weight: number;
    }>();
    const taskKeys = new Set<string>();
    for (const task of catalog.tasks) {
        if (taskKeys.has(task.taskKey))
            fail("catalog_task_identity");
        taskKeys.add(task.taskKey);
        const definition = definitions.get(task.checklistItemStableKey), rule = byKey.get(task.aggregationKey);
        if (!definition || !rule || !task.findingCodes.length || new Set(task.findingCodes).size !== task.findingCodes.length)
            fail("catalog_rule_set");
        validateRuleSource(rule, definition);
        const group = groups.get(task.aggregationKey) ?? { definitions: new Set<string>(), categories: new Set<ScoreCategory>(), weight: 0 };
        group.definitions.add(definition.stableKey);
        group.categories.add(definition.category);
        for (const code of task.findingCodes) {
            const finding = definition.findings.find((finding) => finding.findingCode === code);
            if (!finding || !risks.includes(finding.risk))
                fail("catalog_finding");
            group.weight = Math.max(group.weight, risks.indexOf(finding.risk));
        }
        groups.set(task.aggregationKey, group);
    }
    if (groups.size !== byKey.size)
        fail("catalog_rule_set");
    for (const [key, group] of groups) {
        const rule = byKey.get(key)!;
        if (workflowCanonicalJson([...group.definitions].sort(compare)) !== workflowCanonicalJson([...rule.sourceDefinitionKeys].sort(compare)))
            fail("catalog_rule_sources");
        const expectedCategory = crossCategoryDecisions[key] ?? (group.categories.size === 1 ? [...group.categories][0] : null);
        if (!expectedCategory || rule.category !== expectedCategory)
            fail("catalog_rule_category");
        if (rule.weight !== (rule.role === "execution_gate_unscored" ? 0 : group.weight))
            fail("catalog_rule_weight");
        const unscored = rule.role === "execution_gate_unscored";
        if (workflowCanonicalJson(rule.penalties) !== workflowCanonicalJson({ none: 0, minor: unscored ? 0 : 12, moderate: unscored ? 0 : 28, serious: unscored ? 0 : 60 })
            || workflowCanonicalJson(rule.safetyCaps) !== workflowCanonicalJson({ none: null, minor: null, moderate: null, serious: !unscored && rule.category === "safety" ? 45 : null })
            || rule.reviewFamily !== (frozenReviewFamilies[key] ?? null))
            fail("frozen_rule_values");
    }
}
/** 中文：校验冻结哈希、显式规则和未计分安全门禁。 English: Verifies frozen hashes, explicit rules, and the unscored execution gate. */
async function validate(input: ScoringInput): Promise<void> {
    const { plan, rules } = input;
    const { snapshotHash, ...base } = plan;
    if (snapshotHash !== await workflowHash(base))
        fail("plan_hash");
    if (plan.contractVersion !== "vhc-inspection-plan-v1.3" || plan.workflowContractVersion !== "workflow-v1.2.0"
        || !["quick", "full"].includes(plan.mode))
        fail("plan_contract");
    if (plan.scoringVersionId !== rules.scoringVersionId || plan.catalogHash !== rules.catalogHash || typeof input.vinVerified !== "boolean")
        fail("rule_identity");
    const byKey = await validateRuleSet(rules, input.expectedRulesHash);
    const entries = new Set<string>();
    let denominator = 0;
    for (const entry of plan.tasks) {
        if (entries.has(entry.entryId) || !Number.isSafeInteger(entry.coverageWeight) || entry.coverageWeight < 0)
            fail("task_identity");
        entries.add(entry.entryId);
        const rule = byKey.get(entry.aggregationKey);
        if (!rule || !rule.sourceDefinitionKeys.includes(entry.definition.stableKey))
            fail("missing_explicit_rule");
        validateRuleSource(rule, entry.definition);
        if (entry.applicable)
            denominator += entry.coverageWeight;
    }
    if (denominator !== plan.standardCoverageDenominator)
        fail("standard_denominator");
}
/** 中文：根据该异常的明确证据要求判断记录是否充足。 English: Evaluates the selected finding's explicit evidence requirements. */
function hasFindingEvidence(requirements: string[], fact: TaskObservation): boolean {
    return requirements.every((requirement) => {
        if (requirement === "note_or_photo")
            return Boolean(fact.note.trim() || fact.evidenceFileIds.length);
        if (requirement === "note")
            return Boolean(fact.note.trim());
        if (requirement === "photo")
            return fact.evidenceFileIds.length > 0;
        if (requirement === "measurement")
            return fact.measurementValues.length > 0;
        // 中文：未知要求不能被默认为满足。 English: Unknown requirements are never presumed satisfied.
        return false;
    });
}
/** 中文：同组最高风险仅扣一次，覆盖、操作完成和可信度独立计算。 English: Deducts the highest finding risk once per group and separates coverage, completion, and confidence. */
export async function calculateScore(source: ScoringInput): Promise<ScoreResult> {
    const input = structuredClone(source);
    await validate(input);
    const { plan, rules } = input, p = rules.parameters;
    const facts = indexTaskObservations(plan, input.taskObservations);
    const entries = new Map(plan.tasks.map((entry) => [entry.entryId, entry]));
    const coverage: Coverage = { numerator: 0, denominator: plan.standardCoverageDenominator, percent: 0,
        confirmedTaskEntryIds: [], unknownTaskEntryIds: [], incompleteTaskEntryIds: [], manualNotApplicableTaskEntryIds: [], excludedTaskEntryIds: [] };
    let applicableVisibleCount = 0, completedCount = 0;
    for (const entry of plan.tasks) {
        const fact = facts.get(entry.entryId);
        if (entry.applicable) {
            applicableVisibleCount++;
            if (fact?.status != null)
                completedCount++;
        }
        if (!entry.applicable) {
            coverage.excludedTaskEntryIds.push(entry.entryId);
            continue;
        }
        if (fact?.status === "normal" || fact?.status === "abnormal") {
            coverage.numerator += entry.coverageWeight;
            coverage.confirmedTaskEntryIds.push(entry.entryId);
        }
        else if (fact?.status === "unknown")
            coverage.unknownTaskEntryIds.push(entry.entryId);
        else if (fact?.status === "not_applicable")
            coverage.manualNotApplicableTaskEntryIds.push(entry.entryId);
        else
            coverage.incompleteTaskEntryIds.push(entry.entryId);
    }
    coverage.percent = percentage(coverage.numerator, coverage.denominator);
    for (const value of Object.values(coverage))
        if (Array.isArray(value))
            value.sort(compare);
    const ruleMap = new Map(rules.rules.map((rule) => [rule.aggregationKey, rule]));
    const aggregates: ScoredAggregate[] = aggregateTaskFacts(plan, input.taskObservations).map((aggregate) => {
        const rule = ruleMap.get(aggregate.key)!;
        const confirmed = aggregate.status === "normal" || aggregate.status === "abnormal";
        const abnormal = aggregate.status === "abnormal" && rule.role === "vehicle_condition";
        return { ...aggregate,
            findings: [...aggregate.findings].sort((a, b) => compare(a.taskEntryId, b.taskEntryId) || compare(a.findingCode, b.findingCode)),
            reasons: [...aggregate.reasons].sort((a, b) => compare(a.taskEntryId, b.taskEntryId)),
            category: rule.category, role: rule.role, weight: rule.weight,
            applicable: aggregate.taskEntryIds.some((id) => entries.get(id)!.applicable), confirmed,
            penalty: abnormal ? rule.penalties[aggregate.risk] : 0, safetyCap: abnormal ? rule.safetyCaps[aggregate.risk] : null,
            evidenceMissing: abnormal && aggregate.findings.some((finding) => {
                const definition = entries.get(finding.taskEntryId)!.definition!;
                return !hasFindingEvidence(definition.findings.find((f) => f.findingCode === finding.findingCode)!.evidenceRequirements, facts.get(finding.taskEntryId)!);
            }) };
    }).sort((a, b) => compare(a.key, b.key));
    const components = categories.map((category) => {
        const applicable = aggregates.filter((aggregate) => aggregate.category === category && aggregate.applicable && aggregate.role === "vehicle_condition");
        const confirmed = applicable.filter((aggregate) => aggregate.confirmed);
        const confirmedWeight = confirmed.reduce((sum, aggregate) => sum + aggregate.weight, 0);
        const weightedDeductions = confirmed.reduce((sum, aggregate) => sum + aggregate.weight * aggregate.penalty, 0);
        return { category, score: confirmedWeight ? rounded(100 - weightedDeductions / confirmedWeight) : null,
            applicableWeight: applicable.reduce((sum, aggregate) => sum + aggregate.weight, 0), confirmedWeight, weightedDeductions };
    });
    const applicableWeight = components.reduce((sum, c) => sum + c.applicableWeight, 0);
    const confirmedWeight = components.reduce((sum, c) => sum + c.confirmedWeight, 0);
    const deductions = components.reduce((sum, c) => sum + c.weightedDeductions, 0);
    const caps = aggregates.flatMap((aggregate) => aggregate.safetyCap === null ? [] : [aggregate.safetyCap]);
    const safetyCapApplied = caps.length ? Math.min(...caps) : null;
    const rawTotal = confirmedWeight ? 100 - deductions / confirmedWeight : p.noConfirmedEvidenceScore;
    const total = rounded(Math.min(rawTotal, safetyCapApplied ?? 100));
    const evidenceCompleteness = rounded(Math.min(coverage.percent, percentage(confirmedWeight, applicableWeight), plan.mode === "quick" ? p.quickCompletenessCap : 100));
    const missingEvidenceAggregationKeys = aggregates.filter((a) => a.evidenceMissing).map((a) => a.key);
    const confidence = rounded(Math.min(plan.mode === "quick" ? p.quickConfidenceCap : 100, evidenceCompleteness
        - Math.min(p.maxMissingEvidenceConfidencePenalty, missingEvidenceAggregationKeys.length * p.missingEvidenceConfidencePenalty)
        - (input.vinVerified ? 0 : p.unverifiedVinConfidencePenalty)));
    const officialAbnormal = aggregates.filter((aggregate) => aggregate.status === "abnormal" && aggregate.role === "vehicle_condition");
    const overallRisk = officialAbnormal.reduce<RiskLevel>((risk, aggregate) => risks.indexOf(aggregate.risk) > risks.indexOf(risk) ? aggregate.risk : risk, "none");
    const riskReviews: RiskReview[] = (["structure", "water", "heat", "battery"] as const).flatMap((family) => {
        const group = officialAbnormal.filter((aggregate) => ruleMap.get(aggregate.key)!.reviewFamily === family);
        if (!group.length)
            return [];
        const taskEntryIds = [...new Set(group.flatMap((g) => g.findings.map((f) => f.taskEntryId)))].sort(compare);
        const documented = taskEntryIds.filter((id) => { const fact = facts.get(id)!; return Boolean(fact.note.trim() || fact.evidenceFileIds.length || fact.measurementValues.length); });
        const documentedLocationCount = new Set(documented.map((id) => entries.get(id)!.positionKey)).size;
        return [{ family, aggregationKeys: group.map((g) => g.key), taskEntryIds,
                evidenceFileIds: [...new Set(group.flatMap((g) => g.evidenceFileIds))].sort(compare), documentedLocationCount,
                confidence: documentedLocationCount >= 2 && group.every((g) => !g.evidenceMissing) ? "multiple_observations" as const : "limited" as const,
                conclusion: "visible_facts_require_verification" as const,
                message: { "zh-CN": "仅汇总已记录的可见迹象；多处记录不等于独立成因证据。请结合车辆历史、方法和专业复核确认，不能据此单独判定事故、泡水、火灾历史或电池健康。",
                    en: "These are recorded visible observations. Multiple locations do not establish independent causal evidence. Verify the history, methods and findings professionally; they alone do not establish a collision, flood or fire history, or battery health." } }];
    });
    const unqualifiedMeasurements = plan.tasks.flatMap((entry) => taskMeasurementLimitations(entry, facts.get(entry.entryId)?.measurementValues ?? [])
        .map((limitation) => ({ taskEntryId: entry.entryId, ...limitation }))).sort((a, b) => compare(a.taskEntryId, b.taskEntryId) || compare(a.fieldKey, b.fieldKey));
    const lowCoverage = coverage.percent < p.lowCoverageThreshold;
    const normalizedFacts = [...input.taskObservations].sort((a, b) => compare(a.taskEntryId, b.taskEntryId));
    return { scoringVersionId: rules.scoringVersionId, rulesHash: input.expectedRulesHash,
        inputHash: await workflowHash({ planHash: plan.snapshotHash, rulesHash: input.expectedRulesHash, taskObservations: normalizedFacts, vinVerified: input.vinVerified }),
        completion: { completedCount, applicableVisibleCount, percent: percentage(completedCount, applicableVisibleCount) }, standardCoverage: coverage, aggregates,
        total, components, evidenceCompleteness, confidence, confidenceBand: confidence >= p.confidenceBands.highMinimum ? "high" : confidence >= p.confidenceBands.mediumMinimum ? "medium" : "low",
        overallRisk, safetyCapApplied, limitedEvidence: lowCoverage || confidence < p.confidenceBands.highMinimum,
        scoreProminence: lowCoverage || confirmedWeight === 0 ? "secondary" : "primary",
        coverageMessage: lowCoverage ? { "zh-CN": "证据覆盖有限", en: "Limited evidence coverage" } : null,
        quickScreening: plan.mode === "quick", professionalReinspectionRequired: coverage.numerator < coverage.denominator || risks.indexOf(overallRisk) >= 2 || unqualifiedMeasurements.length > 0,
        missingEvidenceAggregationKeys, executionAlertAggregationKeys: aggregates.filter((a) => a.role === "execution_gate_unscored" && a.status !== "normal" && a.status !== "not_applicable").map((a) => a.key),
        unqualifiedMeasurements, riskReviews };
}
