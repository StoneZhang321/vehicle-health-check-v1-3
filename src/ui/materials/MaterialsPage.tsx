import { useEffect, useRef, useState } from "react";
import type { Locale, Market } from "../../domain";
import { Dialog } from "../common/Dialog";
import {
  MATERIAL_KINDS,
  materialGuidance,
  materialTitle,
  type MaterialKind,
} from "./guidance";
import styles from "./materials.module.css";

export interface MaterialView {
  kind: MaterialKind;
  text: string;
  sourceName: string;
  sourceUrl: string;
  fileIds: string[];
}
export interface MaterialAttachment {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}
export interface MaterialInput {
  text: string;
  sourceName: string;
  sourceUrl: string;
  fileIds: string[];
  files: File[];
}
export interface MaterialsPageProps {
  inspectionId: string;
  locale: Locale;
  market: Market;
  materials: MaterialView[];
  attachments: MaterialAttachment[];
  readOnly?: boolean;
  onSave: (kind: MaterialKind, input: MaterialInput) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

/** 中文：四类可选资料分别编辑，任何空白均不阻断检测；此页不解析文字或改变检查事实。 English: Edit four optional material categories; blanks never block inspection, and text never becomes inspection facts. */
export function MaterialsPage(props: MaterialsPageProps) {
  const dirty = useRef(new Set<MaterialKind>()),
    callback = useRef(props.onDirtyChange);
  callback.current = props.onDirtyChange;
  useEffect(() => () => callback.current?.(false), []);
  function setDirty(kind: MaterialKind, value: boolean) {
    if (value) dirty.current.add(kind);
    else dirty.current.delete(kind);
    callback.current?.(dirty.current.size > 0);
  }
  const t = (zh: string, en: string) => (props.locale === "en" ? en : zh);
  return (
    <div className={styles.page}>
      <header>
        <h2>{t("补充资料", "Supplementary materials")}</h2>
        <p>
          {t(
            "全部可选。可粘贴、手打，或使用设备输入法语音输入。没有资料时直接返回检测。",
            "Everything is optional. Paste, type, or use your device keyboard’s voice input. Return to the inspection if you have no material.",
          )}
        </p>
        <p>
          {t(
            "填写文字会按原文进入报告；原件留在本机，第三方 PDF 不会整份拼入现场检查报告。",
            "Entered text appears verbatim in the report. Originals stay on this device; third-party PDFs are not appended to the on-site report.",
          )}
        </p>
      </header>
      {MATERIAL_KINDS.map((kind) => (
        <MaterialEditor
          key={`${props.inspectionId}/${kind}`}
          {...props}
          kind={kind}
          value={props.materials.find((row) => row.kind === kind)}
          onDirty={(value) => setDirty(kind, value)}
        />
      ))}
    </div>
  );
}

/** 中文：一次保存同时提交原文、来源与附件变更；保存失败保留整份编辑。 English: Save text, source and attachment changes together, retaining the entire edit if saving fails. */
function MaterialEditor(
  props: MaterialsPageProps & {
    kind: MaterialKind;
    value?: MaterialView;
    onDirty: (dirty: boolean) => void;
  },
) {
  const { kind, locale, value } = props;
  const t = (zh: string, en: string) => (locale === "en" ? en : zh);
  const guidance = materialGuidance(kind, props.market, locale),
    title = materialTitle(kind, locale);
  const [draft, setDraft] = useState<MaterialInput>(() => ({
    text: value?.text ?? "",
    sourceName: value?.sourceName ?? "",
    sourceUrl: value?.sourceUrl ?? "",
    fileIds: [...(value?.fileIds ?? [])],
    files: [],
  }));
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<MaterialAttachment | null>(null);
  const input = useRef<HTMLInputElement>(null),
    replacement = useRef<string | null>(null);
  const latestDirty = useRef(dirty);
  latestDirty.current = dirty;
  const onDirty = useRef(props.onDirty);
  onDirty.current = props.onDirty;
  useEffect(() => {
    onDirty.current(dirty);
  }, [dirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latestDirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function patch(change: Partial<MaterialInput>) {
    setDraft((current) => ({ ...current, ...change }));
    setDirty(true);
    setMessage("");
    setFailed(false);
  }
  function chooseFiles(replaceId: string | null = null) {
    replacement.current = replaceId;
    input.current?.click();
  }
  function picked(files: FileList | null) {
    if (!files?.length) return;
    const additions = Array.from(files),
      replaceId = replacement.current;
    replacement.current = null;
    if (
      additions.some(
        (file) =>
          !file.size ||
          file.size > 50 * 1024 * 1024 ||
          !(
            file.type.startsWith("image/") ||
            file.type === "application/pdf" ||
            /\.pdf$/i.test(file.name)
          ),
      )
    ) {
      setFailed(true);
      setMessage(
        t(
          "请选择不超过 50 MiB 的非空图片或 PDF。",
          "Choose nonempty images or PDFs no larger than 50 MiB each.",
        ),
      );
      return;
    }
    patch({
      fileIds: draft.fileIds.filter((id) => id !== replaceId),
      files: [...draft.files, ...additions],
    });
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      if (draft.sourceUrl.trim()) {
        const url = new URL(draft.sourceUrl);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("URL");
      }
      await props.onSave(kind, draft);
      setDirty(false);
      setMessage(t("已保存", "Saved"));
      // 中文：新文件身份由父层提交结果提供，不保留第二套文件元数据。 English: The parent supplies committed file identities; keep no second metadata authority.
    } catch (failure) {
      setFailed(true);
      setMessage(
        failure instanceof TypeError ||
          (failure instanceof Error && failure.message === "URL")
          ? t(
              "请填写完整的 http 或 https 来源链接，或留空。",
              "Enter a complete http or https source URL, or leave it blank.",
            )
          : t(
              "保存未完成，文字和选定原件仍保留。请重试。",
              "Saving did not finish. Text and selected originals are retained; please retry.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  // 中文：只有没有未保存编辑时，才采用父层已提交版本（包括新附件身份）。 English: Adopt committed data, including new file IDs, only when no unsaved edits exist.
  useEffect(() => {
    if (!dirty && !busy)
      setDraft({
        text: value?.text ?? "",
        sourceName: value?.sourceName ?? "",
        sourceUrl: value?.sourceUrl ?? "",
        fileIds: [...(value?.fileIds ?? [])],
        files: [],
      });
  }, [value, dirty, busy]);
  const files = props.attachments.filter((file) =>
    draft.fileIds.includes(file.id),
  );
  return (
    <section className={styles.card} aria-labelledby={`material-${kind}`}>
      <h3 id={`material-${kind}`}>{title}</h3>
      <p>{guidance.text}</p>
      {guidance.links.length > 0 && (
        <div className={styles.links}>
          {guidance.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              {link.label} ↗
            </a>
          ))}
          <small>
            {t(
              "外部网站需要网络。",
              "External websites require a network connection.",
            )}
          </small>
        </div>
      )}
      <label>
        {t("资料文字（可选）", "Material text (optional)")}
        <textarea
          aria-label={`${title} — ${t("资料文字", "Material text")}`}
          value={draft.text}
          disabled={busy || props.readOnly}
          onChange={(event) => patch({ text: event.target.value })}
          placeholder={t(
            "直接粘贴或填写原文，保留你需要的段落。",
            "Paste or enter the original text, retaining the paragraphs you need.",
          )}
        />
      </label>
      <div className={styles.formGrid}>
        <label>
          {t("来源名称（可选）", "Source name (optional)")}
          <input
            aria-label={`${title} — ${t("来源名称", "Source name")}`}
            value={draft.sourceName}
            disabled={busy || props.readOnly}
            onChange={(event) => patch({ sourceName: event.target.value })}
          />
        </label>
        <label>
          {t("来源链接（可选）", "Source URL (optional)")}
          <input
            aria-label={`${title} — ${t("来源链接", "Source URL")}`}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={draft.sourceUrl}
            disabled={busy || props.readOnly}
            onChange={(event) => patch({ sourceUrl: event.target.value })}
          />
        </label>
      </div>
      <div className={styles.files}>
        {files.map((file) => (
          <article key={file.id}>
            <button
              className={styles.filePreview}
              onClick={() => setPreview(file)}
            >
              {file.mimeType.startsWith("image/") && (
                <img src={file.url} alt="" />
              )}
              <span>{file.name}</span>
            </button>
            {!props.readOnly && (
              <div className={styles.row}>
                <button disabled={busy} onClick={() => chooseFiles(file.id)}>
                  {t("替换", "Replace")}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    patch({
                      fileIds: draft.fileIds.filter((id) => id !== file.id),
                    })
                  }
                >
                  {t("删除原件", "Remove original")}
                </button>
              </div>
            )}
          </article>
        ))}
        {draft.files.map((file, index) => (
          <article key={`${file.name}/${index}`}>
            <span>{file.name}</span>
            <small>{t("待保存原件", "Original awaiting save")}</small>
            <button
              disabled={busy}
              onClick={() =>
                patch({
                  files: draft.files.filter((_, item) => item !== index),
                })
              }
            >
              {t("移除选择", "Remove selection")}
            </button>
          </article>
        ))}
      </div>
      {!props.readOnly && (
        <div className={styles.row}>
          <button disabled={busy} onClick={() => chooseFiles()}>
            {t("添加图片或 PDF 原件", "Add original image or PDF")}
          </button>
          <button
            className={styles.primary}
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            {busy
              ? t("正在保存…", "Saving…")
              : t("保存这项资料", "Save this material")}
          </button>
          {dirty && (
            <button
              disabled={busy}
              onClick={() => {
                setDirty(false);
                setMessage("");
                setFailed(false);
              }}
            >
              {t("放弃未保存修改", "Discard unsaved changes")}
            </button>
          )}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(event) => {
          picked(event.target.files);
          event.target.value = "";
        }}
      />
      {message && (
        <p
          className={failed ? styles.error : styles.saved}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {preview && (
        <Dialog
          title={preview.name}
          onClose={() => setPreview(null)}
          actions={
            <a href={preview.url} download={preview.name}>
              {t("下载原件", "Download original")}
            </a>
          }
        >
          {preview.mimeType.startsWith("image/") ? (
            <img
              className={styles.previewImage}
              src={preview.url}
              alt={preview.name}
            />
          ) : (
            <iframe
              className={styles.pdfPreview}
              src={preview.url}
              title={preview.name}
            />
          )}
        </Dialog>
      )}
    </section>
  );
}
