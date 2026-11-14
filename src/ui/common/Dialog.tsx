/** 中文：独立滚动的无障碍窗口；背景保持原位置，关闭时恢复焦点。 English: Accessible dialogs scroll independently and restore focus without moving the background. */
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface DialogProps { title: string; children: ReactNode; onClose: () => void; actions?: ReactNode }
let depth = 0;

export function Dialog({ title, children, onClose, actions }: DialogProps) {
  const titleId = useId(), panel = useRef<HTMLDivElement>(null), closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById("root");
    depth++; if (root) root.inert = true;
    panel.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (!panel.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key === "Tab") {
        const candidates = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
        const first = candidates[0], last = candidates.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      depth--; if (root && depth === 0) root.inert = false;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className="dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dialog-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="dialog-header"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label={document.documentElement.lang.startsWith("zh") ? "关闭" : "Close"}>×</button></header>
        <div className="dialog-body">{children}</div>
        {actions && <footer className="dialog-actions">{actions}</footer>}
      </div>
    </div>, document.body,
  );
}
