/** 中文：在本机逐页绘制冻结报告并导出PDF；不请求网络字体或云服务。 English: Render frozen reports page by page and export PDF locally, without network fonts or cloud services. */
import type { Report } from "../data/model";
import type { Locale } from "../domain";
import { assembleRasterPdf, type RasterPdfPage } from "./raster-pdf";
import { reportText, reportDate, reportTasks, reportMaterials, categoryLabel, materialLabel, riskLabel, THIRD_PARTY_STATEMENT, SCREENING_STATEMENT, type GetReportFile, type ReportTask } from "./presentation";
export type ReportPdfVariant = "summary" | "full";
export interface ReportPdfResult {
    fileName: string;
    pageCount: number;
    byteLength: number;
}
const WIDTH = 1240, HEIGHT = 1754, LEFT = 80, TOP = 116, BOTTOM = 1630, CONTENT_WIDTH = WIDTH - 2 * LEFT;
const INK = "#102a43", MUTED = "#52697a", BLUE = "#0b65a5", LINE = "#d4e3ec";
type TextCommand = {
    kind: "text";
    text: string;
    x: number;
    y: number;
    size: number;
    weight: number;
    color: string;
};
type ImageCommand = {
    kind: "image";
    fileId: string;
    x: number;
    y: number;
    width: number;
    height: number;
};
type RuleCommand = {
    kind: "rule";
    y: number;
};
type Command = TextCommand | ImageCommand | RuleCommand;
interface TextOptions {
    size?: number;
    weight?: number;
    color?: string;
    indent?: number;
    lineHeight?: number;
}
/** 中文：系统中文字体随设备使用；离线导出无需下载字体。 English: Use installed system CJK fonts so offline export needs no font download. */
function setFont(context: CanvasRenderingContext2D, size: number, weight: number) {
    context.font = `${weight} ${size}px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC","Segoe UI",Arial,sans-serif`;
    context.textBaseline = "top";
}
/** 中文：沿用按中文字符与英文单词测宽的换行方式，保留原段落、空行和空格。 English: Wrap measured CJK characters and English words while preserving source paragraphs, blank lines and spaces. */
function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
    const output: string[] = [];
    for (const paragraph of value.replace(/\r\n?/g, "\n").split("\n")) {
        if (!paragraph) {
            output.push("");
            continue;
        }
        const tokens = paragraph.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]|\s+|[^\s\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]+/gu) ?? [];
        let line = "";
        for (const token of tokens) {
            if (context.measureText(line + token).width <= maxWidth) {
                line += token;
                continue;
            }
            if (line) {
                output.push(line);
                line = "";
            }
            if (context.measureText(token).width <= maxWidth) {
                line = token;
                continue;
            }
            for (const character of Array.from(token)) {
                if (line && context.measureText(line + character).width > maxWidth) {
                    output.push(line);
                    line = character;
                }
                else
                    line += character;
            }
        }
        output.push(line);
    }
    return output;
}
/** 中文：先排版成轻量绘制指令，随后每次只保留一张画布。 English: Lay out lightweight drawing commands first, then retain just one canvas during rendering. */
class ReportLayout {
    pages: Command[][] = [[]];
    private y = TOP;
    constructor(private context: CanvasRenderingContext2D) { }
    private get page() { return this.pages[this.pages.length - 1]; }
    private ensure(height: number) { if (this.y + height > BOTTOM) {
        this.pages.push([]);
        this.y = TOP;
    } }
    text(value: string, options: TextOptions = {}) {
        const size = options.size ?? 23, weight = options.weight ?? 400, lineHeight = options.lineHeight ?? Math.ceil(size * 1.45), indent = options.indent ?? 0;
        setFont(this.context, size, weight);
        const lines = wrapText(this.context, value, CONTENT_WIDTH - indent);
        this.ensure(Math.min(lines.length, 2) * lineHeight);
        for (const line of lines) {
            this.ensure(lineHeight);
            this.page.push({ kind: "text", text: line, x: LEFT + indent, y: this.y, size, weight, color: options.color ?? INK });
            this.y += lineHeight;
        }
    }
    gap(height = 14) { this.y += height; }
    heading(value: string) { this.ensure(90); this.gap(14); this.text(value, { size: 29, weight: 700, color: BLUE }); this.gap(12); }
    label(label: string, value: string) { if (!value.trim())
        return; this.ensure(75); this.text(label, { size: 19, weight: 600, color: MUTED }); this.text(value); this.gap(); }
    rule() { this.ensure(25); this.gap(10); this.page.push({ kind: "rule", y: this.y }); this.gap(15); }
    image(fileId: string, caption: string) { this.ensure(450); this.page.push({ kind: "image", fileId, x: LEFT, y: this.y, width: CONTENT_WIDTH, height: 390 }); this.y += 402; this.text(caption, { size: 19, color: MUTED }); this.gap(16); }
}
/** 中文：根据快照投影逐项事实，完整报告包含照片，摘要只列需关注的项目。 English: Render projected task facts; full reports include photos while summaries list findings needing attention. */
function addTask(layout: ReportLayout, task: ReportTask, locale: Locale, full: boolean) {
    const t = (zh: string, en: string) => reportText(locale, zh, en);
    layout.heading(task.title);
    layout.text(`${task.position} · ${task.status}`, { size: 22, weight: 600, color: task.fact?.status === "abnormal" ? "#a52a22" : INK });
    for (const finding of task.findings)
        layout.text(`• ${finding}`);
    if (task.fact?.resolutionReason)
        layout.label(t("原因", "Reason"), task.fact.resolutionReason);
    if (task.fact?.note)
        layout.label(t("备注", "Notes"), task.fact.note);
    for (const measurement of task.measurements) {
        layout.label(measurement.label, measurement.value);
        for (const line of measurement.context)
            layout.text(line, { size: 20, color: MUTED });
        if (measurement.limited)
            layout.text(t("测量上下文不完整，仅供参考。", "Measurement context is incomplete; use this reading as a reference."), { size: 20, color: "#8a5a00" });
    }
    if (task.fact?.inspectedAt)
        layout.text(`${t("检查时间", "Inspected")}: ${reportDate(task.fact.inspectedAt, locale)}`, { size: 18, color: MUTED });
    if (full)
        task.photoIds.forEach((fileId, index) => layout.image(fileId, `${task.position} · ${t("照片", "Photo")} ${index + 1}`));
    layout.rule();
}
/** 中文：页面与PDF均读取同一报告，不用当前车辆资料或软件设置覆盖快照。 English: Use the same saved report as the screen, never substituting current vehicle data or preferences. */
function buildLayout(report: Report, variant: ReportPdfVariant, context: CanvasRenderingContext2D): ReportLayout {
    const locale = report.locale, t = (zh: string, en: string) => reportText(locale, zh, en), layout = new ReportLayout(context), score = report.score, vehicle = report.vehicle;
    layout.text(vehicle.name || [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || t("车辆检测报告", "Vehicle inspection report"), { size: 37, weight: 700 });
    layout.gap(18);
    layout.text(variant === "full" ? t("完整报告", "Full report") : t("摘要报告", "Summary report"), { size: 27, color: BLUE, weight: 700 });
    layout.gap(18);
    layout.text(THIRD_PARTY_STATEMENT[locale], { size: 22, color: MUTED });
    layout.gap(18);
    layout.heading(t("车辆与检测", "Vehicle and inspection"));
    const vehicleLines = [`${t("检测模式", "Inspection mode")}: ${report.inspection.mode === "quick" ? t("快速检测", "Quick inspection") : t("完整检测", "Full inspection")}`,
        [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "), vehicle.vin ? `VIN: ${vehicle.vin}` : "", vehicle.mileage ? `${t("里程", "Mileage")}: ${vehicle.mileage} ${vehicle.mileageUnit}` : "",
        `${t("市场 / 地区", "Market / region")}: ${vehicle.context.market}${vehicle.region ? ` / ${vehicle.region}` : ""}`,
        `${t("生成时间", "Generated")}: ${reportDate(report.generatedAt, locale)}`, `${t("报告编号", "Report ID")}: ${report.id}`];
    for (const line of vehicleLines.filter(Boolean))
        layout.text(line, { size: 22 });
    layout.heading(t("本次现场检查结果", "On-site inspection results"));
    if (score.scoreProminence === "secondary")
        layout.text(t("证据覆盖有限，参考分不能代替完整检测。", "Evidence coverage is limited; the reference score cannot replace a complete inspection."), { size: 24, weight: 600, color: "#8a5a00" });
    layout.text(`${t("现场参考分", "Reference score")}: ${score.total} / 100`, { size: score.scoreProminence === "primary" ? 38 : 23, weight: score.scoreProminence === "primary" ? 700 : 400 });
    layout.text(`${t("已记录", "Recorded")}: ${score.completion.completedCount} / ${score.completion.applicableVisibleCount} · ${t("标准覆盖", "Standard coverage")}: ${score.standardCoverage.percent.toFixed(1)}%`);
    layout.text(`${t("证据完整度", "Evidence completeness")}: ${score.evidenceCompleteness}% · ${t("可信度", "Confidence")}: ${score.confidence}%`);
    layout.text(`${t("记录中的最高风险", "Highest recorded risk")}: ${riskLabel(score.overallRisk, locale)}`);
    for (const component of score.components)
        layout.text(`${categoryLabel(component.category, locale)}: ${component.score === null ? t("无已确认评分事实", "No confirmed scoring facts") : `${component.score} / 100`}`, { size: 21 });
    if (score.professionalReinspectionRequired)
        layout.text(t("仍有未确认项目或需专业复检的风险，请结合下方事实安排复检。", "Unconfirmed items or risks require professional follow-up; use the recorded facts below to plan it."), { size: 22, color: MUTED });
    const excluded = report.inspection.plan.tasks.filter(task => !task.applicable).length;
    if (excluded)
        layout.text(`${t("按车辆条件排除的项目", "Tasks excluded by vehicle applicability")}: ${excluded}`, { size: 20, color: MUTED });
    for (const review of score.riskReviews)
        layout.text(review.message[locale], { size: 20, color: MUTED });
    const allTasks = reportTasks(report), selected = variant === "full" ? allTasks : allTasks.filter(task => task.fact?.status === "abnormal" || task.fact?.status === "unknown");
    layout.heading(variant === "full" ? t("逐项现场记录", "Positional inspection records") : t("需关注的记录", "Records needing attention"));
    if (!selected.length)
        layout.text(t("未记录异常或无法确认事项；未检查项目仍未完成。", "No abnormal or unknown results were recorded; unassessed tasks remain incomplete."));
    for (const task of selected)
        addTask(layout, task, locale, variant === "full");
    const supplements = report.inspection.supplements.filter(row => row.title.trim() || row.note.trim());
    if (supplements.length) {
        layout.heading(t("单次补充观察（不计官方分）", "Supplementary observations (not scored)"));
        for (const row of supplements) {
            if (row.title.trim())
                layout.text(row.title, { weight: 600 });
            if (row.note.trim())
                layout.text(row.note);
            layout.gap();
        }
    }
    const materials = reportMaterials(report);
    if (materials.length) {
        layout.heading(t("补充资料", "Supplementary materials"));
        layout.text(THIRD_PARTY_STATEMENT[locale], { size: 20, color: MUTED });
        layout.gap();
        for (const material of materials) {
            layout.heading(materialLabel(material.kind, locale));
            if (material.text.trim())
                layout.text(material.text);
            if (material.sourceName.trim())
                layout.label(t("来源", "Source"), material.sourceName);
            if (material.sourceUrl.trim())
                layout.label(t("来源链接", "Source link"), material.sourceUrl);
            if (material.fileIds.length)
                layout.text(t("资料原件保存在本机，未拼入本报告。", "Original material attachments are retained on the device and are not appended to this report."), { size: 19, color: MUTED });
            layout.rule();
        }
    }
    layout.heading(t("版本与说明", "Versions and notes"));
    layout.text(`${t("应用版本", "Application version")}: ${report.appVersion}`, { size: 19, color: MUTED });
    layout.text(`${t("专业清单", "Professional checklist")}: ${report.inspection.plan.checklistVersionId}`, { size: 19, color: MUTED });
    layout.text(`${t("评分规则", "Scoring rules")}: ${score.scoringVersionId}`, { size: 19, color: MUTED });
    layout.text(SCREENING_STATEMENT[locale], { size: 21, color: MUTED });
    return layout;
}
/** 中文：只解码本机照片，失败时阻止导出而不悄悄丢失证据。 English: Decode local photos only; stop export on failure instead of silently omitting evidence. */
async function loadImage(blob: Blob): Promise<{
    image: HTMLImageElement;
    close: () => void;
}> {
    if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
        throw new Error("REPORT_PHOTO_UNSUPPORTED");
    const url = URL.createObjectURL(blob), image = new Image();
    try {
        await new Promise<void>((resolve, reject) => { const timer = window.setTimeout(() => { image.src = ""; reject(new Error("REPORT_PHOTO_TIMEOUT")); }, 15000); image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(new Error("REPORT_PHOTO_UNREADABLE")); }; image.src = url; });
        return { image, close: () => { image.src = ""; URL.revokeObjectURL(url); } };
    }
    catch (error) {
        URL.revokeObjectURL(url);
        throw error;
    }
}
/** 中文：编码当前页面后立即清空画布，只在内存中保留压缩JPEG。 English: Clear each rendered canvas after encoding, retaining compressed JPEG pages only. */
async function renderPages(layout: ReportLayout, report: Report, getFile: GetReportFile, variant: ReportPdfVariant): Promise<RasterPdfPage[]> {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context)
        throw new Error("CANVAS_UNAVAILABLE");
    const raster: RasterPdfPage[] = [];
    let bytes = 0;
    try {
        for (const [index, commands] of layout.pages.entries()) {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, WIDTH, HEIGHT);
            context.fillStyle = "#f4f9fc";
            context.fillRect(0, 0, WIDTH, 88);
            setFont(context, 21, 700);
            context.fillStyle = BLUE;
            context.fillText(reportText(report.locale, "汽车健康检测", "Vehicle Health Check"), LEFT, 32);
            setFont(context, 19, 500);
            context.fillStyle = MUTED;
            const reportLabel = variant === "full" ? reportText(report.locale, "完整报告", "Full report") : reportText(report.locale, "摘要报告", "Summary report");
            context.fillText(reportLabel, WIDTH - LEFT - context.measureText(reportLabel).width, 34);
            for (const command of commands) {
                if (command.kind === "text") {
                    setFont(context, command.size, command.weight);
                    context.fillStyle = command.color;
                    context.fillText(command.text, command.x, command.y);
                }
                else if (command.kind === "rule") {
                    context.strokeStyle = LINE;
                    context.lineWidth = 2;
                    context.beginPath();
                    context.moveTo(LEFT, command.y);
                    context.lineTo(WIDTH - LEFT, command.y);
                    context.stroke();
                }
                else {
                    const loaded = await loadImage(await getFile(command.fileId));
                    try {
                        const image = loaded.image, scale = Math.min(command.width / image.naturalWidth, command.height / image.naturalHeight), width = image.naturalWidth * scale, height = image.naturalHeight * scale;
                        context.drawImage(image, command.x + (command.width - width) / 2, command.y + (command.height - height) / 2, width, height);
                    }
                    finally {
                        loaded.close();
                    }
                }
            }
            context.strokeStyle = LINE;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(LEFT, 1670);
            context.lineTo(WIDTH - LEFT, 1670);
            context.stroke();
            setFont(context, 18, 400);
            context.fillStyle = MUTED;
            context.fillText(`VHC ${report.appVersion}`, LEFT, 1694);
            const pageLabel = reportText(report.locale, `第 ${index + 1} 页 / 共 ${layout.pages.length} 页`, `Page ${index + 1} of ${layout.pages.length}`);
            context.fillText(pageLabel, WIDTH - LEFT - context.measureText(pageLabel).width, 1694);
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("PDF_PAGE_ENCODING_FAILED")), "image/jpeg", 0.9));
            const jpegBytes = new Uint8Array(await blob.arrayBuffer());
            bytes += jpegBytes.byteLength;
            if (bytes > 256 * 1024 * 1024)
                throw new Error("PDF_TOO_LARGE");
            raster.push({ jpegBytes, width: WIDTH, height: HEIGHT });
            await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        }
    }
    finally {
        canvas.width = 0;
        canvas.height = 0;
    }
    return raster;
}
/** 中文：生成可验证的PDF Blob；此入口不触发下载，供预览和导出共用。 English: Produce a verifiable PDF Blob without downloading, shared by preview and export. */
export async function createReportPdfBlob(report: Report, getFile: GetReportFile, variant: ReportPdfVariant): Promise<{
    blob: Blob;
    pageCount: number;
}> {
    if (document.fonts?.ready)
        await document.fonts.ready;
    const scratch = document.createElement("canvas"), context = scratch.getContext("2d");
    if (!context)
        throw new Error("CANVAS_UNAVAILABLE");
    const layout = buildLayout(report, variant, context);
    scratch.width = 0;
    scratch.height = 0;
    const pages = await renderPages(layout, report, getFile, variant), bytes = assembleRasterPdf(pages);
    return { blob: new Blob([bytes], { type: "application/pdf" }), pageCount: pages.length };
}
/** 中文：显式导出下载，不启动打印窗口或外部请求。 English: Explicitly download the report without opening a print dialog or making external requests. */
export async function exportReportPdf(report: Report, getFile: GetReportFile, variant: ReportPdfVariant): Promise<ReportPdfResult> {
    const { blob, pageCount } = await createReportPdfBlob(report, getFile, variant);
    const name = (report.vehicle.name || "Vehicle").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80);
    const fileName = `${name}-${report.generatedAt.slice(0, 10)}-${variant}.pdf`, url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { fileName, pageCount, byteLength: blob.size };
}
