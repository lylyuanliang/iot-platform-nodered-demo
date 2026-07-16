import { useEffect, useMemo, useState } from "react";
import { Layout } from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProductsThingModel from "./pages/ProductsThingModel.jsx";
import DeviceState from "./pages/DeviceState.jsx";
import TelemetryLogs from "./pages/TelemetryLogs.jsx";
import RulesNodeRed from "./pages/RulesNodeRed.jsx";
import AlarmsRules from "./pages/AlarmsRules.jsx";
import CommandsAck from "./pages/CommandsAck.jsx";
import BusinessAlarmHandle from "./pages/BusinessAlarmHandle.jsx";
import DeviceSimulator from "./pages/DeviceSimulator.jsx";
import MqttDeviceSimulator from "./pages/MqttDeviceSimulator.jsx";

const routes = {
  "/platform/dashboard": { title: "平台仪表盘", role: "物联网平台端", component: Dashboard },
  "/platform/products": { title: "产品与物模型", role: "物联网平台端", component: ProductsThingModel },
  "/platform/devices": { title: "设备实例与状态", role: "物联网平台端", component: DeviceState },
  "/platform/telemetry": { title: "数据事件与消息日志", role: "物联网平台端", component: TelemetryLogs },
  "/platform/rules": { title: "规则与 Node-RED", role: "物联网平台端", component: RulesNodeRed },
  "/platform/alarms": { title: "告警与规则命中", role: "物联网平台端", component: AlarmsRules },
  "/platform/commands": { title: "设备指令与回执", role: "物联网平台端", component: CommandsAck },
  "/business/alarms": { title: "业务告警处理", role: "业务模拟端", component: BusinessAlarmHandle },
  "/device/simulator": { title: "设备模拟器", role: "设备模拟端", component: DeviceSimulator },
  "/device/mqtt-simulator": { title: "MQTT 上报模拟", role: "设备模拟端", component: MqttDeviceSimulator }
};

const defaultRoute = "/platform/dashboard";
const routeAliases = {
  "/platform": "/platform/dashboard",
  "/device": "/device/simulator",
  "/business": "/business/alarms"
};

function getHashRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  return routes[hash] ? hash : (routeAliases[hash] || defaultRoute);
}

export default function App() {
  const [activeRoute, setActiveRoute] = useState(getHashRoute);

  useEffect(() => {
    if (!window.location.hash || !routes[window.location.hash.replace(/^#/, "")]) {
      window.history.replaceState(null, "", `#${defaultRoute}`);
    }
    const onHashChange = () => setActiveRoute(getHashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const current = routes[activeRoute] || routes[defaultRoute];
  const Page = current.component;
  const routeContext = useMemo(() => ({ route: activeRoute, ...current }), [activeRoute, current]);

  function navigate(route) {
    if (!routes[route]) return;
    window.location.hash = route;
    setActiveRoute(route);
  }

  return <Layout activeRoute={activeRoute} routeContext={routeContext} onNavigate={navigate}><Page /></Layout>;
}
