/** 中文：离线就绪只在应用资源缓存成功激活后报告，开发模式不注册。 English: Report offline readiness only after the resource cache activates; development does not register a worker. */
export async function prepareOfflineResources(): Promise<void> {
  if (!("serviceWorker" in navigator)) throw new Error("OFFLINE_CACHE_UNAVAILABLE");
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
}
