const navigationGroups = [
  {
    title: "设备模拟端",
    description: "模拟上报、拉取指令、提交回执",
    items: [
      ["/device/simulator", "HTTP 设备模拟器"],
      ["/device/mqtt-simulator", "MQTT 上报模拟"]
    ]
  },
  {
    title: "物联网平台",
    description: "设备、数据、规则、告警和指令中心",
    items: [
      ["/platform/dashboard", "平台仪表盘"],
      ["/platform/products", "产品与物模型"],
      ["/platform/devices", "设备实例与状态"],
      ["/platform/telemetry", "数据事件与消息日志"],
      ["/platform/rules", "规则与 Node-RED"],
      ["/platform/alarms", "告警与规则命中"],
      ["/platform/commands", "设备指令与回执"]
    ]
  },
  {
    title: "业务模拟端",
    description: "确认告警并触发人工处置动作",
    items: [["/business/alarms", "业务告警处理"]]
  }
];

export function Layout({ activeRoute, routeContext, onNavigate, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>Y</span><div>物联感知平台<small>Node-RED Demo</small></div></div>
        <nav aria-label="平台功能导航">
          {navigationGroups.map((group) => (
            <section className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              <div className="nav-group-desc">{group.description}</div>
              {group.items.map(([route, label]) => (
                <button className={route === activeRoute ? "nav-item active" : "nav-item"} key={route} onClick={() => onNavigate(route)}>
                  {label}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer"><i /> 数据服务已连接</div>
      </aside>
      <main className="content">
        <div className="route-context">
          <span>{routeContext.role}</span>
          <strong>{routeContext.title}</strong>
          <code>{routeContext.route}</code>
        </div>
        {children}
      </main>
    </div>
  );
}
