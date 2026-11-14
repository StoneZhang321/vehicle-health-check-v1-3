import type { SVGProps } from "react";
import styles from "./inspection.module.css";

/** 中文：一致圆角线宽和文字标签共同传达动作。 English: Consistent rounded strokes accompany text labels for every action. */
export function WorkflowIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & {
  name:
    | "camera"
    | "normal"
    | "abnormal"
    | "unknown"
    | "not_applicable"
    | "location"
    | "document"
    | "edit"
    | "undo"
    | "vehicle";
}) {
  const paths = {
    camera: (
      <>
        <path d="m8 5 1-2h6l1 2h4v15H4V5Z" />
        <circle cx="12" cy="12" r="4" />
      </>
    ),
    normal: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m7.5 12 3 3 6-6" />
      </>
    ),
    abnormal: (
      <>
        <path d="m12 3 10 17H2Z" />
        <path d="M12 9v4m0 4h.01" />
      </>
    ),
    unknown: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8.5a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3h.01" />
      </>
    ),
    not_applicable: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m6 6 12 12" />
      </>
    ),
    location: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    document: (
      <>
        <path d="M6 3h8l4 4v14H6Zm8 0v5h4M9 12h6m-6 4h6" />
      </>
    ),
    edit: (
      <>
        <path d="m14 4 6 6M4 20l2-7L16 3l5 5-10 10-7 2Z" />
      </>
    ),
    undo: (
      <>
        <path
          d="M3 10h11a7 7 0 0 1 0 14M3 10l5-5m-5 5 5 5"
          transform="translate(0 -3)"
        />
      </>
    ),
    vehicle: (
      <>
        <path d="m5 9 2-5h10l2 5 2 3v6H3v-6l2-3Zm0 0h14M6 18v3m12-3v3M6 13h2m8 0h2" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={styles.icon}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
