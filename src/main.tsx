/** 中文：启动界面和本机数据，资源准备后注册离线缓存。 English: Start the UI and local data, then register the offline resource cache. */
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

