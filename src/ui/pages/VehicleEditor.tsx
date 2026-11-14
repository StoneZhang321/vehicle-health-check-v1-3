/** 中文：车辆表单只管理输入，保存和适用性规则由本机业务及领域层负责。 English: Vehicle forms own input; persistence and applicability belong to data/domain code. */
import { useState, type FormEvent } from "react";
import type { Locale, Market, VehicleCategory, Powertrain, SteeringPosition, WorkflowVehicleContext } from "../../domain";
import { defaultUnits, type Settings, type VehicleInput } from "../../data/model";
import { Dialog } from "../common/Dialog";
import { REGION_OPTIONS } from "./regions";

interface VehicleEditorProps { locale: Locale; settings: Settings; initial?: VehicleInput; onSave: (input: VehicleInput) => Promise<void>; onClose: () => void; submitLabel?: string }
const equipment = [
  { keys: ["front_trunk_if_equipped"], zh: "前备箱", en: "Front trunk" },
  { keys: ["glass_roof_if_equipped"], zh: "玻璃车顶", en: "Glass roof" },
  { keys: ["roof_sunshade_if_equipped"], zh: "车顶遮阳帘", en: "Roof sunshade" },
  { keys: ["third_row_left_seat_if_equipped", "third_row_middle_seat_if_equipped", "third_row_right_seat_if_equipped", "row3_left_seat_adjustment_if_equipped", "row3_middle_seat_adjustment_if_equipped", "row3_right_seat_adjustment_if_equipped"], zh: "第三排座椅", en: "Third-row seating" },
] as const;

export function VehicleEditor({ locale, settings, initial, onSave, onClose, submitLabel }: VehicleEditorProps) {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const [form, setForm] = useState<VehicleInput>(() => initial ? structuredClone(initial) : ({
    name: "", make: "", model: "", year: "", vin: "", mileage: "", mileageUnit: settings.units.distance, region: "",
    context: { market: settings.market, category: "passenger_car", powertrain: "gasoline", steeringPosition: "LHD", units: { ...settings.units }, configuration: {} },
  }));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  function patch(input: Partial<VehicleInput>) { setForm(current => ({ ...current, ...input })); }
  function context(input: Partial<WorkflowVehicleContext>) { setForm(current => ({ ...current, context: { ...current.context, ...input } })); }
  function market(value: Market) {
    const units = defaultUnits(value);
    setForm(current => ({ ...current, region: "", mileageUnit: units.distance, context: { ...current.context, market: value, units } }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSave(form); }
    catch { setError(t("车辆尚未保存，请检查输入和可用存储后重试。", "Vehicle was not saved. Check the form and available storage, then try again.")); }
    finally { setBusy(false); }
  }
  return <Dialog title={initial ? t("编辑车辆", "Edit vehicle") : t("新建车辆", "New vehicle")} onClose={() => { if (!busy) onClose(); }} actions={<><button disabled={busy} onClick={onClose}>{t("取消", "Cancel")}</button><button className="primary" type="submit" form="vehicle-form" disabled={busy}>{busy ? t("正在保存…", "Saving…") : submitLabel ?? t("保存车辆", "Save vehicle")}</button></>}>
    <form id="vehicle-form" className="form-stack" onSubmit={event => void submit(event)}>
      <label>{t("车辆名称", "Vehicle name")}<input autoComplete="off" required maxLength={120} value={form.name} placeholder={t("例如：2021 丰田 RAV4", "e.g. 2021 Toyota RAV4")} onChange={event => patch({ name: event.target.value })} /></label>
      <div className="form-grid">
        <label>{t("品牌（可选）", "Make (optional)")}<input value={form.make} onChange={event => patch({ make: event.target.value })} /></label>
        <label>{t("车型（可选）", "Model (optional)")}<input value={form.model} onChange={event => patch({ model: event.target.value })} /></label>
        <label>{t("年份（可选）", "Year (optional)")}<input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={form.year} onChange={event => patch({ year: event.target.value })} /></label>
        <label>{t("VIN（可选）", "VIN (optional)")}<input autoCapitalize="characters" maxLength={17} value={form.vin} onChange={event => patch({ vin: event.target.value.toUpperCase() })} /></label>
        <label>{t("里程（可选）", "Odometer (optional)")}<input inputMode="decimal" value={form.mileage} onChange={event => patch({ mileage: event.target.value })} /></label>
        <label>{t("里程单位", "Distance unit")}<select value={form.mileageUnit} onChange={event => { const distance = event.target.value as "km" | "mile"; patch({ mileageUnit: distance, context: { ...form.context, units: { ...form.context.units, distance } } }); }}><option value="km">km</option><option value="mile">mile</option></select></label>
      </div>
      <fieldset><legend>{t("检查适用条件", "Inspection context")}</legend><div className="form-grid">
        <label>{t("市场", "Market")}<select value={form.context.market} onChange={event => market(event.target.value as Market)}><option value="CN">{t("中国", "China")}</option><option value="US">{t("美国", "United States")}</option><option value="CA">{t("加拿大", "Canada")}</option></select></label>
        <label>{t("省 / 州（可选）", "Province / state (optional)")}<select value={form.region} onChange={event => patch({ region: event.target.value })}><option value="">{t("未选择", "Not selected")}</option>{REGION_OPTIONS[form.context.market].map(region => <option key={region.code} value={region.code}>{region.label[locale]}</option>)}</select></label>
        <label>{t("车辆类型", "Vehicle type")}<select value={form.context.category} onChange={event => context({ category: event.target.value as VehicleCategory })}><option value="passenger_car">{t("轿车", "Passenger car")}</option><option value="suv">SUV</option><option value="mpv">MPV</option><option value="light_pickup">{t("轻型皮卡", "Light pickup")}</option></select></label>
        <label>{t("动力类型", "Powertrain")}<select value={form.context.powertrain} onChange={event => context({ powertrain: event.target.value as Powertrain })}><option value="gasoline">{t("汽油", "Gasoline")}</option><option value="diesel">{t("柴油", "Diesel")}</option><option value="hev">{t("油电混合", "Hybrid (HEV)")}</option><option value="phev">{t("插电混合", "Plug-in hybrid (PHEV)")}</option><option value="erev">{t("增程", "Range extender (EREV)")}</option><option value="bev">{t("纯电", "Battery electric (BEV)")}</option></select></label>
        <label>{t("方向盘位置", "Steering position")}<select value={form.context.steeringPosition} onChange={event => context({ steeringPosition: event.target.value as SteeringPosition })}><option value="LHD">{t("左舵", "Left-hand drive")}</option><option value="RHD">{t("右舵", "Right-hand drive")}</option></select></label>
        <label>{t("温度单位", "Temperature unit")}<select value={form.context.units.temperature} onChange={event => context({ units: { ...form.context.units, temperature: event.target.value as "C" | "F" } })}><option value="C">°C</option><option value="F">°F</option></select></label>
        <label>{t("压力单位", "Pressure unit")}<select value={form.context.units.pressure} onChange={event => context({ units: { ...form.context.units, pressure: event.target.value as "PSI" | "kPa" } })}><option value="kPa">kPa</option><option value="PSI">PSI</option></select></label>
      </div></fieldset>
      <details><summary>{t("已知配置（可选）", "Known equipment (optional)")}</summary><p className="muted">{t("不确定时保留“未知”，对应项目仍会出现。", "Keep Unknown when unsure; related checks remain included.")}</p><div className="form-grid">
        {equipment.map(item => <label key={item.keys[0]}>{t(item.zh, item.en)}<select value={form.context.configuration[item.keys[0]]?.present === true ? "present" : form.context.configuration[item.keys[0]]?.present === false ? "absent" : "unknown"} onChange={event => {
          const configuration = { ...form.context.configuration };
          item.keys.forEach(key => { if (event.target.value === "unknown") delete configuration[key]; else configuration[key] = { present: event.target.value === "present", reason: "使用者明确确认配置 / Equipment explicitly confirmed by the user" }; });
          context({ configuration });
        }}><option value="unknown">{t("未知", "Unknown")}</option><option value="present">{t("配备", "Present")}</option><option value="absent">{t("未配备", "Absent")}</option></select></label>)}
      </div></details>
      {initial && <p className="muted">{t("修改条件只影响之后新建的检测，已有检测保留创建时的范围。", "Context changes apply to new inspections. Existing inspections retain their original scope.")}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </Dialog>;
}
