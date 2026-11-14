import type { Locale, Market } from "../../domain";

import type { MaterialKind } from "../../data/model";
export type { MaterialKind } from "../../data/model";
export const MATERIAL_KINDS: MaterialKind[] = [
  "history",
  "maintenance",
  "ownership",
  "recalls",
];
const TITLES: Record<MaterialKind, [string, string]> = {
  history: ["车辆历史", "Vehicle history"],
  maintenance: ["维修与保养", "Repairs and maintenance"],
  ownership: ["登记与产权资料", "Registration and ownership"],
  recalls: ["召回资料", "Recall information"],
};
export function materialTitle(kind: MaterialKind, locale: Locale): string {
  return TITLES[kind][locale === "en" ? 1 : 0];
}

/** 中文：取得途径只提示外部来源，不把访问或资料缺失当成已查询或无异常。 English: Guidance points to external sources; neither visiting nor missing material becomes a completed check or a clean result. */
export function materialGuidance(
  kind: MaterialKind,
  market: Market,
  locale: Locale,
): { text: string; links: { label: string; url: string }[] } {
  const en = locale === "en";
  if (kind === "maintenance")
    return {
      text: en
        ? "Ask the owner for dated service invoices, the maintenance book, and authorized workshop records. Compare dates and odometer readings with the vehicle; note gaps or inconsistencies for your on-site checks."
        : "向车主取得带日期的维修发票、保养手册及获授权的维修机构记录。核对日期和里程，将缺口或矛盾留待现场检查。",
      links: [],
    };
  if (kind === "ownership")
    return {
      text: en
        ? market === "CN"
          ? "Ask the owner for the vehicle registration certificate, driving permit and transfer documents. Compare the VIN and owner details with the vehicle and use the local vehicle administration office for registration questions."
          : market === "CA"
            ? "Ask for the provincial or territorial registration and transfer documents. Confirm ownership details through the relevant licensing authority; requirements vary by location."
            : "Ask for the title, registration and transfer documents. Compare the VIN and owner details; contact the relevant state DMV for title or registration questions."
        : market === "CN"
          ? "向车主取得机动车登记证书、行驶证和转移登记相关文件，核对 VIN、车辆和登记信息；登记疑问向当地车管所核实。"
          : market === "CA"
            ? "向车主取得所在省或地区的登记及转让文件，向当地车辆登记机构核对产权信息；各地要求可能不同。"
            : "向车主取得产权证、登记与转让文件，核对 VIN 和车主信息；产权或登记疑问向所在州 DMV 核实。",
      links: [],
    };
  if (kind === "history")
    return {
      text: en
        ? market === "US"
          ? "Obtain a history report from a provider you choose. NMVTIS explains access through approved providers and the scope of title, odometer and salvage records. A report does not replace the on-site inspection."
          : "Ask the owner for available accident, insurance and previous inspection records, or obtain a report from a provider you choose. Confirm its coverage and dates; a report does not replace the on-site inspection."
        : market === "US"
          ? "通过自行选择的机构取得车辆历史报告。NMVTIS 提供获批机构的取得途径及产权、里程和报废记录范围说明。历史报告不代替现场检查。"
          : "向车主取得可提供的事故、保险和既往检查记录，或通过自行选择的机构取得历史报告。核对覆盖范围和日期；历史报告不代替现场检查。",
      links:
        market === "US"
          ? [
              {
                label: en
                  ? "NMVTIS: obtaining a vehicle history report"
                  : "NMVTIS：车辆历史报告取得说明",
                url: "https://vehiclehistory.bja.ojp.gov/faq/list",
              },
            ]
          : [],
    };
  // 中文：这些现有官方入口已核对；打开时需要网络，软件不代用户查询或上传 VIN。
  // English: These existing official entry points were checked; opening requires a network, and the app never queries or uploads a VIN for the user.
  if (market === "US")
    return {
      text: en
        ? "Use NHTSA or the manufacturer to check the VIN for applicable recalls. Keep the result and date, and ask the manufacturer or dealer about repairs and search limitations."
        : "通过 NHTSA 或厂商按 VIN 核查召回，保存结果和查询日期；完成情况及查询范围向厂商或经销商确认。",
      links: [
        {
          label: en ? "NHTSA recall lookup" : "NHTSA 召回查询",
          url: "https://www.nhtsa.gov/recalls",
        },
      ],
    };
  if (market === "CA")
    return {
      text: en
        ? "Use Transport Canada’s manufacturer directory to reach the maker’s VIN recall service. Confirm applicable recalls and repair completion with the manufacturer or dealer."
        : "通过加拿大交通部厂商目录进入厂商 VIN 召回查询；向厂商或经销商确认适用召回及维修完成情况。",
      links: [
        {
          label: en
            ? "Transport Canada: manufacturer recall services"
            : "加拿大交通部：厂商召回渠道",
          url: "https://tc.canada.ca/en/road-transportation/defects-recalls-vehicles-tires-child-car-seats/find-vehicle-tire-child-car-seat-manufacturer",
        },
      ],
    };
  return {
    text: en
      ? "Use the SAMR recall centre’s vehicle recall services or the manufacturer. Confirm applicability to this VIN and repair completion with the manufacturer or dealer."
      : "通过市场监管总局召回中心的汽车召回查询服务或厂商渠道核查，向厂商或经销商确认此 VIN 是否适用及维修完成情况。",
    links: [
      {
        label: en ? "SAMR recall centre" : "市场监管总局召回中心",
        url: "https://www.samrdprc.org.cn/ztbd/qczhbmfw/",
      },
    ],
  };
}
