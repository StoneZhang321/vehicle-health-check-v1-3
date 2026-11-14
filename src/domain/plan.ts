/** 中文：从两个内置流程建立本次检测的固定计划。 English: Build an inspection's fixed plan from the two built-in flows. */
import type { FrozenInspectionPlan, FrozenTaskEntry, InspectionMode, WorkflowApplicability, WorkflowRequirements, WorkflowVehicleContext } from "./types";
import { FROZEN_PLAN_CONTRACT_VERSION, WORKFLOW_CONTRACT_VERSION } from "./types";
import { workflowCanonicalJson, workflowHash } from "./canonical";
import { loadCatalog } from "./catalog";
/** 中文：市场、动力和单位都必须是现有支持值；不猜测未知配置。 English: Require supported market, powertrain and units without guessing equipment. */
export function validateWorkflowContext(value: WorkflowVehicleContext): WorkflowVehicleContext {
    if (!value || !value.units || !value.configuration || typeof value.configuration !== "object" || Array.isArray(value.configuration)
        || !["CN", "US", "CA"].includes(value.market) || !["passenger_car", "suv", "mpv", "light_pickup"].includes(value.category)
        || !["gasoline", "diesel", "hev", "phev", "erev", "bev"].includes(value.powertrain) || !["LHD", "RHD"].includes(value.steeringPosition)
        || !["mile", "km"].includes(value.units.distance) || !["F", "C"].includes(value.units.temperature) || !["PSI", "kPa"].includes(value.units.pressure)
        || !["USD", "CAD", "CNY"].includes(value.units.currency)
        || Object.values(value.configuration).some(c => !c || typeof c.present !== "boolean" || typeof c.reason !== "string" || !c.reason.trim()))
        throw new Error("INVALID_VEHICLE_CONTEXT");
    return structuredClone(value);
}
/** 中文：只排除明确不匹配或明确缺少的配置，未知配置保留适用。 English: Exclude mismatching or explicitly absent equipment, retaining unknown configurations. */
export function evaluateWorkflowApplicability(rule: WorkflowApplicability, context: WorkflowVehicleContext, mode: InspectionMode): {
    applicable: boolean;
    reason: string;
} {
    const tests: [
        boolean,
        string
    ][] = [[rule.markets.includes(context.market), "market"], [rule.vehicleTypes.includes(context.category), "vehicle_type"],
        [rule.powertrains.includes(context.powertrain), "powertrain"], [rule.steeringPositions.includes(context.steeringPosition), "steering_position"], [rule.modes.includes(mode), "mode"]];
    const excluded = tests.filter(([matches]) => !matches).map(([, name]) => name);
    const absent = rule.configurationKeys.filter(key => context.configuration[key]?.present === false);
    const unknown = rule.configurationKeys.filter(key => context.configuration[key] === undefined);
    return excluded.length || absent.length ? { applicable: false, reason: workflowCanonicalJson({ excluded, confirmedAbsent: absent.map(key => ({ key, reason: context.configuration[key].reason })) }) }
        : { applicable: true, reason: workflowCanonicalJson({ matched: true, unknownConfiguration: unknown }) };
}
/** 中文：模块要求和任务要求取并集，不丢失任何专业前提。 English: Union module and task requirements without discarding professional prerequisites. */
function combineRequirements(a: WorkflowRequirements, b: WorkflowRequirements): WorkflowRequirements {
    return { tools: [...new Set([...a.tools, ...b.tools])], site: [...new Set([...a.site, ...b.site])], vehicleState: [...new Set([...a.vehicleState, ...b.vehicleState])], qualification: [...new Set([...a.qualification, ...b.qualification])], cooperation: [...new Set([...a.cooperation, ...b.cooperation])] };
}
/** 中文：沿用原流程顺序并冻结车辆上下文；此函数不保存数据。 English: Preserve built-in ordering and freeze vehicle context; this function never persists data. */
export async function createPlan(input: WorkflowVehicleContext, mode: InspectionMode): Promise<FrozenInspectionPlan> {
    const context = validateWorkflowContext(input), { catalog } = await loadCatalog();
    const flow = catalog.originalTemplates.find(f => f.mode === mode);
    if (!flow)
        throw new Error("INVALID_INSPECTION_MODE");
    const sections = flow.moduleKeys.map((key, index) => {
        const module = catalog.modules.find(m => m.stableKey === key)!;
        return { entryId: key, name: module.label, baseModuleStableKey: key, sortOrder: index, requirements: module.requirements, setupDuration: module.setupDuration, moduleDefinition: module };
    });
    const tasks: FrozenTaskEntry[] = flow.taskKeys.map((key, index) => {
        const task = catalog.tasks.find(t => t.taskKey === key)!, definition = catalog.definitions.find(d => d.stableKey === task.checklistItemStableKey)!;
        const section = sections.find(s => s.entryId === task.moduleStableKey)!, position = catalog.positions.find(p => p.positionKey === task.positionKey)!;
        const checks = [task.applicability, section.moduleDefinition.applicability].map(rule => evaluateWorkflowApplicability(rule, context, mode));
        return { entryId: task.taskKey, sectionEntryId: section.entryId, taskKey: key, positionKey: task.positionKey, positionLabel: position.label, aggregationKey: task.aggregationKey,
            sortOrder: index, applicable: checks.every(c => c.applicable), applicabilityReason: workflowCanonicalJson(checks), coverageWeight: task.coverageWeight,
            requirements: combineRequirements(section.requirements, task.requirements), dependencies: task.dependencies, expectedDuration: task.expectedDuration, task, definition };
    });
    tasks.sort((a, b) => flow.moduleKeys.indexOf(a.sectionEntryId) - flow.moduleKeys.indexOf(b.sectionEntryId) || a.sortOrder - b.sortOrder);
    const visible = tasks.filter(t => t.applicable), usedSections = new Set(visible.map(t => t.sectionEntryId));
    const timedTasks = visible.filter(t => t.expectedDuration), timedSections = sections.filter(s => usedSections.has(s.entryId) && s.setupDuration);
    const durations = [...timedTasks.map(t => t.expectedDuration!), ...timedSections.map(s => s.setupDuration!)];
    const plan: Omit<FrozenInspectionPlan, "snapshotHash"> = { contractVersion: FROZEN_PLAN_CONTRACT_VERSION, workflowContractVersion: WORKFLOW_CONTRACT_VERSION,
        templateName: flow.name, baseTemplateKey: flow.templateKey, mode, contentReleaseId: catalog.releaseId, checklistVersionId: catalog.checklistVersionId, scoringVersionId: catalog.scoringVersionId, workflowVersionId: catalog.workflowVersionId, catalogHash: catalog.catalogHash,
        context, sections, positions: catalog.positions.filter(p => tasks.some(t => t.positionKey === p.positionKey)), tasks,
        standardCoverageDenominator: visible.reduce((n, t) => n + t.coverageWeight, 0),
        durationEstimate: { minSeconds: durations.reduce((n, d) => n + d.minSeconds, 0), maxSeconds: durations.reduce((n, d) => n + d.maxSeconds, 0), estimateVersion: "template-duration-sum-v1", validationStatus: durations.length > 0 && durations.every(d => d.validationStatus === "validated") ? "validated" : "unvalidated", validationEvidenceRefs: [...new Set(durations.flatMap(d => d.validationEvidenceRefs))] },
        durationBreakdown: { taskEntryIds: timedTasks.map(t => t.entryId), sectionEntryIds: timedSections.map(s => s.entryId) } };
    return structuredClone({ ...plan, snapshotHash: await workflowHash(plan) });
}
