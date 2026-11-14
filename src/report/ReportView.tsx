/** 中文：阅读已保存的报告快照；下载与照片只读取其保留附件。 English: Read a saved report snapshot; downloads and photos use only its retained attachments. */
import { useEffect, useState, type ReactNode } from "react";
import type { Report } from "../data/model";
import type { Locale } from "../domain";
import { exportReportPdf, type ReportPdfVariant } from "./pdf";
import { reportText, reportDate, reportTasks, reportMaterials, categoryLabel, materialLabel, riskLabel, THIRD_PARTY_STATEMENT, SCREENING_STATEMENT, safeSourceUrl, type GetReportFile, type ReportTask } from "./presentation";
import "./report.css";
export interface ReportViewProps {
    report: Report;
    getFile: GetReportFile;
    onBack?: () => void;
}
/** 中文：只在展开时挂载较长的部位记录，减少完整报告的首屏工作量。 English: Mount long positional sections only when expanded, keeping full-report opening responsive. */
function ReportSection({ title, summary, initiallyOpen = false, children }: {
    title: string;
    summary?: string;
    initiallyOpen?: boolean;
    children: () => ReactNode;
}) {
    const [open, setOpen] = useState(initiallyOpen);
    return <details className="report-section" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><strong>{title}</strong>{summary && <span>{summary}</span>}</summary>{open && <div className="report-section-body">{children()}</div>}
  </details>;
}
/** 中文：本机照片URL仅供当前视图使用，切换报告或卸载时释放。 English: Local photo URLs belong to this view and are released when the report changes or unmounts. */
function ReportPhoto({ fileId, getFile, caption, locale }: {
    fileId: string;
    getFile: GetReportFile;
    caption: string;
    locale: Locale;
}) {
    const [url, setUrl] = useState("");
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true, allocated = "";
        setUrl("");
        setFailed(false);
        void getFile(fileId).then(blob => { if (!active)
            return; allocated = URL.createObjectURL(blob); setUrl(allocated); }).catch(() => { if (active)
            setFailed(true); });
        return () => { active = false; if (allocated)
            URL.revokeObjectURL(allocated); };
    }, [fileId, getFile]);
    return <figure className="report-photo">{url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${reportText(locale, "查看照片", "Open photo")}: ${caption}`}><img src={url} alt={caption} loading="lazy" onError={() => setFailed(true)}/></a> : null}
    {failed ? <p role="alert">{reportText(locale, "无法读取这张照片，请检查本机记录。", "This photo could not be read. Check the local record.")}</p> : !url ? <p role="status">{reportText(locale, "正在读取照片…", "Loading photo…")}</p> : null}<figcaption>{caption}</figcaption></figure>;
}
/** 中文：逐部位显示原始状态、测量和备注，不把空状态改写为正常。 English: Show positional status, measurements and notes without converting an empty status into normal. */
function TaskRecord({ task, report, getFile }: {
    task: ReportTask;
    report: Report;
    getFile: GetReportFile;
}) {
    const locale = report.locale, t = (zh: string, en: string) => reportText(locale, zh, en);
    return <article className="report-task">
    <div className="report-task-title"><h3>{task.title}</h3><span className={`report-status report-status-${task.fact?.status ?? "unassessed"}`}>{task.status}</span></div>
    <p className="report-muted">{task.position}</p>
    {!!task.findings.length && <ul>{task.findings.map((finding, index) => <li key={index}>{finding}</li>)}</ul>}
    {task.fact?.resolutionReason && <p className="report-preserve"><strong>{t("原因：", "Reason: ")}</strong>{task.fact.resolutionReason}</p>}
    {task.fact?.note && <div><h4>{t("备注", "Notes")}</h4><p className="report-preserve">{task.fact.note}</p></div>}
    {task.measurements.map((measurement, index) => <div className="report-measurement" key={index}><strong>{measurement.label}: {measurement.value}</strong>
      {measurement.context.map((line, lineIndex) => <p key={lineIndex} className="report-preserve report-muted">{line}</p>)}
      {measurement.limited && <p className="report-caution">{t("测量上下文不完整，仅供参考。", "Measurement context is incomplete; use this reading as a reference.")}</p>}</div>)}
    {task.fact?.inspectedAt && <p className="report-muted"><small>{t("检查时间：", "Inspected: ")}{reportDate(task.fact.inspectedAt, locale)}</small></p>}
    {!!task.photoIds.length && <div className="report-photos">{task.photoIds.map((fileId, index) => <ReportPhoto key={fileId} fileId={fileId} getFile={getFile} locale={locale} caption={`${task.position} · ${t("照片", "Photo")} ${index + 1}`}/>)}</div>}
  </article>;
}
/** 中文：所有按钮操作与实际完成状态一致，导出失败保留已保存快照供重试。 English: Buttons report actual completion; failed export leaves the saved report available for retry. */
export function ReportView({ report, getFile, onBack }: ReportViewProps) {
    const locale = report.locale, t = (zh: string, en: string) => reportText(locale, zh, en), score = report.score, vehicle = report.vehicle;
    const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
    const tasks = reportTasks(report), materials = reportMaterials(report), supplements = report.inspection.supplements.filter(row => row.title.trim() || row.note.trim());
    const sections = report.inspection.plan.sections.map(section => ({ section, tasks: tasks.filter(task => task.entry.sectionEntryId === section.entryId) })).filter(group => group.tasks.length);
    async function download(variant: ReportPdfVariant) {
        if (busy)
            return;
        setBusy(true);
        setError("");
        setMessage(t("正在生成PDF…", "Creating PDF…"));
        try {
            const result = await exportReportPdf(report, getFile, variant);
            setMessage(t(`PDF已生成（${result.pageCount}页），请查看下载。`, `PDF created (${result.pageCount} pages). Check your downloads.`));
        }
        catch {
            setMessage("");
            setError(t("PDF导出未完成，请检查照片是否可读后重试。报告仍已保存。", "PDF export did not finish. Check that its photos can be opened, then retry. Your report remains saved."));
        }
        finally {
            setBusy(false);
        }
    }
    async function downloadOriginal(fileId: string, index: number) {
        if (busy)
            return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const blob = await getFile(fileId), extension = ({ "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "image/gif": "gif", "image/svg+xml": "svg" } as Record<string, string>)[blob.type] ?? "bin", url = URL.createObjectURL(blob), link = document.createElement("a");
            link.href = url;
            link.download = `material-${index + 1}.${extension}`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            setMessage(t("已开始下载原件。", "Original attachment download started."));
        }
        catch {
            setError(t("无法读取此资料原件，请检查本机记录。", "This original attachment could not be read. Check the local record."));
        }
        finally {
            setBusy(false);
        }
    }
    return <article className="report-view" lang={locale}>
    <div className="report-toolbar">{onBack && <button type="button" onClick={onBack}>{t("返回", "Back")}</button>}
      <button type="button" disabled={busy} onClick={() => void download("summary")}>{t("导出摘要 PDF", "Export summary PDF")}</button>
      <button type="button" disabled={busy} onClick={() => void download("full")}>{t("导出完整 PDF", "Export full PDF")}</button></div>
    {message && <p className="report-feedback" role="status">{message}</p>}{error && <p className="report-error" role="alert">{error}</p>}
    <header className="report-heading"><p className="report-muted">{t("已保存的检测报告", "Saved inspection report")}</p><h1>{vehicle.name || t("车辆检测报告", "Vehicle inspection report")}</h1>
      <p>{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}</p><p className="report-statement">{THIRD_PARTY_STATEMENT[locale]}</p>
      <dl className="report-details"><div><dt>{t("检测模式", "Inspection mode")}</dt><dd>{report.inspection.mode === "quick" ? t("快速检测", "Quick inspection") : t("完整检测", "Full inspection")}</dd></div>
        {vehicle.vin && <div><dt>VIN</dt><dd>{vehicle.vin}</dd></div>}{vehicle.mileage && <div><dt>{t("里程", "Mileage")}</dt><dd>{vehicle.mileage} {vehicle.mileageUnit}</dd></div>}
        <div><dt>{t("市场 / 地区", "Market / region")}</dt><dd>{vehicle.context.market}{vehicle.region && ` / ${vehicle.region}`}</dd></div><div><dt>{t("生成时间", "Generated")}</dt><dd>{reportDate(report.generatedAt, locale)}</dd></div></dl>
    </header>
    <section className="report-overview"><h2>{t("本次现场检查结果", "On-site inspection results")}</h2>
      {score.scoreProminence === "secondary" && <p className="report-caution">{t("证据覆盖有限，参考分不能代替完整检测。", "Evidence coverage is limited; the reference score cannot replace a complete inspection.")}</p>}
      <p className={score.scoreProminence === "primary" ? "report-primary-score" : "report-secondary-score"}>{t("现场参考分", "Reference score")}: {score.total} / 100</p>
      <div className="report-metrics"><p>{t("已记录", "Recorded")}<strong>{score.completion.completedCount} / {score.completion.applicableVisibleCount}</strong></p>
        <p>{t("标准覆盖", "Standard coverage")}<strong>{score.standardCoverage.percent.toFixed(1)}%</strong></p><p>{t("证据完整度", "Evidence completeness")}<strong>{score.evidenceCompleteness}%</strong></p><p>{t("可信度", "Confidence")}<strong>{score.confidence}%</strong></p></div>
      <p>{t("记录中的最高风险：", "Highest recorded risk: ")}{riskLabel(score.overallRisk, locale)}</p>
      <dl className="report-details">{score.components.map(component => <div key={component.category}><dt>{categoryLabel(component.category, locale)}</dt><dd>{component.score === null ? t("无已确认评分事实", "No confirmed scoring facts") : `${component.score} / 100`}</dd></div>)}</dl>
      {score.professionalReinspectionRequired && <p className="report-caution">{t("仍有未确认项目或需专业复检的风险，请结合下方事实安排复检。", "Unconfirmed items or risks require professional follow-up; use the recorded facts below to plan it.")}</p>}
      {score.riskReviews.map(review => <p className="report-muted" key={review.family}>{review.message[locale]}</p>)}
      <p className="report-muted">{t("按车辆条件排除的项目：", "Tasks excluded by vehicle applicability: ")}{report.inspection.plan.tasks.filter(task => !task.applicable).length}</p>
    </section>
    <section><h2>{t("逐项现场记录", "Positional inspection records")}</h2>{sections.map(({ section, tasks: members }, index) => <ReportSection key={`${report.id}/${section.entryId}`} title={section.name[locale]} summary={`${members.filter(task => task.fact?.status != null).length} / ${members.length}`} initiallyOpen={index === 0}>
      {() => members.map(task => <TaskRecord key={task.entry.entryId} task={task} report={report} getFile={getFile}/>)}
    </ReportSection>)}</section>
    {!!supplements.length && <section className="report-materials"><h2>{t("单次补充观察（不计官方分）", "Supplementary observations (not scored)")}</h2>{supplements.map(row => <article key={row.id}>{row.title.trim() && <h3 className="report-preserve">{row.title}</h3>}{row.note.trim() && <p className="report-preserve">{row.note}</p>}</article>)}</section>}
    {!!materials.length && <section className="report-materials"><h2>{t("补充资料", "Supplementary materials")}</h2><p className="report-muted">{THIRD_PARTY_STATEMENT[locale]}</p>
      {materials.map(material => <article key={material.kind}><h3>{materialLabel(material.kind, locale)}</h3>{material.text.trim() && <p className="report-preserve">{material.text}</p>}
        {material.sourceName.trim() && <p className="report-preserve"><strong>{t("来源：", "Source: ")}</strong>{material.sourceName}</p>}
        {material.sourceUrl.trim() && <p className="report-preserve"><strong>{t("来源链接：", "Source link: ")}</strong>{safeSourceUrl(material.sourceUrl) ? <a href={safeSourceUrl(material.sourceUrl)} target="_blank" rel="noopener noreferrer">{material.sourceUrl}</a> : material.sourceUrl}</p>}
        {!!material.fileIds.length && <div><p className="report-muted">{t("资料原件保存在本机，未拼入导出的现场报告。", "Original material attachments are retained on the device and are not appended to the inspection PDF.")}</p><div className="report-attachment-actions">{material.fileIds.filter(id => report.fileIds.includes(id)).map((id, index) => <button key={id} type="button" disabled={busy} onClick={() => void downloadOriginal(id, index)}>{t("下载原件", "Download original")} {index + 1}</button>)}</div></div>}
      </article>)}</section>}
    <footer className="report-footer"><p>{SCREENING_STATEMENT[locale]}</p><p>{t("报告编号：", "Report ID: ")}{report.id}</p><p>VHC {report.appVersion} · {report.inspection.plan.checklistVersionId} · {score.scoringVersionId}</p></footer>
  </article>;
}
