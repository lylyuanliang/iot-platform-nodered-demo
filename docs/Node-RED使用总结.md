# Node-RED 使用总结

本文是技术分享前的快速复习版。详细语法和案例见 `Node-RED详细说明.md`。

## 1. Node-RED 是什么

Node-RED 是运行在 Node.js 上的可视化流程编排工具。它通过节点和连线处理消息，适合做设备接入、协议转换、规则判断、系统联动和自动化流程。

在当前 demo 中，Node-RED 是物联网平台内部的规则编排组件，不是完整平台本身。

## 2. 当前 demo 中的位置

```text
设备模拟端
  -> HTTP / MQTT 上报
  -> Kafka iot.telemetry.raw
  -> Node-RED 解析、标准化、规则判断
  -> 告警 / 指令 / 规则日志
  -> demo-server 回调落库
  -> Web 页面观察闭环
```

MQTT 路径是：

```text
设备模拟端 MQTT 页面
  -> demo-server 发布 MQTT
  -> EMQX
  -> Node-RED MQTT In
  -> Kafka iot.telemetry.raw
  -> 后续复用 HTTP 上报后的同一套规则链路
```

## 3. 核心概念

| 概念 | 说明 |
| --- | --- |
| Node | 一个处理单元，例如 MQTT In、Kafka Consumer、Function、HTTP Request、Debug |
| Flow | 一组节点连起来形成的处理流程 |
| Tab | Node-RED 画布页，用来分组展示 flow |
| msg | 节点之间传递的消息对象，常用字段是 `msg.payload` |
| Function | 写 JavaScript 处理消息的节点 |
| Link In/Out | 跨 tab 传递消息 |
| Catch | 捕获节点异常 |
| Debug | 显示调试输出，不接 Debug 节点时右侧面板不会自动显示消息 |
| Context | 保存临时状态，例如连续高温计数 |

## 4. 左侧常用节点速查

以下节点对应 Node-RED 左侧面板中当前截图可见的节点。

### 4.1 通用节点

| 节点 | 用途 | 怎么用 | 当前 demo 例子 |
| --- | --- | --- | --- |
| `inject` | 手动或定时产生一条消息 | 拖到画布，配置 payload、topic、定时规则，点击左侧小按钮触发 | 离线巡检可用 inject 每 30 秒触发一次检查 |
| `debug` | 在右侧 Debug 面板打印消息 | 接在想观察的节点后面，输出选 `msg.payload` 或 `complete msg object`，点击 Deploy | 接在 `消费原始遥测消息` 后面查看 Kafka raw 消息 |
| `complete` | 监听某个节点处理完成事件 | 配置要监听的节点，节点完成后输出一条消息 | 可监听 HTTP Request 是否完成，再触发后续统计或审计 |
| `catch` | 捕获节点运行异常 | 配置捕获范围，通常接到统一错误处理 flow | `捕获阈值规则异常` 捕获高温规则 Function 报错 |
| `status` | 监听节点状态变化 | 配置要监听的节点，节点状态变更时输出消息 | 可监听 Kafka/MQTT 节点是否连接、是否 Idle |
| `link in` | 跨 tab 接收消息 | 和 link out 配对使用，作为另一个 tab 的入口 | `原始遥测输入` 接收 Kafka raw flow 发来的消息 |
| `link out` | 跨 tab 发送消息 | 选择一个或多个 link in；可广播给所有连接目标 | `原始遥测转标准化流程` 把 raw 消息送到标准化 tab |
| `link call` | 调用另一个 link-callable 流程并等待返回 | 用于同步调用可复用子流程，类似“调用函数” | 可封装公共校验流程，但当前 demo 暂未使用 |
| `comment` | 给画布加说明文字 | 拖到流程旁边，写解释，不参与消息流 | 可标注“成功分支”“失败分支”“回调平台 API” |

`link out` 的模式常见有：

| 模式 | 含义 |
| --- | --- |
| 发送到所有连接的链接节点 | 广播给所有勾选的 `link in` |
| 发送到第一个连接的链接节点 | 只发给一个目标 |
| 根据消息属性选择链接节点 | 按 `msg` 内容动态选择目标 |

### 4.2 功能节点

| 节点 | 用途 | 怎么用 | 当前 demo 例子 |
| --- | --- | --- | --- |
| `function` | 写 JavaScript 处理消息 | 双击节点，在代码框里读写 `msg.payload`，最后 `return msg` | `解析并标准化遥测数据`、`判断高温阈值大于 80` |
| `switch` | 按条件分流 | 配置判断字段和规则，例如 `msg.payload.temp > 80` | 可把高温、正常、无效数据拆成不同分支 |
| `change` | 修改、设置、删除、移动消息字段 | 不写代码即可设置 `msg.payload.status` 等字段 | 可给消息补默认字段，例如 `sourceType = mqtt` |
| `range` | 数值区间映射 | 把一个数值范围转换成另一个范围 | 可把传感器原始值 0-1023 转成温度范围 |
| `template` | 用模板生成文本或 JSON | 使用 Mustache 模板引用 `msg` 字段 | 可生成告警详情文本：`温度 {{payload.temp}} 超过阈值` |
| `delay` | 延迟或限速消息 | 配置延迟时间、速率限制或随机延迟 | 可模拟设备响应慢，或限制告警发送频率 |
| `trigger` | 收到消息后立即发一条，再过一段时间发另一条 | 配置首次输出和延迟输出 | 可模拟“设备离线 60 秒后触发告警” |
| `exec` | 执行系统命令 | 配置命令和参数，谨慎使用 | 可调用本地脚本做工具型 demo，正式环境要控制权限 |
| `filter` | 过滤重复消息 | 配置比较字段，只让变化的消息通过 | 可过滤相同设备状态，避免重复写入或重复告警 |

### 4.3 网络节点

| 节点 | 用途 | 怎么用 | 当前 demo 例子 |
| --- | --- | --- | --- |
| `mqtt in` | 订阅 MQTT topic | 配置 Broker、topic、QoS，收到消息后输出 `msg.payload` | `订阅 MQTT 设备属性上报` 订阅 `devices/+/property/report` |

常见网络节点还包括 `http request`、`http in`、`tcp in`、`websocket` 等。当前 demo 里还使用了 Kafka 第三方节点：

| 节点 | 来源 | 用途 |
| --- | --- | --- |
| Kafka Consumer | `node-red-contrib-kafkajs` | 消费 `iot.telemetry.raw`、`iot.telemetry.normalized` |
| Kafka Producer | `node-red-contrib-kafkajs` | 发布标准化消息、告警、规则命中、指令 |

## 5. Function 多输出规则

Function 有几个输出口，`return` 数组就按位置对应几个输出口。

```javascript
return [msg, null];      // 只走第 1 个输出口
return [null, msg];      // 只走第 2 个输出口
return [msg1, msg2];     // 两个输出口都走
return null;             // 所有输出口都不走
return [[msg1, msg2], null]; // 第 1 个输出口连续发多条消息
```

当前 `解析并标准化遥测数据` 就是典型多输出：

- 第 1 个输出口：标准化成功，进入保存、发布 Kafka、规则判断。
- 第 2 个输出口：数据无效，进入无效数据保存和发布。

## 6. 当前 Flow Tab

| Tab | 作用 |
| --- | --- |
| `02-Kafka原始遥测消费` | 消费 `iot.telemetry.raw`，转入标准化 |
| `03-数据解析与标准化` | 把原始消息转换为平台标准事件 |
| `04-规则-阈值与无效数据` | 判断高温阈值，生成告警和规则日志 |
| `05-规则-连续异常窗口` | 连续 3 次高温生成连续异常告警 |
| `06-规则-场景联动` | 高温且在线时自动生成 `turnOnAlarm` 指令 |
| `07-规则-定时离线巡检` | 定时检查设备最近上报时间 |
| `09-MQTT接入扩展` | 订阅 MQTT 上报并写入 Kafka raw |
| `10-错误捕获与执行日志` | 统一处理 Node-RED 异常 |

## 7. 测试时怎么观察

1. 打开 `http://127.0.0.1:1880`。
2. 打开右侧 Debug 面板。
3. 需要看消息时，在关键节点后接 `debug` 节点。
4. 输出建议先选 `complete msg object`。
5. 修改节点后点击 `Deploy`。
6. 到 Web 页面触发 HTTP 或 MQTT 上报。
7. 回 Node-RED 看 Debug 输出、节点状态和后续页面数据。

推荐观察顺序：

```text
09-MQTT接入扩展
02-Kafka原始遥测消费
03-数据解析与标准化
04-规则-阈值与无效数据
06-规则-场景联动
10-错误捕获与执行日志
```

## 8. 常见判断

| 现象 | 含义 |
| --- | --- |
| Debug 面板没日志 | 没接 Debug 节点，或消息没经过该 Debug |
| 节点下方显示 `Idle` | 节点插件自己的状态，表示当前空闲 |
| Catch 节点没有输入线 | 正常，Catch 监听运行时异常，不走普通输入线 |
| 多条线从一个节点发出 | 同一输出口的消息会复制给多个后续节点 |
| `return [null, msg]` | 只走第 2 个输出口，第 1 个输出口不会收到消息 |

## 9. msg 生命周期和分支影响

`msg` 是节点之间传递的消息对象。可以把它理解为“一次事件在 flow 中流转时携带的数据包”。

常规使用时，要按这个原则理解：

```text
一个节点收到 msg -> 处理 msg -> 发送给后续节点
```

如果一个节点的同一个输出口连了多个后续节点，Node-RED 会把消息分别送到各个分支。实际开发和调试时应按“每个分支独立处理自己的 msg”来设计，不要依赖某个分支修改 `msg.payload` 后影响另一个兄弟分支。

例如：

```text
原始遥测消息转字符串
  -> 发布原始遥测消息
  -> 补充日志打印
```

如果 `补充日志打印` 里修改了 `msg.payload`，不应该指望这个修改会影响 `发布原始遥测消息` 分支。正确做法是：

1. 每个分支只处理自己需要的数据。
2. 如果多个分支都需要同一个新增字段，应在分叉之前的节点中统一补充。
3. 如果只是调试打印，Debug 节点不要修改 `msg`。
4. 如果确实要复用转换结果，应把转换节点放在分叉之前。

推荐画法：

```text
转换 MQTT 原始遥测
  -> 原始遥测消息转字符串
      -> 发布原始遥测消息
      -> Debug 打印
```

不推荐依赖：

```text
分支 A 修改 msg.payload
分支 B 期望读到分支 A 修改后的值
```

## 10. msg 结构由谁定义

`msg` 的结构不是 Node-RED 全局固定死的。它由“消息源节点”和后续节点共同决定。

可以按三层理解：

| 来源 | 谁定义 | 例子 |
| --- | --- | --- |
| 源头节点 | 输入类节点或第三方节点定义初始 `msg` | MQTT In、Kafka Consumer、HTTP In、Inject |
| 中间节点 | 节点处理后新增、修改或删除字段 | JSON 节点把字符串转对象，Change 节点设置字段 |
| Function 节点 | 开发者通过代码定义输出结构 | `msg.payload = normalized`，或 `return { payload: alarm }` |

Node-RED 约定最常用字段是：

| 字段 | 常见含义 |
| --- | --- |
| `msg.payload` | 主体数据，绝大多数节点都围绕它处理 |
| `msg.topic` | 消息主题、路由标识、MQTT topic、业务分类 |
| `msg.headers` | HTTP 头等元数据 |
| `msg.req` / `msg.res` | HTTP In 场景下的请求和响应对象 |
| `msg.error` | Catch 节点捕获异常时的错误信息 |

不同节点会定义自己的输出结构。例如：

- MQTT In 通常会把 MQTT 消息体放到 `msg.payload`，把 topic 放到 `msg.topic`。
- Kafka Consumer 的结构由第三方 Kafka 节点定义，可能把 Kafka 原始 value 放在 `msg.payload.value` 或更深层字段里。
- Inject 节点的 `msg.payload` 和 `msg.topic` 来自你在节点配置里的设置。
- Function 节点输出什么结构，取决于你代码里 `return` 的对象。

当前 demo 的 Kafka Consumer 输出不直接等于业务 JSON，所以 `解析并标准化遥测数据` 里做了兼容解析：

```javascript
const kafkaValue =
  msg.payload && msg.payload.payload && typeof msg.payload.payload.value !== "undefined"
    ? msg.payload.payload.value
    : (msg.payload && typeof msg.payload.value !== "undefined"
      ? msg.payload.value
      : msg.payload);
```

分享时可以这样说：

```text
msg 是 Node-RED 的消息容器，但容器里有哪些字段，要看上游节点怎么产生、当前节点怎么处理。
```

## 11. 分享时建议讲法

1. Node-RED 用可视化 flow 表达规则和集成链路。
2. 节点是能力扩展点，Kafka 能力来自第三方节点，MQTT 是官方常见能力。
3. Function 节点适合做轻量解析和规则判断。
4. 复杂、稳定、企业级能力应沉淀成自定义节点或平台后端服务。
5. 当前 demo 通过 HTTP 和 MQTT 两种接入方式证明：接入方式不同，进入平台后的规则、告警和指令闭环可以复用。
