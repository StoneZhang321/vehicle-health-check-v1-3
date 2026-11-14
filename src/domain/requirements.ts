import type { Locale } from "./types";

/** 中文：显式翻译内容条件键，不从稳定身份推断业务含义。 English: Explicitly translate condition keys without deriving semantics from stable identities. */
const labels: Record<string, [string, string]> = {
  applicable_oem_body_information: [
    "适用车型的原厂车身资料",
    "Applicable OEM body information",
  ],
  applicable_vehicle_instructions: [
    "适用车型说明书",
    "Applicable vehicle instructions",
  ],
  authorized_battery_health_report: [
    "获授权的电池健康报告",
    "Authorized battery health report",
  ],
  available_dated_records: ["可取得且带日期的记录", "Available dated records"],
  clean_absorbent_board: ["干净吸液板", "Clean absorbent board"],
  compatible_charger: ["兼容充电设备", "Compatible charger"],
  compatible_professional_low_voltage_battery_tester: [
    "兼容的专业低压电池测试仪",
    "Compatible professional low-voltage battery tester",
  ],
  flashlight: ["手电筒", "Flashlight"],
  flashlight_or_mirror: ["手电筒或观察镜", "Flashlight or mirror"],
  inspection_light: ["检查灯", "Inspection light"],
  obd_scanner: ["OBD诊断仪", "OBD scanner"],
  official_lookup_access: [
    "可用的官方查询渠道",
    "Available official lookup channel",
  ],
  owner_authorized_documents: ["车主授权资料", "Owner-authorized documents"],
  paint_thickness_gauge: ["漆膜仪", "Paint thickness gauge"],
  timer: ["计时器", "Timer"],
  tread_depth_gauge: ["胎纹深度尺", "Tread depth gauge"],
  licensed_authorized_driver: [
    "持有效驾照且获授权的驾驶员",
    "Licensed, authorized driver",
  ],
  qualified_lift_operator: ["合格举升操作人员", "Qualified lift operator"],
  cold_state_verified_before_first_start: [
    "首次启动前已核实冷车状态",
    "Cold state verified before the first start",
  ],
  normal_drive_complete: ["已完成正常行驶", "Normal drive completed"],
  parts_naturally_cooled: [
    "相关部件已自然冷却",
    "Relevant parts naturally cooled",
  ],
  pre_drive_safety_confirmed: [
    "已确认行驶前安全条件",
    "Pre-drive safety confirmed",
  ],
  vehicle_securely_supported_per_oem: [
    "车辆按原厂要求可靠支撑",
    "Vehicle securely supported as specified by the manufacturer",
  ],
  documents_available: ["相关资料已取得", "Relevant documents available"],
  key_delivery_agreement_or_owner_statement_available: [
    "交钥匙约定或车主说明可用",
    "Key handover agreement or owner statement available",
  ],
  locally_applicable_vehicle_documents_available: [
    "当地适用车辆文件可用",
    "Locally applicable vehicle documents available",
  ],
  owner_authorized_access: ["车主已授权检查", "Owner-authorized access"],
  qualified_driver: ["合格驾驶员配合", "Qualified driver available"],
  qualified_driver_and_owner_permission: [
    "合格驾驶员且车主已同意",
    "Qualified driver and owner permission",
  ],
  qualified_driver_if_combustion_engine_run_required: [
    "需要发动机运转时由合格驾驶员配合",
    "Qualified driver if engine operation is required",
  ],
  qualified_driver_or_owner_for_normal_idle: [
    "合格驾驶员或车主负责正常怠速",
    "Qualified driver or owner controls normal idling",
  ],
  qualified_driver_or_owner_remains_at_controls: [
    "合格驾驶员或车主留在控制位置",
    "Qualified driver or owner remains at the controls",
  ],
  qualified_driver_performs_normal_start: [
    "合格驾驶员执行正常启动",
    "Qualified driver performs a normal start",
  ],
  qualified_person_for_battery_tester_connection: [
    "合格人员连接电池测试仪",
    "Qualified person connects the battery tester",
  ],
  qualified_professional: [
    "合格专业人员配合",
    "Qualified professional available",
  ],
  seated_observer: ["观察者就座", "Observer seated"],
  second_observer_or_safe_reflection_available: [
    "第二观察者或安全反射视野可用",
    "Second observer or safe reflection available",
  ],
  seller_or_owner_performs_normal_cold_start: [
    "卖方或车主执行正常冷启动",
    "Seller or owner performs a normal cold start",
  ],
  seller_or_owner_permission: [
    "已获卖方或车主同意",
    "Seller or owner permission",
  ],
  vehicle_contract_or_handover_document_available: [
    "车辆合同或交接文件可用",
    "Vehicle contract or handover document available",
  ],
  vehicle_instructions_or_owner_information_available: [
    "车辆说明书或车主资料可用",
    "Vehicle instructions or owner information available",
  ],
  applicable_legal_and_manufacturer_tread_limits_available: [
    "已取得当地法规与厂商胎纹限值",
    "Applicable legal and manufacturer tread limits available",
  ],
  applicable_model_brake_pad_limit_available: [
    "已取得本车型刹车片限值",
    "Brake pad limit for this model available",
  ],
  appropriate_brake_pad_gauge_available_if_measurement_performed: [
    "测量时有合适的刹车片量具",
    "Appropriate brake pad gauge available if measuring",
  ],
  board_clear_of_hot_parts: ["吸液板远离高温部件", "Board clear of hot parts"],
  body_material_and_repair_history_available: [
    "车身材料与维修历史可核对",
    "Body material and repair history available",
  ],
  brake_components_cooled: ["制动部件已冷却", "Brake components cooled"],
  cabin_or_ground_level_roof_view: [
    "仅从车内或地面观察车顶",
    "Roof viewed from the cabin or ground level only",
  ],
  charge_port_door_path_clear: [
    "充电口盖行程内无障碍",
    "Charge port door path clear",
  ],
  collision_or_structural_repair_records_available_if_any: [
    "如有事故或结构维修记录可供核对",
    "Collision or structural repair records available if any",
  ],
  compatible_safe_charging_available: [
    "具备兼容且安全的充电条件",
    "Compatible safe charging available",
  ],
  compatible_working_obd_scanner_available: [
    "兼容且正常工作的OBD诊断仪可用",
    "Compatible working OBD scanner available",
  ],
  confirmed_cold_data_state_before_first_start: [
    "首次启动前已确认冷车数据状态",
    "Cold data state confirmed before first start",
  ],
  confirmed_cold_start_state: [
    "已确认冷启动条件",
    "Cold-start state confirmed",
  ],
  controlled_stationary_gear_selection_area: [
    "受控场地内静止选挡",
    "Controlled area for stationary gear selection",
  ],
  cooling_system_confirmed_unpressurized_without_user_release: [
    "已确认冷却系统无压力，不由用户泄压",
    "Cooling system confirmed unpressurized without user pressure release",
  ],
  dipstick_or_valid_vehicle_oil_display_available: [
    "油尺或有效车载油量显示可用",
    "Dipstick or valid vehicle oil display available",
  ],
  doors_or_windows_opened_for_adequate_ventilation: [
    "已开门窗保持充分通风",
    "Doors or windows opened for adequate ventilation",
  ],
  dry_low_voltage_test_area: ["低压测试区域干燥", "Dry low-voltage test area"],
  edge_only_cardboard_placement_and_retrieval: [
    "仅从车辆边缘放取纸板",
    "Place and retrieve cardboard from the edge only",
  ],
  edge_only_exhaust_view_available: [
    "仅从边缘观察排气部件",
    "Exhaust view available from the edge only",
  ],
  edge_only_underbody_view_available: [
    "仅从边缘观察底部",
    "Underbody view available from the edge only",
  ],
  edge_or_top_visible_structure_without_lifting: [
    "不举升，仅从边缘或上方观察可见结构",
    "Visible structure from edge or above without lifting",
  ],
  engine_naturally_fully_cooled: [
    "发动机已自然完全冷却",
    "Engine naturally fully cooled",
  ],
  engine_off: ["发动机已关闭", "Engine off"],
  engine_off_and_naturally_fully_cooled: [
    "发动机已关闭并自然完全冷却",
    "Engine off and naturally fully cooled",
  ],
  exhaust_catalyst_and_thermal_parts_fully_naturally_cooled: [
    "排气、催化器和热部件已自然完全冷却",
    "Exhaust, catalyst, and thermal parts naturally fully cooled",
  ],
  exhaust_fully_cooled: ["排气部件已完全冷却", "Exhaust fully cooled"],
  external_sidewall_view_only: [
    "仅观察外侧胎壁",
    "External sidewall view only",
  ],
  front_and_rear_trunk_lids_stationary_and_latched: [
    "前后备厢盖静止并锁定",
    "Front and rear trunk lids stationary and latched",
  ],
  front_trunk_travel_path_clear: [
    "前备厢盖行程内无障碍",
    "Front trunk travel path clear",
  ],
  full_ten_minute_timer_available: [
    "可进行完整十分钟计时",
    "Full ten-minute timer available",
  ],
  ground_level_safe_reach_only: [
    "仅在地面安全可及范围检查",
    "Ground-level safe reach only",
  ],
  hidden_inner_scope_routes_to_unable: [
    "内侧不可见范围记录无法确认",
    "Hidden inner scope is recorded as unable to confirm",
  ],
  hidden_inner_side_routes_to_professional_follow_up: [
    "不可见内侧交专业人员复检",
    "Hidden inner side requires professional follow-up",
  ],
  hidden_or_unreadable_date_code_routes_to_unable: [
    "日期码不可见或无法读取时记录无法确认",
    "Hidden or unreadable date code remains unconfirmed",
  ],
  high_voltage_boundary_identified: [
    "已辨明高压安全边界",
    "High-voltage boundary identified",
  ],
  hinge_latch_and_travel_paths_clear: [
    "铰链、锁扣及运动路径无障碍",
    "Hinge, latch, and travel paths clear",
  ],
  hood_support_secure: ["发动机盖支撑可靠", "Hood support secure"],
  hose_identified_and_safely_accessible: [
    "已辨明管路且可安全接近",
    "Hose identified and safely accessible",
  ],
  hot_components_cooled_enough_for_observation: [
    "高温部件已冷却至可安全观察",
    "Hot components cooled enough for observation",
  ],
  immediate_exit_available: ["可立即离开车辆", "Immediate exit available"],
  in_cabin_stationary_controls_only: [
    "仅在静止车内操作控制件",
    "Stationary in-cabin controls only",
  ],
  latch_and_seal_inspection_only_when_stationary: [
    "仅在部件静止时检查锁扣和密封",
    "Inspect latches and seals only when stationary",
  ],
  leave_without_equipment_if_fuel_odor_or_vapor_suspected: [
    "怀疑燃油气味或蒸气时立即离开，不携设备检查",
    "Leave without equipment if fuel odor or vapor is suspected",
  ],
  legal_open_low_speed_controlled_braking_area: [
    "合法、开阔、可受控低速制动的场地",
    "Legal, open area for controlled low-speed braking",
  ],
  legal_safe_road_test_available: [
    "具备合法安全的路试条件",
    "Legal and safe road test available",
  ],
  low_voltage_boundary_identified: [
    "已辨明低压边界",
    "Low-voltage boundary identified",
  ],
  manual_defined_climate_operating_state: [
    "符合说明书规定的空调运行状态",
    "Climate operating state specified by the manual",
  ],
  manual_defined_low_voltage_test_point: [
    "使用说明书规定的低压测试点",
    "Low-voltage test point specified by the manual",
  ],
  manual_defined_shutdown_and_wait_completed: [
    "已按说明书关闭并等待规定时间",
    "Manual-defined shutdown and waiting period completed",
  ],
  manual_defined_transmission_cooling_condition_met: [
    "满足说明书规定的变速器冷却条件",
    "Manual-defined transmission cooling condition met",
  ],
  manual_permitted_read_only_connection_state: [
    "符合说明书允许的只读连接状态",
    "Manual-permitted read-only connection state",
  ],
  manual_permitted_steering_range_only: [
    "仅在说明书允许范围内转向",
    "Manual-permitted steering range only",
  ],
  manufacturer_tire_age_limit_available: [
    "厂商轮胎使用年限可核对",
    "Manufacturer tire age limit available",
  ],
  no_climbing_or_glass_contact: [
    "不攀爬，不接触玻璃",
    "No climbing or glass contact",
  ],
  no_ignition_sources_flame_or_smoking: [
    "无点火源、明火或吸烟",
    "No ignition sources, flames, or smoking",
  ],
  no_ignition_sources_or_smoking: [
    "无点火源或吸烟",
    "No ignition sources or smoking",
  ],
  observer_in_clean_air_away_from_tailpipe: [
    "观察者位于清洁空气处并远离尾管",
    "Observer in clean air away from tailpipe",
  ],
  odometer_reading_and_use_context_available: [
    "里程读数及使用情况可核对",
    "Odometer reading and use context available",
  ],
  one_storage_closure_operated_at_a_time: [
    "一次只操作一个储物盖",
    "Operate one storage closure at a time",
  ],
  open_outdoor_exhaust_observation_area: [
    "开阔室外排气观察区域",
    "Open outdoor exhaust observation area",
  ],
  orange_high_voltage_boundary_identified: [
    "已辨明橙色高压部件边界",
    "Orange high-voltage boundary identified",
  ],
  ordinary_progressive_braking_only: [
    "仅进行常规渐进制动",
    "Ordinary progressive braking only",
  ],
  outdoor_or_well_ventilated_area: [
    "室外或通风良好",
    "Outdoors or well ventilated",
  ],
  outdoor_or_well_ventilated_hvac_test_area: [
    "在室外或通风良好处测试空调",
    "Outdoor or well-ventilated climate test area",
  ],
  outdoor_or_well_ventilated_start_area: [
    "在室外或通风良好处启动",
    "Outdoor or well-ventilated start area",
  ],
  outside_only_visible_tire_and_wheel_scope: [
    "仅从外部观察可见轮胎轮圈",
    "Outside-only visible tire and wheel scope",
  ],
  outside_only_visible_tire_date_code_scope: [
    "仅从外部读取可见轮胎日期码",
    "Outside-only visible tire date code",
  ],
  paint_gauge_compatible_with_material: [
    "漆膜仪与材料兼容",
    "Paint gauge compatible with material",
  ],
  paint_thickness_gauge_compatible_and_calibrated: [
    "漆膜仪兼容且已校准",
    "Compatible and calibrated paint thickness gauge",
  ],
  paired_visual_gap_comparison_without_fingers: [
    "配对目视比较间隙，不伸入手指",
    "Compare paired gaps visually without fingers",
  ],
  park_or_neutral_confirmed: [
    "已确认停车挡或空挡",
    "Park or neutral confirmed",
  ],
  parking_brake_engaged: ["驻车制动已启用", "Parking brake engaged"],
  passive_cabin_air_observation_only: [
    "仅被动观察车内空气，不主动嗅闻",
    "Passive cabin air observation only",
  ],
  people_and_objects_clear_of_travel_zone: [
    "人员物品远离运动区域",
    "People and objects clear of travel zone",
  ],
  powered_lid_travel_paths_clear: [
    "电动盖板运动路径畅通",
    "Powered lid travel paths clear",
  ],
  powertrain_off_and_auto_start_disabled: [
    "动力关闭并停用自动启动",
    "Powertrain off and auto-start disabled",
  ],
  powertrain_off_and_cooled: ["动力关闭并冷却", "Powertrain off and cooled"],
  powertrain_off_and_fully_cooled: [
    "动力关闭并完全冷却",
    "Powertrain off and fully cooled",
  ],
  powertrain_off_cooled_and_auto_start_disabled: [
    "动力关闭、冷却并停用自动启动",
    "Powertrain off, cooled, and auto-start disabled",
  ],
  pre_drive_visible_area_baseline_documented: [
    "行驶前已记录同一可见区域基线",
    "Pre-drive baseline of the visible area documented",
  ],
  professional_lift_or_inspection_pit: [
    "专业举升设备或检查地沟可用",
    "Professional lift or inspection pit available",
  ],
  records_required_only_to_select_normal: [
    "只有资料充分才可选择正常",
    "Records are required before selecting normal",
  ],
  related_thermal_or_cooling_circuit_naturally_cooled: [
    "相关热管理或冷却回路已自然冷却",
    "Related thermal or cooling circuit naturally cooled",
  ],
  relevant_system_confirmed_unpressurized_without_user_release: [
    "已确认相关系统无压力，不由用户泄压",
    "Relevant system confirmed unpressurized without user release",
  ],
  safe_ground_or_cabin_view: [
    "从地面或车内可安全观察",
    "Safe ground or cabin view",
  ],
  safe_visible_access: ["可安全接近可见部位", "Safe visible access"],
  safety_service_or_diagnostic_records_available_if_any: [
    "如有安全维修或诊断记录可核对",
    "Safety service or diagnostic records available if any",
  ],
  same_material_justified_reference_available: [
    "有依据充分的同材质参考",
    "Justified same-material reference available",
  ],
  same_visible_area_reference_available: [
    "同一可见区域的参考记录可用",
    "Reference for the same visible area available",
  ],
  service_or_calibration_records_available_if_any: [
    "如有维修或校准记录可核对",
    "Service or calibration records available if any",
  ],
  single_normal_open_close_cycle_only: [
    "仅进行一次正常开关循环",
    "One normal open-close cycle only",
  ],
  srs_service_records_available_if_any: [
    "如有SRS维修记录可核对",
    "SRS service records available if any",
  ],
  static_brake_observation_only_for_general_user: [
    "普通用户仅作静态制动观察",
    "General users perform static brake observation only",
  ],
  static_brake_screen_precedes_unable_routing: [
    "先完成静态制动筛查，再决定无法确认的后续项目",
    "Static brake screening precedes routing to unable to confirm",
  ],
  stationary_displayed_driver_assistance_status_review_only: [
    "仅在静止时查看显示的驾驶辅助状态",
    "Review displayed driver-assistance status while stationary only",
  ],
  stationary_system_status_review_only: [
    "仅在静止时查看系统状态",
    "Review system status while stationary only",
  ],
  target_and_reference_material_confirmed: [
    "已确认目标和参考部位材质",
    "Target and reference materials confirmed",
  ],
  tester_compatible_with_vehicle_and_battery: [
    "测试仪与车辆及电池兼容",
    "Tester compatible with vehicle and battery",
  ],
  tire_placard_or_configuration_reference_available: [
    "轮胎标牌或配置参考可用",
    "Tire placard or configuration reference available",
  ],
  transmission_service_records_available_if_any: [
    "如有变速器维修记录可核对",
    "Transmission service records available if any",
  ],
  vehicle_instructions_available: [
    "车辆说明书可用",
    "Vehicle instructions available",
  ],
  vehicle_parked_after_normal_drive: [
    "正常行驶后车辆已停稳",
    "Vehicle parked after a normal drive",
  ],
  vehicle_parked_and_secured: [
    "车辆已停稳并固定",
    "Vehicle parked and secured",
  ],
  vehicle_parked_and_wheels_secured: [
    "车辆已停稳且车轮固定",
    "Vehicle parked and wheels secured",
  ],
  vehicle_parked_on_firm_level_ground: [
    "车辆停在坚实水平地面",
    "Vehicle parked on firm, level ground",
  ],
  vehicle_powered_down_or_parked: [
    "车辆已断电或停稳",
    "Vehicle powered down or parked",
  ],
  vehicle_production_and_low_voltage_battery_records_available: [
    "车辆生产及低压电池记录可用",
    "Vehicle production and low-voltage battery records available",
  ],
  vehicle_production_date_reference_available: [
    "车辆生产日期参考可用",
    "Vehicle production date reference available",
  ],
  vehicle_surroundings_and_suspension_zones_clear: [
    "车辆周围及悬架区域无人无障碍",
    "Vehicle surroundings and suspension zones clear",
  ],
  vehicle_surroundings_and_tire_zones_clear: [
    "车辆周围及轮胎区域无人无障碍",
    "Vehicle surroundings and tire zones clear",
  ],
  vehicle_surroundings_clear: [
    "车辆周围无人无障碍",
    "Vehicle surroundings clear",
  ],
  visible_access_without_disassembly: [
    "不拆解即可观察",
    "Visible access without disassembly",
  ],
  visible_access_without_wheel_removal: [
    "不拆轮即可观察",
    "Visible access without wheel removal",
  ],
  visible_external_leak_or_records_review_only: [
    "仅检查可见外部渗漏或查阅记录",
    "Visible external leaks or records review only",
  ],
  visible_fuel_door_and_seal_only: [
    "仅检查可见燃油口盖和密封",
    "Visible fuel door and seal only",
  ],
  visible_fuel_line_scope_only: [
    "仅检查可见燃油管路",
    "Visible fuel line scope only",
  ],
  visible_intake_access_without_disassembly: [
    "无需拆解即可观察进气部位",
    "Visible intake access without disassembly",
  ],
  visible_low_voltage_identity_confirmed_by_label_or_instructions: [
    "已由标牌或说明书确认可见低压部件身份",
    "Visible low-voltage identity confirmed by label or instructions",
  ],
  visible_low_voltage_label_without_disassembly: [
    "不拆解读取可见低压标牌",
    "Read visible low-voltage label without disassembly",
  ],
  visible_low_voltage_wiring_without_trim_removal: [
    "不拆饰板观察可见低压线束",
    "Visible low-voltage wiring without trim removal",
  ],
  visible_reservoir_and_manual_permitted_oil_sample_access: [
    "油壶可见，取样方式符合说明书",
    "Visible reservoir and manual-permitted oil sample access",
  ],
  visible_reservoir_hose_or_joint_without_opening: [
    "不打开系统观察可见油壶、管路或接头",
    "Visible reservoir, hose, or joint without opening",
  ],
  visual_door_and_seal_check_without_charger: [
    "不接充电器目视检查盖和密封",
    "Visual door and seal check without charger",
  ],
  visual_screen_for_sharp_contaminated_or_unknown_contents: [
    "先目视排查尖锐、污染或不明物品",
    "Visually screen for sharp, contaminated, or unknown contents",
  ],
  well_ventilated_area: ["通风良好区域", "Well-ventilated area"],
  method: ["测量方法", "Method"],
  tool: ["工具", "Tool"],
  measured_at: ["测量时间", "Measurement time"],
  observed_at: ["观察时间", "Observation time"],
  measuredAt: ["测量时间", "Measurement time"],
  time: ["时间", "Time"],
  soc: ["电池电量（SOC）", "State of charge (SOC)"],
  temperature: ["温度（注明单位）", "Temperature (include unit)"],
  note_or_photo: [
    "请补充备注或照片作为证据。",
    "Add a note or photo as evidence.",
  ],
  applicable_limit_source: ["适用限值及来源", "Applicable limit and source"],
  battery_temperature: ["电池温度", "Battery temperature"],
  health_method: ["电池健康读取方法", "Battery health reading method"],
  inner_or_outer: ["内侧或外侧", "Inner or outer side"],
  measurement_position: ["实际测量部位", "Actual measurement position"],
  probe: ["测量探头", "Measurement probe"],
  record_source: ["记录来源", "Record source"],
  reference_basis: ["比较参考依据", "Reference basis"],
  soc_percent: ["电池电量（SOC，%）", "State of charge (SOC, %)"],
  software_version: ["读取软件版本", "Reading software version"],
  substrate: ["底材", "Substrate"],
  temperature_unit: ["温度单位", "Temperature unit"],
  test_complete: ["测试完成情况", "Test completion status"],
};
/** 中文：按语言返回已知条件标签；未知键保留原意并将下划线换为空格，显示为所需上下文提示。
 * English: Return localized labels for known requirements; preserve unknown keys with underscores replaced by spaces in a required-context hint. */
export function requirementLabel(key: string, locale: Locale): string {
  return (
    labels[key]?.[locale === "en" ? 1 : 0] ??
    (locale === "en"
      ? `Required context: ${key.replaceAll("_", " ")}`
      : `所需上下文：${key.replaceAll("_", " ")}`)
  );
}
