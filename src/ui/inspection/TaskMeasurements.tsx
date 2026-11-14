import type {
  FrozenTaskEntry,
  Locale,
  LocalizedUnitPreferences,
  TaskMeasurementField,
  TaskMeasurementValue,
} from "../../domain";
import { workflowText } from "./presentation";
import { requirementLabel } from "../../domain/requirements";
import styles from "./inspection.module.css";

/** 中文：新读数优先使用本次冻结单位偏好，但只选择定义允许的实际单位值。 English: New readings prefer this inspection's frozen units, using only values allowed by the field definition. */
function defaultUnit(
  field: TaskMeasurementField,
  units: LocalizedUnitPreferences,
) {
  const preferred = [
    units.distance === "mile" ? "mi" : "km",
    units.temperature === "F" ? "degF" : "degC",
    units.pressure.toLowerCase(),
  ];
  return (
    field.allowedUnits.find((unit) =>
      preferred.some((candidate) => candidate.toLowerCase() === unit.toLowerCase()),
    ) ?? field.canonicalUnit
  );
}

/** 中文：显示冻结定义的全部测量字段，单独说明何时必填；读数始终保持十进制字符串。 English: Show all measurements in the frozen definition, separately explain required conditions, and keep readings as decimal strings. */
export function TaskMeasurements({
  entry,
  values,
  locale,
  units,
  disabled,
  onChange,
}: {
  entry: FrozenTaskEntry;
  values: TaskMeasurementValue[];
  locale: Locale;
  units: LocalizedUnitPreferences;
  disabled: boolean;
  onChange: (values: TaskMeasurementValue[]) => void;
}) {
  const t = (zh: string, en: string) => (locale === "en" ? en : zh);
  const fields = entry.definition.measurementFields;
  const normalRequired = new Set(
    entry.task.normalRequiredMeasurementFields ??
      fields.filter((field) => field.requiredForNormal).map((field) => field.fieldKey),
  );
  const findingRequired = new Set(
    entry.definition.findings
      .filter((finding) =>
        entry.task.findingCodes.includes(finding.findingCode),
      )
      .flatMap((finding) => finding.requiredMeasurementFields ?? []),
  );
  if (!fields.length) return null;
  // 中文：清空读数显式移除该测量，方法、工具和时间不会自动编造。 English: Clearing a reading removes it; method, tool, and time are never invented.
  function patch(fieldKey: string, change: Partial<TaskMeasurementValue>) {
    const field = fields.find((candidate) => candidate.fieldKey === fieldKey)!;
    const current = values.find((value) => value.fieldKey === fieldKey) ?? {
      fieldKey,
      value: "",
      unit: defaultUnit(field, units),
      method: "",
      tool: "",
      measuredAt: "",
      context: {},
    };
    const next = { ...current, ...change };
    onChange([...values.filter((value) => value.fieldKey !== fieldKey), next]);
  }
  /** 中文：将已存时间转为本地日期时间输入所需的分钟格式；缺失或无效时间返回空串，不补造测量时间。
   * English: Format stored timestamps as local wall time to minute precision for the date-time input; return an empty string for missing or invalid values without inventing measurement time. */
  function localTime(value: string) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  return (
    <section className={styles.stack}>
      <h4>{t("测量记录", "Measurements")}</h4>
      {fields.map((field) => {
        const value = values.find(
          (candidate) => candidate.fieldKey === field.fieldKey,
        );
        const context = field.requiredContext.filter(
          (key) =>
            ![
              "method",
              "tool",
              "measured_at",
              "observed_at",
              "measuredAt",
              "time",
            ].includes(key),
        );
        return (
          <fieldset
            className={styles.stack}
            key={field.fieldKey}
            disabled={disabled}
          >
            <legend>{workflowText(field.label, locale)}</legend>
            <p className={styles.muted}>
              {normalRequired.has(field.fieldKey)
                ? t("确认正常时必填。", "Required to confirm a normal result.")
                : findingRequired.has(field.fieldKey)
                  ? t("记录相关异常时必填。", "Required when recording the related finding.")
                  : t("选填；有实际测量结果时可记录。", "Optional; record an actual measurement when available.")}
            </p>
            <p className={styles.muted}>
              {t(
                `最多 ${field.precision} 位小数；上下文不完整时不能据此确认正常。`,
                `Up to ${field.precision} decimal places. Incomplete context cannot support a normal result.`,
              )}
            </p>
            <div className={styles.formGrid}>
              <label>
                {t("读数", "Reading")}
                <input
                  inputMode="decimal"
                  type="text"
                  value={value?.value ?? ""}
                  onChange={(event) =>
                    patch(field.fieldKey, { value: event.target.value })
                  }
                />
              </label>
              <label>
                {t("单位", "Unit")}
                <select
                  value={value?.unit ?? defaultUnit(field, units)}
                  onChange={(event) =>
                    patch(field.fieldKey, { unit: event.target.value })
                  }
                >
                  {field.allowedUnits.map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("方法", "Method")}
                <input
                  value={value?.method ?? ""}
                  onChange={(event) =>
                    patch(field.fieldKey, { method: event.target.value })
                  }
                />
              </label>
              <label>
                {t("工具及型号", "Tool and model")}
                <input
                  value={value?.tool ?? ""}
                  onChange={(event) =>
                    patch(field.fieldKey, { tool: event.target.value })
                  }
                />
              </label>
              <label>
                {t(
                  "实际测量时间（当地时间）",
                  "Actual measurement time (local)",
                )}
                <input
                  type="datetime-local"
                  value={localTime(value?.measuredAt ?? "")}
                  onChange={(event) =>
                    patch(field.fieldKey, {
                      measuredAt: event.target.value
                        ? new Date(event.target.value).toISOString()
                        : "",
                    })
                  }
                />
              </label>
              {context.map((key) => (
                <label key={key}>
                  {requirementLabel(key, locale)}
                  <input
                    value={value?.context[key] ?? ""}
                    onChange={(event) =>
                      patch(field.fieldKey, {
                        context: {
                          ...value?.context,
                          [key]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            {value && (
              <button
                type="button"
                onClick={() =>
                  onChange(
                    values.filter(
                      (candidate) => candidate.fieldKey !== field.fieldKey,
                    ),
                  )
                }
              >
                {t("移除此读数", "Remove this reading")}
              </button>
            )}
          </fieldset>
        );
      })}
    </section>
  );
}
