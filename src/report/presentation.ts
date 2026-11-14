/** 中文：报告页面与PDF共享冻结事实的文字投影，不重新评分或解析资料。 English: Report view and PDF share text projected from frozen facts, without rescoring or parsing materials. */
import type { Report, Material, MaterialKind } from "../data/model";
import type { FrozenTaskEntry, Locale, TaskObservation, TaskStatus, ScoreCategory, RiskLevel } from "../domain";
import { requirementLabel } from "../domain/requirements";
export type GetReportFile = (fileId: string) => Promise<Blob>;
export const THIRD_PARTY_STATEMENT = {
    "zh-CN": "车辆历史记录报告由第三方提供；本报告记录使用者按照检查流程完成的本次现场检查结果。",
    en: "Vehicle history reports are provided by third parties. This report records the results of the on-site inspection completed by the user following the inspection process.",
} as const;
export const SCREENING_STATEMENT = {
    "zh-CN": "仅供购车初筛参考，不替代专业检测、维修诊断或车辆历史核验。",
    en: "For vehicle purchase screening only. This report does not replace a professional inspection, repair diagnosis, or vehicle history verification.",
} as const;
/** 中文：标签按报告生成时语言显示，之后改变设置不改写报告。 English: Labels use the report's frozen language, unaffected by later settings changes. */
export const reportText = (locale: Locale, zh: string, en: string): string => locale === "en" ? en : zh;
/** 中文：保留未检查与无法确认的区别。 English: Keep unassessed distinct from unable to confirm. */
export function statusLabel(status: TaskStatus | null, locale: Locale): string {
    const labels = { normal: ["正常", "Normal"], abnormal: ["异常", "Abnormal"], unknown: ["无法确认", "Unable to confirm"], not_applicable: ["不适用", "Not applicable"], unassessed: ["未检查", "Not assessed"] };
    return labels[status ?? "unassessed"][locale === "en" ? 1 : 0];
}
/** 中文：统一专业分类标签。 English: Use consistent professional category labels. */
export function categoryLabel(category: ScoreCategory, locale: Locale): string {
    return { safety: ["安全", "Safety"], mechanical: ["机械与电气", "Mechanical & electrical"], body: ["车身与外观", "Body & exterior"], documents: ["资料与身份", "Documents & identity"] }[category][locale === "en" ? 1 : 0];
}
/** 中文：没有记录异常不等于证明车辆无风险。 English: No recorded abnormality does not prove the vehicle is risk-free. */
export function riskLabel(risk: RiskLevel, locale: Locale): string {
    return { none: ["未记录异常", "No abnormal findings recorded"], minor: ["轻微", "Minor"], moderate: ["中等", "Moderate"], serious: ["严重", "Serious"] }[risk][locale === "en" ? 1 : 0];
}
/** 中文：资料类别与现场检查区分显示。 English: Label source categories separately from on-site findings. */
export function materialLabel(kind: MaterialKind, locale: Locale): string {
    return { history: ["车辆历史", "Vehicle history"], maintenance: ["维修保养", "Repair and maintenance"], ownership: ["车辆身份与权属", "Identity and ownership"], recalls: ["召回记录", "Recall records"] }[kind][locale === "en" ? 1 : 0];
}
/** 中文：原文不裁剪；仅用于判断完全空白记录是否应该省略。 English: Preserve source text verbatim; this filter only omits wholly empty records. */
export function reportMaterials(report: Report): Material[] {
    return report.inspection.materials.filter(material => material.text.trim() || material.sourceName.trim() || material.sourceUrl.trim() || material.fileIds.length);
}
/** 中文：显示保存的时间并保留本地时区说明，不编造无法解析的日期。 English: Format the stored instant with a time-zone label, preserving invalid dates as supplied. */
export function reportDate(value: string, locale: Locale): string {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date) + ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})` : value;
}
export interface ReportTask {
    entry: FrozenTaskEntry;
    fact?: TaskObservation;
    title: string;
    position: string;
    status: string;
    findings: string[];
    measurements: {
        label: string;
        value: string;
        context: string[];
        limited: boolean;
    }[];
    photoIds: string[];
}
/** 中文：按原检查顺序投影适用任务；照片只能来自报告保留的文件集合。 English: Project applicable tasks in inspection order; photos must belong to the report's retained file set. */
export function reportTasks(report: Report): ReportTask[] {
    const facts = new Map(report.inspection.observations.map(fact => [fact.taskEntryId, fact]));
    const included = new Set(report.fileIds), locale = report.locale;
    return report.inspection.plan.tasks.filter(entry => entry.applicable).map(entry => {
        const fact = facts.get(entry.entryId);
        return { entry, fact, title: entry.task.label[locale], position: entry.positionLabel[locale], status: statusLabel(fact?.status ?? null, locale),
            findings: (fact?.findingCodes ?? []).map(code => entry.definition.findings.find(finding => finding.findingCode === code)?.label[locale] ?? code),
            measurements: (fact?.measurementValues ?? []).map(value => ({ label: entry.definition.measurementFields.find(field => field.fieldKey === value.fieldKey)?.label[locale] ?? value.fieldKey,
                value: `${value.value} ${value.unit}`, context: [value.method && `${reportText(locale, "方法", "Method")}: ${value.method}`, value.tool && `${reportText(locale, "工具", "Tool")}: ${value.tool}`, value.measuredAt && `${reportText(locale, "测量时间", "Measured")}: ${reportDate(value.measuredAt, locale)}`, ...Object.entries(value.context).filter(([, text]) => text.trim()).map(([key, text]) => `${requirementLabel(key, locale)}: ${text}`)].filter(Boolean),
                limited: report.score.unqualifiedMeasurements.some(item => item.taskEntryId === entry.entryId && item.fieldKey === value.fieldKey) })),
            photoIds: (fact?.evidenceFileIds ?? []).filter(id => included.has(id)) };
    });
}
/** 中文：只允许普通网页链接；任意其他来源文字仍可原样显示。 English: Allow ordinary web links only; other source text remains readable as plain text. */
export function safeSourceUrl(value: string): string | undefined {
    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
    }
    catch {
        return undefined;
    }
}
