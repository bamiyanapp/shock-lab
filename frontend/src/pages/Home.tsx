import { useEffect } from "react";
import { AppVersionInfo } from "../components/AppVersionInfo";
import { VehicleCanvas } from "../components/VehicleCanvas";
import { TestConditionsPanel } from "../components/TestConditionsPanel";
import { ControlPanel } from "../components/ControlPanel";
import { GraphPanel } from "../components/GraphPanel";
import { SimulationControls } from "../components/SimulationControls";
import { SettingsPanels, SettingsTabList } from "../components/SettingsTabs";
import { useSettingsTabs } from "../components/useSettingsTabs";
import type { SettingsTab } from "../components/useSettingsTabs";
import { ResultScreen } from "../components/ResultScreen";
import { useSimulationStore } from "../store/simulationStore";
import { decodeSharedConfig, SHARED_CONFIG_QUERY_PARAM } from "../store/urlConfig";

const SETTINGS_TABS: SettingsTab[] = [
  { id: "conditions", label: "試験条件", content: <TestConditionsPanel /> },
  { id: "vehicle", label: "車両パラメータ", content: <ControlPanel /> },
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
      {/* プレビュー（キャンバスと操作）と、設定のタブ見出しは、画面の上に固定する。設定のパネルだけが
          スクロールする（issue #550）。 */}
      <div className="sticky-top bg-body pb-2 d-flex flex-column gap-2 align-items-center" data-testid="preview-area">
        <VehicleCanvas />
        <SimulationControls />
        <SettingsTabList tabs={SETTINGS_TABS} activeIndex={settingsTabs.activeIndex} onSelect={settingsTabs.goTo} />
      </div>
      <ResultScreen />
      <SettingsPanels
        tabs={SETTINGS_TABS}
        scrollerRef={settingsTabs.scrollerRef}
        onScroll={settingsTabs.handleScroll}
      />
      {/* メトリクスは、走行後だけ表示する。flexの横並びの中に置き、GraphPanelの幅の指定を保つ。 */}
      <div className="d-flex">
        <GraphPanel />
      </div>
    </div>
  );
}
