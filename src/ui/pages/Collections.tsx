/** 中文：车辆、检测和报告集合只展示已提交记录，操作通过回调进入业务层。 English: Collections display committed records and delegate operations to business callbacks. */
import type { InspectionMode, Locale } from "../../domain";
import type { Inspection, LocalState, Report, TrashKind, Vehicle } from "../../data/model";
interface CollectionProps {
  state: LocalState; onNewVehicle: () => void; onEditVehicle: (vehicle: Vehicle) => void;
  onStart: (mode: InspectionMode, vehicleId?: string) => void; onInspection: (id: string) => void;
  onReport: (id: string) => void; onTrash: (kind: TrashKind, id: string) => void;
}
const date = (value: string, locale: Locale) => new Date(value).toLocaleString(locale === "en" ? "en-US" : "zh-CN", { dateStyle: "medium", timeStyle: "short" });
function Progress({ inspection, locale }: { inspection: Inspection; locale: Locale }) {
  const tasks = inspection.plan.tasks.filter(task => task.applicable);
  const done = inspection.observations.filter(fact => fact.status !== null && tasks.some(task => task.entryId === fact.taskEntryId)).length;
  return <div className="progress-row"><progress value={done} max={Math.max(1, tasks.length)} /><span>{done} / {tasks.length} {locale === "en" ? "recorded" : "已记录"}</span></div>;
}
function InspectionList({ state, onInspection, onTrash }: Pick<CollectionProps, "state" | "onInspection" | "onTrash">) {
  const locale = state.settings.locale, t = (zh: string, en: string) => locale === "en" ? en : zh;
  const records = state.inspections.filter(inspection => !inspection.deletedAt && !state.vehicles.find(vehicle => vehicle.id === inspection.vehicleId)?.deletedAt).slice().reverse();
  return <section className="page-stack"><h2>{t("检测记录", "Inspections")}</h2>{records.length === 0 ? <p className="muted">{t("新建车辆后即可开始检测。", "Add a vehicle to start your first inspection.")}</p> : <div className="card-grid">{records.map(inspection => <article key={inspection.id} className="panel record-card">
    <div className="between"><span className="tag">{inspection.mode === "quick" ? t("快速检测", "Quick inspection") : t("完整检测", "Full inspection")}</span><time>{date(inspection.updatedAt, locale)}</time></div>
    <h3>{state.vehicles.find(vehicle => vehicle.id === inspection.vehicleId)?.name}</h3>
    <Progress inspection={inspection} locale={locale} />
    <div className="button-row"><button className="primary" onClick={() => onInspection(inspection.id)}>{t("继续检测", "Continue inspection")}</button><button className="quiet" onClick={() => onTrash("inspection", inspection.id)}>{t("移入回收站", "Move to recycle bin")}</button></div>
  </article>)}</div>}</section>;
}
export function HomePage(props: CollectionProps) {
  const locale = props.state.settings.locale, t = (zh: string, en: string) => locale === "en" ? en : zh;
  return <div className="page-stack">
    <section className="hero"><div><span className="eyebrow">{t("看清车况 · 记录细节", "LOOK CLOSER · KEEP THE DETAILS")}</span><h1>{t("从车辆开始，逐项完成检查", "A clear path through your vehicle inspection")}</h1><p>{t("跟随指引，记录状态、照片与测量，把本次检查整理成报告。", "Follow the guide, record findings, photos and measurements, and turn this inspection into a report.")}</p></div><img src="/icon.svg" alt="" /></section>
    <section className="mode-grid" aria-label={t("选择检测模式", "Choose an inspection mode")}>
      <article className="mode-card"><span className="mode-number">01</span><h2>{t("快速检测", "Quick inspection")}</h2><p>{t("围绕重点项目完成购前初筛，之后可继续完整检测。", "Screen the key items first. Continue into a full inspection when needed.")}</p><button className="primary" onClick={() => props.onStart("quick")}>{t("开始快速检测", "Start quick inspection")} <span aria-hidden="true">→</span></button></article>
      <article className="mode-card"><span className="mode-number">02</span><h2>{t("完整检测", "Full inspection")}</h2><p>{t("按照车辆部位逐项检查，分别保存发现与证据。", "Work through vehicle positions and retain each finding and its evidence.")}</p><button onClick={() => props.onStart("full")}>{t("开始完整检测", "Start full inspection")} <span aria-hidden="true">→</span></button></article>
    </section>
    <InspectionList {...props} />
    <p className="muted small">{t("仅供购车初筛参考，不替代专业检测、维修诊断或车辆历史核验。", "For purchase screening only; this does not replace professional inspection, repair diagnosis or vehicle history verification.")}</p>
  </div>;
}
export function VehiclesPage(props: CollectionProps) {
  const t = (zh: string, en: string) => props.state.settings.locale === "en" ? en : zh;
  const vehicles = props.state.vehicles.filter(vehicle => !vehicle.deletedAt).slice().reverse();
  return <div className="page-stack"><header className="page-heading between"><div><span className="eyebrow">{t("车辆档案", "YOUR VEHICLES")}</span><h1>{t("车辆", "Vehicles")}</h1></div><button className="primary" onClick={props.onNewVehicle}>{t("新建车辆", "New vehicle")}</button></header>
    {vehicles.length === 0 ? <section className="panel empty"><h2>{t("添加第一辆车", "Add your first vehicle")}</h2><p>{t("填写车辆名称和适用条件即可开始。", "A name and inspection context are enough to get started.")}</p><button onClick={props.onNewVehicle}>{t("新建车辆", "New vehicle")}</button></section> : <div className="card-grid">{vehicles.map(vehicle => <article className="panel record-card" key={vehicle.id}><div className="between"><span className="tag">{vehicle.context.market} · {vehicle.context.steeringPosition}</span><span className="muted">{vehicle.year}</span></div><h2>{vehicle.name}</h2><p className="muted">{[vehicle.make, vehicle.model, vehicle.mileage ? vehicle.mileage + " " + vehicle.mileageUnit : ""].filter(Boolean).join(" · ")}</p><div className="button-row"><button className="primary" onClick={() => props.onStart("quick", vehicle.id)}>{t("快速检测", "Quick inspection")}</button><button onClick={() => props.onStart("full", vehicle.id)}>{t("完整检测", "Full inspection")}</button></div><div className="button-row"><button className="quiet" onClick={() => props.onEditVehicle(vehicle)}>{t("编辑车辆", "Edit vehicle")}</button><button className="quiet" onClick={() => props.onTrash("vehicle", vehicle.id)}>{t("移入回收站", "Move to recycle bin")}</button></div></article>)}</div>}
    <InspectionList {...props} />
  </div>;
}
export function ReportsPage({ reports, locale, onReport, onTrash }: { reports: Report[]; locale: Locale; onReport: (id: string) => void; onTrash: (kind: TrashKind, id: string) => void }) {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const visible = reports.filter(report => !report.deletedAt).slice().reverse();
  return <div className="page-stack"><header className="page-heading"><span className="eyebrow">{t("检查结果", "INSPECTION RESULTS")}</span><h1>{t("报告", "Reports")}</h1><p>{t("报告保留生成时的事实；后续编辑不会改写它。", "Each report retains the facts as generated. Later edits do not rewrite it.")}</p></header>{visible.length === 0 ? <section className="panel empty"><h2>{t("还没有报告", "No reports yet")}</h2><p>{t("在检测页面选择“生成报告”。未检查项目会如实保留。", "Choose Generate report in an inspection. Unassessed items remain clearly marked.")}</p></section> : <div className="card-grid">{visible.map(report => <article className="panel record-card" key={report.id}><span className="tag">{report.inspection.mode === "quick" ? t("快速检测", "Quick inspection") : t("完整检测", "Full inspection")}</span><h2>{report.vehicle.name}</h2><time>{date(report.generatedAt, locale)}</time><p className="muted">{t("标准覆盖", "Standard coverage")} {Math.round(report.score.standardCoverage.percent)}% · {report.locale === "en" ? "English" : "中文"}</p><div className="button-row"><button className="primary" onClick={() => onReport(report.id)}>{t("查看报告", "View report")}</button><button className="quiet" onClick={() => onTrash("report", report.id)}>{t("移入回收站", "Move to recycle bin")}</button></div></article>)}</div>}</div>;
}
export function TrashPage({ state, onRestore, onPurge }: { state: LocalState; onRestore: (kind: TrashKind, id: string) => void; onPurge: (kind: TrashKind, id: string) => void }) {
  const t = (zh: string, en: string) => state.settings.locale === "en" ? en : zh;
  const records = [
    ...state.vehicles.filter(value => value.deletedAt).map(value => ({ kind: "vehicle" as const, id: value.id, name: value.name, label: t("车辆及关联记录", "Vehicle and related records") })),
    ...state.inspections.filter(value => value.deletedAt && !state.vehicles.find(vehicle => vehicle.id === value.vehicleId)?.deletedAt).map(value => ({ kind: "inspection" as const, id: value.id, name: state.vehicles.find(vehicle => vehicle.id === value.vehicleId)?.name, label: t("检测", "Inspection") })),
    ...state.reports.filter(value => value.deletedAt && !state.vehicles.find(vehicle => vehicle.id === value.vehicle.id)?.deletedAt).map(value => ({ kind: "report" as const, id: value.id, name: value.vehicle.name, label: t("报告", "Report") })),
  ];
  return <div className="page-stack"><header className="page-heading"><h1>{t("回收站", "Recycle bin")}</h1><p>{t("移入这里的记录可以恢复。永久删除后只能通过已有备份恢复。", "Records here can be restored. After permanent deletion, an existing backup is required.")}</p></header>{records.length === 0 ? <p className="panel">{t("回收站为空", "Recycle bin is empty")}</p> : records.map(record => <article className="panel between" key={record.id}><div><span className="tag">{record.label}</span><h2>{record.name}</h2></div><div className="button-row"><button onClick={() => onRestore(record.kind, record.id)}>{t("恢复", "Restore")}</button><button className="danger" onClick={() => onPurge(record.kind, record.id)}>{t("永久删除", "Delete permanently")}</button></div></article>)}</div>;
}

