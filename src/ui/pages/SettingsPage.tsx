/** 中文：展示偏好、备份恢复与安装入口；保存由父层业务操作完成。 English: Preferences, backups and installation use parent-owned business operations. */
import { useEffect, useRef, useState } from "react";
import type { Locale, Market } from "../../domain";
import { defaultUnits, type Settings } from "../../data/model";
import { Dialog } from "../common/Dialog";

interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
interface SettingsPageProps { settings: Settings; onChange: (settings: Partial<Settings>) => Promise<void>; onExport: () => Promise<void>; onRestore: (file: File) => Promise<void>; onTrash: () => void }
export function SettingsPage({ settings, onChange, onExport, onRestore, onTrash }: SettingsPageProps) {
  const t = (zh: string, en: string) => settings.locale === "en" ? en : zh;
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  const [restore, setRestore] = useState<File | null>(null), [install, setInstall] = useState<InstallPrompt | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(""); setFailed(false);
    try { await action(); setMessage(success); }
    catch { setFailed(true); setMessage(t("操作未完成，请检查文件、浏览器存储或下载设置后重试。", "The operation did not finish. Check the file, browser storage or download settings, then try again.")); }
    finally { setBusy(false); }
  }
  return <div className="page-stack">
    <header className="page-heading"><span className="eyebrow">V1.3.0</span><h1>{t("设置与资料管理", "Settings & data")}</h1></header>
    <section className="panel form-stack"><h2>{t("显示与默认条件", "Display & defaults")}</h2><div className="form-grid">
      <label>{t("语言", "Language")}<select value={settings.locale} disabled={busy} onChange={event => void run(() => onChange({ locale: event.target.value as Locale }), t("已保存", "Saved"))}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
      <label>{t("主题", "Theme")}<select value={settings.theme} disabled={busy} onChange={event => void run(() => onChange({ theme: event.target.value as Settings["theme"] }), t("已保存", "Saved"))}><option value="system">{t("跟随系统", "System")}</option><option value="light">{t("浅色", "Light")}</option><option value="dark">{t("深色", "Dark")}</option></select></label>
      <label>{t("新车辆默认市场", "Default market for new vehicles")}<select value={settings.market} disabled={busy} onChange={event => { const market = event.target.value as Market; void run(() => onChange({ market, units: defaultUnits(market) }), t("已保存", "Saved")); }}><option value="CN">{t("中国", "China")}</option><option value="US">{t("美国", "United States")}</option><option value="CA">{t("加拿大", "Canada")}</option></select></label>
      <label>{t("里程单位", "Distance unit")}<select value={settings.units.distance} disabled={busy} onChange={event => void run(() => onChange({ units: { ...settings.units, distance: event.target.value as "km" | "mile" } }), t("已保存", "Saved"))}><option value="km">km</option><option value="mile">mile</option></select></label>
      <label>{t("温度单位", "Temperature unit")}<select value={settings.units.temperature} disabled={busy} onChange={event => void run(() => onChange({ units: { ...settings.units, temperature: event.target.value as "C" | "F" } }), t("已保存", "Saved"))}><option value="C">°C</option><option value="F">°F</option></select></label>
      <label>{t("压力单位", "Pressure unit")}<select value={settings.units.pressure} disabled={busy} onChange={event => void run(() => onChange({ units: { ...settings.units, pressure: event.target.value as "kPa" | "PSI" } }), t("已保存", "Saved"))}><option value="kPa">kPa</option><option value="PSI">PSI</option></select></label>
      <label>{t("币种", "Currency")}<select value={settings.units.currency} disabled={busy} onChange={event => void run(() => onChange({ units: { ...settings.units, currency: event.target.value as "CNY" | "USD" | "CAD" } }), t("已保存", "Saved"))}><option value="CNY">CNY</option><option value="USD">USD</option><option value="CAD">CAD</option></select></label>
    </div></section>
    <section className="panel page-stack"><h2>{t("备份与恢复", "Backup & restore")}</h2><p>{t("记录和附件保存在当前浏览器。清理浏览器数据或更换设备前，请先导出备份。", "Records and attachments are stored in this browser. Export a backup before clearing browser data or changing devices.")}</p><div className="button-row"><button className="primary" disabled={busy} onClick={() => void run(onExport, t("备份已导出", "Backup exported"))}>{t("导出 V1.3 备份", "Export V1.3 backup")}</button><button disabled={busy} onClick={() => input.current?.click()}>{t("恢复 V1.3 备份", "Restore V1.3 backup")}</button><button onClick={onTrash}>{t("回收站", "Recycle bin")}</button></div><input ref={input} type="file" accept=".json,application/json" hidden onChange={event => { setRestore(event.target.files?.[0] ?? null); event.target.value = ""; }} /></section>
    <section className="panel page-stack"><h2>{t("安装与使用", "Install & use")}</h2><p>{t("首次联网打开并完成资源准备后，可断网继续检测、保存照片和导出报告。", "After opening online and preparing resources, you can inspect, save photos and export reports without a connection.")}</p>
      {install ? <button onClick={() => void install.prompt().then(() => install.userChoice).then(() => setInstall(null))}>{t("安装应用", "Install app")}</button> : <p className="muted">{t("可使用浏览器菜单中的“安装应用”或“添加到主屏幕”（以浏览器支持为准）。", "Use Install app or Add to Home Screen in your browser menu where supported.")}</p>}
      <p className="muted">{t("仅供购车初筛参考，不替代专业检测、维修诊断或车辆历史核验。", "For purchase screening only; this does not replace a professional inspection, repair diagnosis or vehicle history verification.")}</p>
    </section>
    {message && !restore && <p className={failed ? "error" : "success"} role={failed ? "alert" : "status"}>{message}</p>}
    {restore && <Dialog title={t("恢复备份", "Restore backup")} onClose={() => { if (!busy) setRestore(null); }} actions={<><button disabled={busy} onClick={() => setRestore(null)}>{t("取消", "Cancel")}</button><button className="primary" disabled={busy} onClick={() => void run(async () => { await onRestore(restore); setRestore(null); }, t("备份已恢复", "Backup restored"))}>{busy ? t("正在恢复…", "Restoring…") : t("替换并恢复", "Replace & restore")}</button></>}><p>{t("这会使用所选 V1.3 备份替换本浏览器的当前记录与附件。建议先导出当前备份。", "This replaces this browser's current records and attachments with the selected V1.3 backup. Export your current backup first.")}</p><p>{restore.name}</p>{failed && message && <p className="error" role="alert">{message}</p>}</Dialog>}
  </div>;
}
