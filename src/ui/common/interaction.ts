/** 中文：可视空间、附件URL和下载的共用行为；页面不重复管理这些资源。 English: Shared viewport, attachment URL and download behavior avoids page-specific patches. */
import { useEffect, useState } from "react";
import type { Attachment } from "../../data/model";

export function useAvailableViewport() {
  useEffect(() => {
    let frame = 0;
    const fit = () => {
      const viewport = window.visualViewport;
      document.documentElement.style.setProperty("--app-height", `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty("--app-top", `${viewport?.offsetTop ?? 0}px`);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return;
        const rect = active.getBoundingClientRect(), height = viewport?.height ?? window.innerHeight;
        if (rect.bottom > height - 16 || rect.top < 48) active.scrollIntoView({ block: "nearest" });
      });
    };
    fit(); window.addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); };
  }, []);
}

/** 中文：URL仅用于展示，不成为存储权威；卸载时释放对象URL。 English: Object URLs are display resources, never persisted state, and are released on unmount. */
export function useAttachmentUrls(attachments: Attachment[], getFile: (id: string) => Promise<Blob>) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const key = attachments.map(file => file.id).join(",");
  useEffect(() => {
    let cancelled = false;
    const allocated: string[] = [];
    setError("");
    setUrls({});
    void Promise.all(key.split(",").filter(Boolean).map(async id => {
      const file = await getFile(id);
      if (cancelled) return null;
      const url = URL.createObjectURL(file); allocated.push(url); return [id, url] as const;
    })).then(entries => { if (!cancelled) setUrls(Object.fromEntries(entries.filter(entry => entry !== null))); }).catch(() => { if (!cancelled) setError("ATTACHMENT_MISSING"); });
    return () => { cancelled = true; allocated.forEach(url => URL.revokeObjectURL(url)); };
  }, [key, getFile]);
  return { urls, error };
}

/** 中文：生成常规文件下载，延后释放URL以便浏览器完成读取。 English: Start a regular download and release its URL after the browser has read it. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
