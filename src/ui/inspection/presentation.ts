import type {
  FrozenTaskEntry,
  Locale,
  TaskStatus,
  WorkflowText,
} from "../../domain";

/** 中文：按已选语言显示已发布内容，不改写专业文本。 English: Display published content in the selected language without rewriting it. */
export function workflowText(value: WorkflowText, locale: Locale): string {
  return value[locale];
}
export function taskTitle(entry: FrozenTaskEntry, locale: Locale): string {
  return entry.task.label[locale];
}
export function taskStatusLabel(
  status: TaskStatus | null,
  locale: Locale,
): string {
  const names = {
    normal: ["正常", "Normal"],
    abnormal: ["异常", "Abnormal"],
    unknown: ["无法确认", "Unable to confirm"],
    not_applicable: ["不适用", "Not applicable"],
    pending: ["未完成", "Not recorded"],
  };
  return names[status ?? "pending"][locale === "en" ? 1 : 0];
}

/** 中文：领域错误转为可修正的输入提示；存储失败明确保留草稿。 English: Turn domain errors into actionable input guidance and retain drafts on storage failure. */
export function inspectionError(error: unknown, locale: Locale): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.message.split(":")[0]
        : "";
  const labels: Record<string, [string, string]> = {
    LOCAL_DATA_CHANGED: [
      "另一窗口已更新记录，请重试保存。你的输入仍保留。",
      "Another window updated the records. Retry saving; your input is retained.",
    ],
    TASK_REASON_REQUIRED: [
      "请填写无法确认或不适用的实际原因。",
      "Enter the actual reason this cannot be confirmed or does not apply.",
    ],
    TASK_FINDING_REQUIRED: [
      "请选择此项目实际发现的异常迹象。",
      "Select the findings you observed for this item.",
    ],
    TASK_SAFETY_ACK_REQUIRED: [
      "请先阅读安全说明并确认实际条件。",
      "Read the safety instructions and confirm the actual conditions first.",
    ],
    TASK_MEASUREMENT_CONTEXT_REQUIRED: [
      "请补齐必要读数、方法、工具及时间，或记录无法确认。",
      "Complete the required readings, method, tool and time, or record that confirmation is unavailable.",
    ],
    INVALID_TASK_MEASUREMENT: [
      "请按允许单位和小数位填写读数与实际测量时间。",
      "Use an allowed unit and decimal precision, with the actual measurement time.",
    ],
    TASK_DEPENDENCY_BLOCKED: [
      "请先完成列出的前置项目，或记录无法确认的原因。",
      "Complete the listed prerequisites, or record why confirmation is unavailable.",
    ],
    INVALID_TASK_BATCH: [
      "这些部位尚不满足同类确认条件，请逐项检查。",
      "These positions are not eligible for batch confirmation. Check them individually.",
    ],
    UNSAVED_INPUT: [
      "此项目还有未保存内容。请修正、重试保存或放弃未保存修改。",
      "This item has unsaved input. Correct it, retry saving, or discard the unsaved changes.",
    ],
    FILE_SIZE_INVALID: [
      "请选择不超过 50 MiB 的非空图片。",
      "Choose a nonempty image no larger than 50 MiB.",
    ],
    IMAGE_DECODE_FAILED: [
      "此图片暂不能读取，请重新选择 JPEG 或 PNG 图片。",
      "This image could not be read. Choose a JPEG or PNG image.",
    ],
    FILE_SIGNATURE_MISMATCH: [
      "此图片格式暂不支持，请选择 JPEG 或 PNG 图片。",
      "This image format is not supported. Choose a JPEG or PNG image.",
    ],
  };
  return (labels[code] ?? [
    "保存未完成，填写内容仍保留。请重试。",
    "Saving did not finish. Your input is retained; please retry.",
  ])[locale === "en" ? 1 : 0];
}
