import { useEffect } from "react";
import { AppVersionInfo } from "../components/AppVersionInfo";
import { VehicleCanvas } from "../components/VehicleCanvas";
import { TestConditionsPanel } from "../components/TestConditionsPanel";
import { ControlPanel } from "../components/ControlPanel";
import { SuspensionPanel } from "../components/SuspensionPanel";
import { SimulationControls } from "../components/SimulationControls";
import { SettingsPanels, SettingsTabList } from "../components/SettingsTabs";
import { useSettingsTabs } from "../components/useSettingsTabs";
import type { SettingsTab } from "../components/useSettingsTabs";
import { useSimulationStore } from "../store/simulationStore";
import { decodeSharedConfig, SHARED_CONFIG_QUERY_PARAM } from "../store/urlConfig";

const SETTINGS_TABS: SettingsTab[] = [
  { id: "conditions", label: "試験条件", content: <TestConditionsPanel /> },
  { id: "vehicle", label: "車両", content: <ControlPanel /> },
  { id: "suspension", label: "サスペンション", content: <SuspensionPanel /> },
];

export function Home() {
  const settingsTabs = useSettingsTabs(SETTINGS_TABS.length);

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get(SHARED_CONFIG_QUERY_PARAM);
    if (!encoded) return;

    const shared = decodeSharedConfig(encoded);
    if (!shared) return;

    useSimulationStore.getState().setVehicle(shared.vehicle);
    useSimulationStore.getState().setTestConditions(shared.testConditions);
  }, []);

  return (
    <div className="container py-3 d-flex flex-column gap-3">
      <h1>ShockLab</h1>
      <AppVersionInfo />
      {/* 操作ボタンは、画面の上部に置き、固定の範囲には含めない（issue #583）。 */}
      <div className="d-flex justify-content-center" data-testid="controls-area">
        <SimulationControls />
      </div>
      {/* プレビュー（キャンバス）と、設定のタブ見出しは、画面の上に固定する。設定のパネルだけが
          スクロールする（issue #550）。 */}
      <div className="sticky-top bg-body pb-2 d-flex flex-column gap-2 align-items-center" data-testid="preview-area">
        <VehicleCanvas />
        <SettingsTabList tabs={SETTINGS_TABS} activeIndex={settingsTabs.activeIndex} onSelect={settingsTabs.goTo} />
      </div>
      <SettingsPanels
        tabs={SETTINGS_TABS}
        scrollerRef={settingsTabs.scrollerRef}
        onScroll={settingsTabs.handleScroll}
      />
    </div>
  );
}
