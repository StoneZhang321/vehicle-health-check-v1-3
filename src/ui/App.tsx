/** 中文：应用壳只负责导航、展示偏好和业务入口绑定；存储与评分不散落在页面。 English: The shell owns navigation, preferences and action binding, keeping persistence and scoring out of pages. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { loadCatalog, type InspectionMode } from "../domain";
import { localStore } from "../data/store";
import type { TrashKind, Vehicle } from "../data/model";
import { InspectionWorkspace } from "./inspection/InspectionWorkspace";
import { MaterialsPage } from "./materials/MaterialsPage";
import { ReportView } from "../report/ReportView";
import { Dialog } from "./common/Dialog";
import { NavigationIcon } from "./common/NavigationIcon";
import { downloadBlob, useAttachmentUrls, useAvailableViewport } from "./common/interaction";
import { HomePage, VehiclesPage, ReportsPage, TrashPage } from "./pages/Collections";
import { VehicleEditor } from "./pages/VehicleEditor";
import { SettingsPage } from "./pages/SettingsPage";
import { prepareOfflineResources } from "../pwa";

function currentRoute() {
  const route = window.location.hash.slice(1);
  return /^(home|vehicles|reports|settings|trash|inspection\/[\w-]+|materials\/[\w-]+|report\/[\w-]+)$/.test(route) ? route : "home";
}
type Confirmation = { kind: TrashKind; id: string; purge: boolean };

export function App() {
  useAvailableViewport();
  const state = useSyncExternalStore(localStore.subscribe, localStore.getSnapshot);
  const locale = state.settings.locale, t = (zh: string, en: string) => locale === "en" ? en : zh;
  const [ready, setReady] = useState(false), [startupError, setStartupError] = useState("");
  const [route, setRoute] = useState(currentRoute), [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const routeRef = useRef(route), dirty = useRef(false), scroller = useRef<HTMLElement>(null), scrollPositions = useRef(new Map<string, number>());
  const inspectionPositions = useRef(new Map<string, Map<string, number>>());
  const [vehicleEditor, setVehicleEditor] = useState<Vehicle | "new" | null>(null);
  const [startMode, setStartMode] = useState<InspectionMode | null>(null), [selectedVehicle, setSelectedVehicle] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [resources, setResources] = useState<"preparing" | "ready" | "unavailable">(import.meta.env.PROD ? "preparing" : "ready");
  const inspectionId = route.startsWith("inspection/") || route.startsWith("materials/") ? route.split("/")[1] : null;
  const inspection = state.inspections.find(record => record.id === inspectionId && !record.deletedAt);
  if (inspection && !inspectionPositions.current.has(inspection.id)) inspectionPositions.current.set(inspection.id, new Map());
  const report = route.startsWith("report/") ? state.reports.find(record => record.id === route.split("/")[1] && !record.deletedAt) : undefined;
  const attachmentIds = new Set(inspection ? [...inspection.observations.flatMap(fact => fact.evidenceFileIds), ...inspection.materials.flatMap(material => material.fileIds)] : []);
  const attachmentMetadata = state.attachments.filter(file => attachmentIds.has(file.id));
  const { urls, error: attachmentError } = useAttachmentUrls(attachmentMetadata, localStore.getFile);

  useEffect(() => {
    void Promise.all([localStore.initialize(), loadCatalog()]).then(() => setReady(true)).catch(() => setStartupError("STORAGE_OR_CONTENT_UNAVAILABLE"));
    if (import.meta.env.PROD) void prepareOfflineResources().then(() => setResources("ready")).catch(() => setResources("unavailable"));
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = state.settings.theme;
    document.title = t("汽车健康检测", "Vehicle Health Check");
  }, [locale, state.settings.theme]);
  const dirtyChanged = useCallback((value: boolean) => { dirty.current = value; }, []);

  /** 中文：导航位置只属于展示；已保存的业务事实始终来自store。 English: Navigation positions are presentation state; committed facts always come from the store. */
  const applyRoute = useCallback((next: string, writeHistory = true) => {
    scrollPositions.current.set(routeRef.current, scroller.current?.scrollTop ?? 0);
    routeRef.current = next; dirty.current = false; setRoute(next); setError(""); setNotice("");
    if (writeHistory && window.location.hash !== "#" + next) window.history.pushState(null, "", "#" + next);
  }, []);
  const navigate = useCallback((next: string) => {
    if (dirty.current) { setPendingRoute(next); return; }
    applyRoute(next);
  }, [applyRoute]);
  useEffect(() => {
    const changed = () => {
      const next = currentRoute();
      if (dirty.current) { window.history.replaceState(null, "", "#" + routeRef.current); setPendingRoute(next); }
      else applyRoute(next, false);
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("popstate", changed); window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("popstate", changed); window.removeEventListener("beforeunload", unload); };
  }, [applyRoute]);
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = scrollPositions.current.get(route) ?? 0; }, [route, ready]);

  async function run(operation: () => Promise<void>, success?: string) {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); if (success) setNotice(success); }
    catch (failure) {
      const code = failure instanceof Error ? failure.message : "";
      setError(code === "LOCAL_DATA_CHANGED" ? t("另一窗口已更新记录，请重试保存。", "Another window updated the records. Please retry saving.")
        : code === "RESTORE_VEHICLE_FIRST" ? t("请先恢复所属车辆。", "Restore the vehicle first.")
        : t("操作未完成。请检查输入和浏览器存储后重试；已保存记录仍保留。", "The operation did not finish. Check the input and browser storage, then retry. Saved records remain available."));
    } finally { setBusy(false); }
  }
  function start(mode: InspectionMode, vehicleId?: string) {
    setStartMode(mode); setSelectedVehicle(vehicleId ?? state.vehicles.find(vehicle => !vehicle.deletedAt)?.id ?? "");
    if (!state.vehicles.some(vehicle => !vehicle.deletedAt)) setVehicleEditor("new");
  }
  async function createInspection() {
    if (!selectedVehicle || !startMode) return;
    const mode = startMode;
    await run(async () => { const id = await localStore.createInspection(selectedVehicle, mode); setStartMode(null); applyRoute("inspection/" + id); });
  }
  const collectionProps = { state, onNewVehicle: () => setVehicleEditor("new"), onEditVehicle: (vehicle: Vehicle) => setVehicleEditor(vehicle),
    onStart: start, onInspection: (id: string) => navigate("inspection/" + id), onReport: (id: string) => navigate("report/" + id),
    onTrash: (kind: TrashKind, id: string) => setConfirmation({ kind, id, purge: false }) };
  const back = () => navigate(route.startsWith("materials/") ? "inspection/" + inspectionId : route.startsWith("report/") ? "reports" : route === "trash" ? "settings" : "home");
  const fullScreen = route.startsWith("inspection/") && !!inspection;
  let content;
  if (!ready) content = <div className="panel empty" role={startupError ? "alert" : "status"}><h1>{startupError ? t("暂时无法打开记录", "Records could not be opened") : t("正在准备检查内容…", "Preparing inspection content…")}</h1>{startupError && <><p>{t("请允许此网站使用浏览器存储，并重新打开。不会清除已有资料。", "Allow browser storage for this site and reopen it. Existing records will not be cleared.")}</p><button onClick={() => window.location.reload()}>{t("重试", "Retry")}</button></>}</div>;
  else if (route === "home") content = <><p className="resource-status" role="status">{resources === "ready" ? t("应用资源已准备好，可断网继续检测。", "App resources are ready for inspections without a connection.") : resources === "preparing" ? t("正在准备应用资源，请暂时保持联网。", "Preparing app resources. Keep the connection for now.") : t("浏览器暂未准备好离线资源，请联网使用并检查存储设置。", "Offline resources are not ready. Stay connected and check browser storage settings.")}</p><HomePage {...collectionProps} /></>;
  else if (route === "vehicles") content = <VehiclesPage {...collectionProps} />;
  else if (route === "reports") content = <ReportsPage reports={state.reports} locale={locale} onReport={collectionProps.onReport} onTrash={collectionProps.onTrash} />;
  else if (route === "settings") content = <SettingsPage settings={state.settings} onChange={localStore.updateSettings} onExport={async () => downloadBlob(await localStore.exportBackup(), "vhcinspect-backup-" + new Date().toISOString().slice(0, 10) + ".json")} onRestore={localStore.restoreBackup} onTrash={() => navigate("trash")} />;
  else if (route === "trash") content = <TrashPage state={state} onRestore={(kind, id) => void run(() => localStore.restoreTrash(kind, id), t("已恢复", "Restored"))} onPurge={(kind, id) => setConfirmation({ kind, id, purge: true })} />;
  else if (inspection && route.startsWith("inspection/")) content = <InspectionWorkspace key={inspection.id}
    inspectionId={inspection.id} locale={locale} plan={inspection.plan} observations={inspection.observations} scrollPositions={inspectionPositions.current.get(inspection.id)!}
    currentTaskEntryId={inspection.currentTaskEntryId} supplements={inspection.supplements}
    attachments={inspection.observations.flatMap(fact => fact.evidenceFileIds.flatMap(fileId => { const file = state.attachments.find(value => value.id === fileId); return file && urls[fileId] ? [{ ...file, taskEntryId: fact.taskEntryId, url: urls[fileId] }] : []; }))}
    onDirtyChange={dirtyChanged}
    onNavigate={entryId => localStore.saveCursor(inspection.id, entryId)}
    onSaveFacts={(entryId, facts) => localStore.saveTaskFacts(inspection.id, entryId, facts)}
    onAttach={(entryId, files) => localStore.attachFiles({ inspectionId: inspection.id, taskEntryId: entryId }, files)}
    onRemoveAttachment={(entryId, fileId) => localStore.removeAttachment({ inspectionId: inspection.id, taskEntryId: entryId }, fileId)}
    onBatchNormal={entries => localStore.batchNormal(inspection.id, entries)} onUndoBatch={undoId => localStore.undoBatch(inspection.id, undoId)}
    onSaveSupplement={input => localStore.saveSupplement(inspection.id, input)} onRemoveSupplement={id => localStore.removeSupplement(inspection.id, id)}
    onOpenMaterials={() => navigate("materials/" + inspection.id)}
    onComplete={async () => { const id = await localStore.generateReport(inspection.id, locale); applyRoute("report/" + id); }}
    onContinueFull={inspection.mode === "quick" ? async () => { const id = await localStore.continueFull(inspection.id); applyRoute("inspection/" + id); } : undefined}
  />;
  else if (inspection && route.startsWith("materials/")) content = <MaterialsPage key={inspection.id} inspectionId={inspection.id} locale={locale} market={inspection.plan.context.market} materials={inspection.materials}
    attachments={attachmentMetadata.flatMap(file => urls[file.id] ? [{ ...file, url: urls[file.id] }] : [])}
    onDirtyChange={dirtyChanged} onSave={(kind, input) => localStore.saveMaterial(inspection.id, { kind, ...input })} />;
  else if (report) content = <ReportView report={report} getFile={localStore.getFile} onBack={() => navigate("reports")} />;
  else content = <section className="panel empty"><h1>{t("记录不存在或已移入回收站", "Record unavailable or in the recycle bin")}</h1><button onClick={() => navigate("home")}>{t("返回首页", "Return home")}</button></section>;

  return <div className="app-shell">
    <header className="app-header"><button className="brand" onClick={() => navigate("home")} aria-label={t("返回首页", "Home")}><img src="/icon.svg" alt="" /><span>{t("汽车健康检测", "Vehicle Health Check")}</span></button><button className="language-button" disabled={busy} onClick={() => void run(() => localStore.updateSettings({ locale: locale === "en" ? "zh-CN" : "en" }))}>{locale === "en" ? "中文" : "EN"}</button></header>
    {route.includes("/") || route === "trash" ? <div className="context-bar"><button className="back-button" onClick={back}><NavigationIcon name="back" /><span>{t("返回", "Back")}</span></button><span className="context-name">{inspection ? state.vehicles.find(vehicle => vehicle.id === inspection.vehicleId)?.name : report?.vehicle.name}</span></div> : null}
    {(error || attachmentError) && <div className="global-message error" role="alert">{error || t("部分附件未能读取，请重试或从备份恢复。", "Some attachments could not be read. Retry or restore a backup.")}<button onClick={() => setError("")} aria-label={t("关闭提示", "Dismiss notice")}>×</button></div>}
    {notice && <div className="global-message success" role="status">{notice}</div>}
    <main className={fullScreen ? "app-main workspace-main" : "app-main"} ref={scroller}>{content}</main>
    <nav className="app-nav" aria-label={t("主导航", "Main navigation")}>{[
      { id: "home" as const, zh: "首页", en: "Home" }, { id: "vehicles" as const, zh: "车辆", en: "Vehicles" },
      { id: "reports" as const, zh: "报告", en: "Reports" }, { id: "settings" as const, zh: "设置", en: "Settings" },
    ].map(item => <button key={item.id} aria-current={route === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><NavigationIcon name={item.id} /><span>{t(item.zh, item.en)}</span></button>)}</nav>
    {vehicleEditor && <VehicleEditor locale={locale} settings={state.settings} initial={vehicleEditor === "new" ? undefined : vehicleEditor} onClose={() => { setVehicleEditor(null); if (!state.vehicles.some(vehicle => !vehicle.deletedAt)) setStartMode(null); }}
      submitLabel={startMode && vehicleEditor === "new" ? t("保存并开始检测", "Save & start inspection") : undefined}
      onSave={async input => {
        const id = vehicleEditor === "new" ? await localStore.createVehicle(input) : vehicleEditor.id;
        if (vehicleEditor !== "new") await localStore.updateVehicle(id, input);
        if (startMode && vehicleEditor === "new") { const inspectionId = await localStore.createInspection(id, startMode); setStartMode(null); applyRoute("inspection/" + inspectionId); }
        setVehicleEditor(null); setSelectedVehicle(id);
      }} />}
    {startMode && !vehicleEditor && <Dialog title={startMode === "quick" ? t("开始快速检测", "Start quick inspection") : t("开始完整检测", "Start full inspection")} onClose={() => { if (!busy) setStartMode(null); }} actions={<><button disabled={busy} onClick={() => setStartMode(null)}>{t("取消", "Cancel")}</button><button className="primary" disabled={busy || !selectedVehicle} onClick={() => void createInspection()}>{busy ? t("正在创建…", "Starting…") : t("开始检测", "Start inspection")}</button></>}><div className="form-stack"><label>{t("选择车辆", "Choose vehicle")}<select value={selectedVehicle} onChange={event => setSelectedVehicle(event.target.value)}>{state.vehicles.filter(vehicle => !vehicle.deletedAt).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label><button onClick={() => setVehicleEditor("new")}>{t("新建车辆", "New vehicle")}</button><p className="muted">{t("未选择状态的项目保持未检查；资料可稍后补充。", "Items without a status remain unassessed. Supporting materials can be added later.")}</p>{error && <p className="error" role="alert">{error}</p>}</div></Dialog>}
    {pendingRoute && <Dialog title={t("还有未保存的修改", "Unsaved changes")} onClose={() => setPendingRoute(null)} actions={<><button onClick={() => setPendingRoute(null)}>{t("继续编辑", "Keep editing")}</button><button onClick={() => { const next = pendingRoute; setPendingRoute(null); applyRoute(next); }}>{t("放弃修改并离开", "Discard & leave")}</button></>}><p>{t("有效记录会自动保存。请先处理当前未完成输入或保存失败，资料页面则需点击保存。", "Valid inspection edits save automatically. Finish incomplete input or retry failed saves; material edits require Save.")}</p></Dialog>}
    {confirmation && <Dialog title={confirmation.purge ? t("永久删除记录", "Delete permanently") : t("移入回收站", "Move to recycle bin")} onClose={() => { if (!busy) setConfirmation(null); }} actions={<><button disabled={busy} onClick={() => setConfirmation(null)}>{t("取消", "Cancel")}</button><button className={confirmation.purge ? "danger" : "primary"} disabled={busy} onClick={() => void run(async () => {
      if (confirmation.purge) await localStore.purgeTrash(confirmation.kind, confirmation.id); else await localStore.moveToTrash(confirmation.kind, confirmation.id);
      setConfirmation(null);
    }, confirmation.purge ? t("已永久删除", "Deleted permanently") : t("已移入回收站", "Moved to recycle bin"))}>{busy ? t("正在处理…", "Working…") : confirmation.purge ? t("永久删除", "Delete permanently") : t("移入回收站", "Move to recycle bin")}</button></>}>
      <p>{confirmation.kind === "vehicle" ? t("这辆车及其检测、报告和关联附件将一起处理。", "This includes the vehicle, its inspections, reports and associated attachments.") : t("只处理所选记录。", "Only the selected record will be affected.")}</p><p>{confirmation.purge ? t("此操作无法撤销，已有备份不受影响。", "This cannot be undone. Existing backup files are unaffected.") : t("之后可在设置中的回收站恢复。", "You can restore it from the recycle bin in Settings.")}</p>{error && <p className="error" role="alert">{error}</p>}
    </Dialog>}
  </div>;
}
