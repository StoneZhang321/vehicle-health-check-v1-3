/** 中文：主导航使用同一尺寸与圆角线条的矢量图标，文字标签保留完整含义。
 * English: Navigation uses consistent, rounded vector icons; visible labels retain each destination's meaning. */
export function NavigationIcon({ name }: { name: "home" | "vehicles" | "reports" | "settings" | "back" }) {
  const paths = {
    home: <><path d="m3 10 7.7-6.3a2 2 0 0 1 2.6 0L21 10" /><path d="M5 8.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" /></>,
    vehicles: <><path d="m5 10 1.4-4.2A2 2 0 0 1 8.3 4.5h7.4a2 2 0 0 1 1.9 1.3L19 10M5 10h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2ZM5 18v2m14-2v2M6.5 13.5H8m8 0h1.5M10 16h4M3 9l2 1m14 0 2-1" /></>,
    reports: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v4a1 1 0 0 0 1 1h4M9 17v-3m3 3v-6m3 6v-4" /></>,
    settings: <><path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11" /><circle cx="10" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
    back: <path d="m14.5 6-6 6 6 6" />,
  };
  return <svg className="navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
