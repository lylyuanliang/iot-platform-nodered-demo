# Node-RED 详细说明

本文面向第一次系统学习 Node-RED 的开发者，也用于当前物联感知平台 demo 的技术分享准备。重点不是泛泛介绍工具，而是解释 Node-RED 的核心概念、使用方式、Function 编写技巧，以及它在物联网平台规则编排中的边界。

## 1. Node-RED 是什么

Node-RED 是一个基于浏览器的流程编排工具。它把“输入、处理、输出、错误处理”抽象成节点和连线，让开发者用可视化方式搭建事件处理流程。

在当前 demo 中，Node-RED 承担的是：

```text
设备数据进入平台后
  -> 解析
  -> 标准化
  -> 规则判断
  -> 告警
  -> 指令
  -> 错误捕获
  -> 执行日志
```

当前 demo 架构图：

![物联感知平台 Node-RED Demo 架构图](assets/demo-architecture.svg)

它不是完整物联网平台，也不替代业务系统。

合理边界：

| 模块 | 职责 |
| --- | --- |
| demo-server | API、MySQL 持久化、业务动作、设备模拟接口 |
| demo-web | 页面展示、人工处理入口、设备模拟操作 |
| Kafka | 平台内部事件流 |
| EMQX/MQTT | 设备接入通道 |
| Node-RED | 可视化规则编排、流程执行、跨系统连接 |

## 1.1 Node-RED 是怎么融合进当前 demo 的

当前 demo 不是“Web 页面直接调用 Node-RED”，而是用 Kafka、HTTP、MQTT 把 Node-RED 放进物联网平台流程里。

整体链路是：

```text
设备模拟器 / MQTT 设备
  -> 平台接入 API 或 EMQX
  -> Kafka iot.telemetry.raw
  -> Node-RED Kafka Consumer
  -> Node-RED Function / Rule Flow
  -> Node-RED Kafka Producer
  -> Node-RED HTTP Request 回调 demo-server
  -> MySQL
  -> Web 页面查询展示
```

也就是说，Node-RED 在这里承担三类工作：

1. 从 Kafka/MQTT/HTTP 等通道接收事件。
2. 在 Function、JSON、Link、Catch 等节点中做解析、标准化、规则判断、指令组装。
3. 把结果写回 Kafka topic，并通过 HTTP Request 调平台 API 保存到 MySQL。

### 1.1.1 Node-RED 为什么能和 Kafka 通信

Node-RED 本体只提供基础节点，并不默认包含 Kafka 节点。当前 demo 能连 Kafka，是因为 `node-red/package.json` 安装了第三方节点：

```json
{
  "dependencies": {
    "node-red": "^5.0.1",
    "node-red-contrib-kafkajs": "^0.0.7"
  }
}
```

`node-red-contrib-kafkajs` 底层使用 KafkaJS，安装后 Node-RED 的节点面板里会出现 KafkaJS 相关节点，例如：

| 节点 | 当前 demo 用途 |
| --- | --- |
| `kafkajs-client` | Kafka broker 连接配置 |
| `kafkajs-consumer` | 消费 Kafka topic |
| `kafkajs-producer` | 写入 Kafka topic |

当前 `flows.json` 里有一个 Kafka 配置节点：

```text
name: Kafka broker
brokers: 127.0.0.1:9092
clientid: nodered-iot-demo
```

所有 Kafka Consumer / Producer 节点都复用这个配置节点。

### 1.1.2 Kafka 消费是怎么发生的

在 `02-Kafka原始遥测消费` tab 中，有一个 KafkaJS Consumer：

```text
Node: 消费原始遥测消息
Topic: iot.telemetry.raw
GroupId: nodered-telemetry-normalizer
Broker: 127.0.0.1:9092
```

当设备模拟器调用：

```text
POST /api/device/report
```

demo-server 会把原始上报写入 Kafka：

```text
iot.telemetry.raw
```

Node-RED 的 Kafka Consumer 正在订阅这个 topic，所以会收到消息，并把 Kafka 消息包装成 Node-RED 的 `msg` 对象继续往后传。

当前 flow 里 Kafka Consumer 后面接的是：

```text
消费原始遥测消息
  -> Link Out: 原始遥测转标准化流程
  -> Link In: 原始遥测输入
  -> Function: 解析并标准化遥测数据
```

这就是 Kafka 进入 Node-RED 规则编排的入口。

### 1.1.3 Kafka 消息进入 Function 后长什么样

KafkaJS Consumer 输出的结构不一定直接就是业务 JSON。当前 demo 的 Function 做了兼容解析：

```javascript
const kafkaValue =
  msg.payload && msg.payload.payload && typeof msg.payload.payload.value !== "undefined"
    ? msg.payload.payload.value
    : (msg.payload && typeof msg.payload.value !== "undefined"
        ? msg.payload.value
        : msg.payload);

const input = Buffer.isBuffer(kafkaValue)
  ? JSON.parse(kafkaValue.toString())
  : (typeof kafkaValue === "string" ? JSON.parse(kafkaValue) : kafkaValue);
```

这段代码的意思是：

1. 先从 Kafka 节点输出里拿 message value。
2. 如果 value 是 Buffer，就转成字符串再 `JSON.parse`。
3. 如果 value 已经是字符串，就直接 `JSON.parse`。
4. 如果 value 已经是对象，就直接使用。

解析后的原始上报大致是：

```json
{
  "eventId": "RAW-xxx",
  "deviceId": "TEMP-SENSOR-001",
  "sourceType": "http",
  "topic": "device-report",
  "payload": {
    "temp": 86.5,
    "hum": 62,
    "online": true
  }
}
```

### 1.1.4 Node-RED 怎么把结果写回 Kafka

规则处理完成后，Node-RED 会用 KafkaJS Producer 写不同 topic。

例如标准化后写：

```text
iot.telemetry.normalized
```

高温告警后写：

```text
iot.alarm.created
iot.rule.matched
```

自动联动指令写：

```text
iot.command.downlink
```

注意：Kafka Producer 通常要求 `msg.payload` 是字符串或 Buffer，所以当前 demo 在每个 Kafka Producer 前都有一个 stringify Function：

```javascript
if (typeof msg.payload !== "string" && !Buffer.isBuffer(msg.payload)) {
  msg.payload = JSON.stringify(msg.payload);
}
return msg;
```

这就是为什么 flow 里会看到很多：

```text
标准化消息转字符串
告警消息转字符串
规则命中消息转字符串
下行指令消息转字符串
```

### 1.1.5 Node-RED 为什么还要 HTTP 回调 demo-server

Kafka 是事件流，不是当前 demo 的主查询库。Web 页面查询的是 demo-server API，demo-server 从 MySQL 查数据。

所以 Node-RED 在写 Kafka 的同时，还会用 HTTP Request 节点调用平台 callback API：

| Node-RED 结果 | HTTP 回调 |
| --- | --- |
| 标准化遥测 | `POST /api/platform/telemetry/normalized` |
| 无效数据 | `POST /api/platform/invalid-data` |
| 告警 | `POST /api/platform/alarms` |
| 规则执行日志 | `POST /api/platform/rule-executions` |
| 自动指令 | `POST /api/platform/commands` |
| 错误日志 | `POST /api/platform/rule-errors` |

这一步的作用是把 Node-RED 的执行结果持久化到 MySQL，方便 Web 页面展示。

所以当前 demo 采用的是：

```text
Kafka 负责事件流转
MySQL 负责状态查询
Node-RED 负责规则执行
demo-server 负责持久化和对外 API
```

### 1.1.6 MQTT 又是怎么融合进来的

MQTT 入口在 `09-MQTT接入扩展` tab：

```text
MQTT In devices/+/property/report
  -> 解析 JSON 消息
  -> 转换 MQTT 原始遥测
  -> KafkaJS Producer iot.telemetry.raw
```

它的关键设计是：MQTT 消息进入 Node-RED 后，不单独走一套规则，而是先转成 raw telemetry，再写入：

```text
iot.telemetry.raw
```

这样后续会复用同一条链路：

```text
iot.telemetry.raw
  -> Kafka raw consumer
  -> 标准化
  -> 阈值规则
  -> 告警
  -> 指令
```

这也是本 demo 想表达的重点：接入通道可以不同，进入平台后的规则编排和闭环处理尽量统一。

### 1.1.7 你在 Node-RED 页面应该怎么操作流程

打开：

```text
http://127.0.0.1:1880
```

建议按这个顺序观察：

1. `09-MQTT接入扩展`：看 MQTT 如何进入 `iot.telemetry.raw`。
2. `02-Kafka原始遥测消费`：看 Node-RED 如何消费 `iot.telemetry.raw`。
3. `03-数据解析与标准化`：双击 `解析并标准化遥测数据` 看 Function 如何解析 Kafka 消息。
4. `04-规则-阈值与无效数据`：双击 `判断高温阈值大于 80` 看高温规则。
5. `06-规则-场景联动`：双击 `高温且在线自动联动` 看如何生成 `turnOnAlarm`。
6. `10-错误捕获与执行日志`：看错误如何写回平台。

如果你要动手试：

1. 先在 Web“设备模拟器”上报高温 `86.5`。
2. 回到 Node-RED 看这些 flow 是否有执行日志。
3. 双击 Function 节点，临时加一行：

```javascript
node.warn(msg.payload);
```

4. 点击右上角 `Deploy`。
5. 再上报一次高温。
6. 看 Node-RED 右侧 Debug 面板和启动终端日志。

调试完成后删除 `node.warn`，再 `Deploy`。

## 1.2 真实 Java 后端环境下会有什么变化

真实项目中后端如果是 Java，Node-RED 的定位不会发生本质变化。变化的是“平台 API 和持久化服务由谁提供”。

当前 demo：

```text
Node-RED
  -> HTTP Request
  -> demo-server(Node.js)
  -> MySQL
```

真实环境：

```text
Node-RED
  -> HTTP Request / Kafka / 其他 MQ
  -> Java 后端服务
  -> 数据库 / 业务系统 / 设备指令服务
```

也就是说，Node-RED 不关心后端是 Java、Node.js、Go 还是 Python。它只关心能否通过节点连接到目标系统。

### 1.2.1 与 MQ 通信本质上依赖“节点”

Node-RED 和 Kafka、RabbitMQ、RocketMQ、MQTT、Redis Stream 等中间件通信，通常都依赖对应的节点。

这里的“节点”是 Node-RED 的概念，不是后端服务的概念。

节点来源通常有三类：

| 节点来源 | 说明 | 示例 |
| --- | --- | --- |
| 官方内置节点 | Node-RED 自带，覆盖通用能力 | HTTP、TCP、UDP、WebSocket、MQTT、Function、JSON、Inject、Catch |
| 第三方社区节点 | npm 包提供，安装后出现在节点面板 | `node-red-contrib-kafkajs`、RabbitMQ 节点、数据库节点 |
| 自定义节点 | 团队自己开发并发布或本地安装 | 私有设备协议、私有网关协议、公司内部 MQ/平台组件 |

当前 demo 的 Kafka 能力来自第三方节点：

```text
node-red-contrib-kafkajs
```

如果真实环境换成 RocketMQ、RabbitMQ 或公司内部 MQ，就需要：

1. 查找是否已有成熟 Node-RED 节点。
2. 如果已有，安装并配置 broker、topic、consumer group。
3. 如果没有，评估用 HTTP/TCP/UDP/Function 临时接入，或开发自定义 Node-RED 节点。

### 1.2.2 Java 后端下常见集成方式

真实项目中可以有几种方式。

#### 方式一：Node-RED 消费 MQ，HTTP 回调 Java

```text
设备数据
  -> MQ
  -> Node-RED Consumer
  -> 规则编排
  -> HTTP Request 调 Java API
  -> Java 落库、发指令、推业务事件
```

这是当前 demo 最接近的方式，只是把 `demo-server(Node.js)` 换成 Java 服务。

优点：

1. Node-RED 规则结果清晰可视化。
2. Java 后端仍然掌握数据库、权限、事务和业务规则。
3. Node-RED 不直接操作核心表，边界比较稳。

#### 方式二：Node-RED 消费 MQ，再写回 MQ，由 Java 消费

```text
设备数据
  -> MQ raw topic
  -> Node-RED
  -> MQ normalized/alarm/command topic
  -> Java Consumer
  -> Java 落库和业务处理
```

这种方式更事件驱动，Java 后端通过消费者处理 Node-RED 的输出。

优点：

1. Node-RED 和 Java 解耦。
2. 规则结果可以被多个系统订阅。
3. 更适合已有事件总线的平台架构。

注意：

1. 需要定义清楚 topic、消息 schema、幂等键、重试和死信。
2. Web 页面最终仍然建议查 Java 后端的数据库或查询 API。

#### 方式三：Java 负责接入和标准化，Node-RED 只做规则

```text
设备数据
  -> Java 接入服务
  -> Java 标准化
  -> MQ normalized topic
  -> Node-RED 规则
  -> Java API / MQ
```

这种方式适合正式平台，因为设备接入、鉴权、物模型校验、协议解析通常更适合放在后端服务里统一治理。

### 1.2.3 自定义协议和设备通信怎么扩展

如果后续有自定义协议或设备通信方式，可以按复杂度选择三种扩展方式。

#### 方式一：用已有通用节点组合

适合协议简单、报文格式清晰的场景。

可用节点：

```text
TCP In / TCP Out
UDP In / UDP Out
HTTP In / HTTP Request
WebSocket In / WebSocket Out
MQTT In / MQTT Out
Function
JSON
```

例如简单 TCP 设备：

```text
TCP In
  -> Function 解析二进制/文本报文
  -> Function 映射物模型
  -> Kafka Producer / HTTP Request
```

#### 方式二：用 Function 节点调用 npm 库

适合已有 npm SDK 或解析库的场景。

可以在 Node-RED 用户目录安装依赖，然后在 Function 节点里引用库，或者在 Function 节点的 setup/libs 中配置外部模块。

这种方式适合 demo 或轻量扩展，但复杂逻辑长期放 Function 里会难维护。

#### 方式三：开发自定义 Node-RED 节点

适合公司内部长期维护的协议、设备网关、专有 MQ 或平台组件。

自定义节点通常是一个 npm 包，包含：

```text
节点运行逻辑 .js
节点编辑器配置 .html
package.json
README
```

安装后，它会像普通节点一样出现在 Node-RED 左侧节点面板中，可以拖拽、配置、连线、导出到 `flows.json`。

例如未来可以做：

```text
yd-iot-device-in
yd-iot-command-out
yd-rocketmq-consumer
yd-thing-model-validator
yd-protocol-parser
```

### 1.2.4 分享时建议这样讲

可以把 Node-RED 扩展能力总结成一句话：

```text
Node-RED 的集成能力来自节点体系。官方节点提供基础协议，社区节点连接常见中间件，企业可以开发自定义节点连接私有协议、设备网关和内部平台能力。
```

再结合当前 demo：

```text
当前 Kafka 通信不是 Node-RED 天然内置，而是通过 node-red-contrib-kafkajs 节点扩展出来的。
真实 Java 后端环境下，Node-RED 仍然通过 Kafka/MQ/HTTP 等节点与 Java 服务集成。
后端语言变化不影响 Node-RED 的编排模型，只影响接口协议、消息 schema 和平台职责边界。
```

## 1.3 自定义节点开发规范建议

如果企业要长期使用 Node-RED 接入私有协议、内部 MQ、设备网关或物模型能力，不建议把所有逻辑长期堆在 Function 节点里。更规范的做法是把稳定能力沉淀成自定义节点。

自定义节点本质上是一个 npm 包。安装到 Node-RED 用户目录后，它会出现在左侧节点面板，使用方式和普通节点一致。

### 1.3.1 什么时候应该开发自定义节点

适合开发自定义节点的场景：

1. 私有设备协议需要长期维护。
2. 报文解析逻辑复杂，Function 节点难以阅读和复用。
3. 需要统一封装公司内部 MQ、设备网关、认证、签名、物模型校验。
4. 需要给实施人员提供可配置 UI，而不是让他们改 JavaScript。
5. 多个 flow 都重复使用同一类协议解析、指令下发、字段映射逻辑。

不建议开发自定义节点的场景：

1. 只是一次性 demo。
2. 逻辑只有几行 Function。
3. 能用 HTTP/MQTT/TCP/UDP/JSON/Change 等已有节点清晰表达。
4. 业务规则变化很频繁，还没有稳定抽象。

### 1.3.2 推荐目录结构

一个企业自定义节点包建议这样组织：

```text
node-red-contrib-yd-iot/
  package.json
  README.md
  nodes/
    yd-device-in.js
    yd-device-in.html
    yd-command-out.js
    yd-command-out.html
    yd-protocol-parser.js
    yd-protocol-parser.html
  test/
    yd-device-in.test.js
    yd-protocol-parser.test.js
  examples/
    device-to-kafka-flow.json
```

文件职责：

| 文件 | 作用 |
| --- | --- |
| `.js` | 节点运行时逻辑，负责收发消息、调用 SDK、处理错误 |
| `.html` | 节点编辑器 UI，定义配置表单、帮助文档、输入校验 |
| `package.json` | 声明 Node-RED 节点入口和 npm 元数据 |
| `README.md` | 写清使用方式、输入输出、配置项和示例 |
| `test/` | 单元测试、节点行为测试 |
| `examples/` | 示例 flow，方便导入验证 |

### 1.3.3 package.json 规范

`package.json` 至少要包含 Node-RED 节点声明：

```json
{
  "name": "node-red-contrib-yd-iot",
  "version": "0.1.0",
  "description": "Node-RED nodes for YD IoT platform integration",
  "keywords": ["node-red", "iot", "ydcloudplus"],
  "node-red": {
    "nodes": {
      "yd-device-in": "nodes/yd-device-in.js",
      "yd-command-out": "nodes/yd-command-out.js",
      "yd-protocol-parser": "nodes/yd-protocol-parser.js"
    }
  }
}
```

命名建议：

| 类型 | 建议 |
| --- | --- |
| 包名 | `node-red-contrib-公司或平台名-能力名` |
| 节点类型 | `yd-device-in`、`yd-command-out`、`yd-protocol-parser` |
| 节点显示名 | 使用中文也可以，但类型名保持英文和稳定 |
| 版本 | 按语义化版本管理，例如 `0.1.0`、`1.0.0` |

### 1.3.4 节点输入输出契约

自定义节点必须明确输入和输出，不要靠口头约定。

建议每个节点文档都写清：

```text
输入 msg.payload 是什么结构
输出 msg.payload 是什么结构
会不会修改 msg.topic / msg.key / msg.headers
错误时是 node.error、第二输出，还是输出 failed payload
是否需要配置节点
是否有重试和超时
```

示例：协议解析节点输出标准物模型事件。

```json
{
  "eventId": "RAW-20260716120000",
  "deviceId": "TEMP-SENSOR-001",
  "productKey": "temperature-sensor",
  "eventType": "property_report",
  "properties": {
    "temperature": 86.5,
    "humidity": 62,
    "online": true
  },
  "sourceType": "tcp",
  "occurredAt": "2026-07-16 12:00:00"
}
```

### 1.3.5 配置节点规范

如果多个节点共用连接配置，应抽成 Config Node。

适合做 Config Node 的内容：

1. MQ broker 地址、认证、consumer group。
2. 设备网关地址、租户、应用 ID。
3. Java 平台 API base URL。
4. 证书、token、签名密钥。
5. 连接池、超时、重试参数。

不要在每个业务节点里重复填写同一套连接信息。

示例：

```text
yd-platform-config
  -> 被 yd-device-in 复用
  -> 被 yd-command-out 复用
  -> 被 yd-thing-model-validator 复用
```

### 1.3.6 凭据和安全规范

敏感信息不要写入 `flows.json` 明文。

需要使用 Node-RED credentials 机制保存：

1. 密码。
2. token。
3. accessKey / secretKey。
4. 证书私钥。
5. MQ 认证信息。

规范要求：

| 项 | 要求 |
| --- | --- |
| 明文密钥 | 禁止写入 Function、flow、README 示例 |
| credentials | 使用 Node-RED credentials 配置 |
| 日志 | 不打印 token、密码、完整签名串 |
| 错误信息 | 可以打印错误码，不打印敏感请求体 |
| 权限 | 节点配置页面只暴露必要字段 |

### 1.3.7 错误处理规范

自定义节点的错误要能被 Catch 节点捕获。

推荐方式：

```javascript
node.error(error, msg);
node.status({ fill: "red", shape: "ring", text: "failed" });
```

如果节点有两个输出，可以约定：

```text
output 1: success
output 2: failed
```

错误 payload 建议统一：

```json
{
  "errorCode": "PROTOCOL_PARSE_FAILED",
  "errorMessage": "temperature field missing",
  "deviceId": "TEMP-SENSOR-001",
  "rawPayload": {}
}
```

### 1.3.8 状态显示规范

节点运行时应使用 `node.status` 给实施人员反馈。

建议：

| 状态 | 显示 |
| --- | --- |
| 连接成功 | 绿色点：`connected` |
| 处理中 | 蓝色点：`processing` |
| 等待重连 | 黄色环：`reconnecting` |
| 失败 | 红色环：`failed` |
| 空闲 | 灰色点：`idle` |

这对现场调试非常重要。

### 1.3.9 消息 schema 和版本规范

自定义节点输出到 Kafka、Java API 或下游 flow 时，必须有稳定 schema。

建议每类消息包含：

```json
{
  "schemaVersion": "1.0",
  "eventId": "xxx",
  "deviceId": "xxx",
  "productKey": "xxx",
  "occurredAt": "2026-07-16 12:00:00",
  "payload": {}
}
```

版本演进建议：

1. 新增字段保持向后兼容。
2. 删除字段或改字段含义必须升级 `schemaVersion`。
3. Java 后端和 Node-RED 节点共同维护消息契约。
4. 关键 topic 建议配套 JSON Schema 或接口文档。

### 1.3.10 测试规范

自定义节点至少要覆盖：

1. 正常输入能输出正确 `msg.payload`。
2. 异常输入能触发错误输出或 `node.error`。
3. 配置缺失时有明确错误。
4. 连接失败时状态显示正确。
5. 不泄露 credentials。
6. 与示例 flow 的基本集成验证。

建议测试层次：

| 测试 | 说明 |
| --- | --- |
| 纯函数单测 | 协议解析、字段映射、签名算法 |
| 节点单测 | 节点收到 msg 后输出是否正确 |
| 集成测试 | 连接测试 broker、HTTP mock、设备模拟器 |
| 示例 flow 验证 | 导入 examples flow 后能跑通 |

### 1.3.11 发布和安装规范

内部节点建议按 npm 包管理。

可选方式：

1. 发布到公司内部 npm registry。
2. 用 Git URL 安装。
3. 本地 `.tgz` 包安装。
4. 随 Node-RED Docker 镜像一起预装。

安装示例：

```powershell
cd node-red
pnpm add node-red-contrib-yd-iot
pnpm exec node-red --userDir .
```

生产环境更推荐自定义 Docker 镜像：

```dockerfile
FROM nodered/node-red:latest
RUN npm install node-red-contrib-yd-iot
```

这样每次部署的节点版本可控。

### 1.3.12 代码评审清单

自定义节点上线前建议检查：

| 检查项 | 要求 |
| --- | --- |
| 命名 | 包名、节点类型、显示名清晰稳定 |
| 输入输出 | README 明确写出 msg 契约 |
| 配置 | 公共连接信息抽成 Config Node |
| 凭据 | 密码、token 使用 credentials |
| 错误 | 能被 Catch 捕获，有错误码 |
| 状态 | 使用 `node.status` 显示连接和处理状态 |
| 超时 | 外部请求必须有 timeout |
| 重试 | 明确是否重试，避免无限重试 |
| 幂等 | 发送指令、写 MQ 要有 eventId / commandId |
| 日志 | 不打印敏感信息 |
| 测试 | 有单测和示例 flow |
| 文档 | 有安装、配置、输入输出、示例 |

### 1.3.13 自定义节点和 Java 后端的边界

不要把 Java 后端核心业务搬进 Node-RED 自定义节点。

建议边界：

| 放在自定义节点 | 放在 Java 后端 |
| --- | --- |
| 协议接入、报文解析 | 主数据、权限、租户 |
| MQ/网关连接封装 | 强事务、审批流 |
| 物模型字段初步映射 | 设备资产管理 |
| 轻量校验和转换 | 告警生命周期权威状态 |
| 指令下发通道封装 | 指令幂等、审计、权限校验 |

一句话原则：

```text
自定义节点封装“连接能力”和“协议能力”，Java 后端掌握“业务权威状态”和“核心事务”。
```

## 2. Node-RED 的核心概念

### 2.1 Node 节点

Node 是 Node-RED 中最小的流程处理单元。

一个节点通常做一件事：

```text
接收 msg
  -> 读取 msg.payload / msg.topic / 其他字段
  -> 处理数据
  -> 输出 msg 给后续节点
```

常见节点：

| 节点 | 作用 | 当前 demo 示例 |
| --- | --- | --- |
| Inject | 手动或定时触发消息 | 离线巡检每 30 秒触发 |
| Debug | 输出调试信息 | 查看 `msg.payload` |
| Function | 写 JavaScript 处理消息 | 标准化、阈值判断、指令组装 |
| Switch | 条件分支 | 温度是否大于 80 |
| Change | 设置、移动、删除字段 | 简单字段调整 |
| JSON | 字符串和 JSON 对象互转 | MQTT payload 解析 |
| HTTP Request | 调外部 HTTP API | 调平台 callback 保存告警 |
| MQTT In | 订阅 MQTT topic | `devices/+/property/report` |
| KafkaJS Consumer | 消费 Kafka topic | `iot.telemetry.raw` |
| KafkaJS Producer | 写 Kafka topic | `iot.alarm.created` |
| Link In/Out | 跨 tab 连接 flow | raw 进入标准化 tab |
| Catch | 捕获节点异常 | 写 `NODE_RED_ERROR` 日志 |

### 2.2 Wire 连线

Wire 表示消息流向。

```text
A 节点 -> B 节点 -> C 节点
```

一个输出可以连多个节点，表示并行发送同一条消息。

例如高温规则命中后：

```text
Function: 生成告警
  -> HTTP Request: 保存告警
  -> KafkaJS Producer: 写 iot.alarm.created
```

注意：并行连线不是事务。一个分支成功，另一个分支失败，不会自动回滚。

### 2.3 Flow

Flow 是一组节点和连线的集合。Node-RED UI 中每个 tab 通常就是一个 flow。

当前 demo 的 flow tab：

| Tab | 作用 |
| --- | --- |
| `02-Kafka原始遥测消费` | 消费 raw telemetry |
| `03-数据解析与标准化` | 解析和标准化 |
| `04-规则-阈值与无效数据` | 高温阈值告警 |
| `05-规则-连续异常窗口` | 连续高温计数 |
| `06-规则-场景联动` | 自动 `turnOnAlarm` |
| `07-规则-定时离线巡检` | 定时检查离线设备 |
| `09-MQTT接入扩展` | MQTT 接入 |
| `10-错误捕获与执行日志` | 错误处理 |

### 2.4 Palette 节点面板

Palette 是左侧节点面板。节点来源包括：

1. Node-RED 内置节点。
2. 第三方 npm 节点。
3. 自定义节点。

当前 demo 使用：

```json
{
  "node-red": "^5.0.1",
  "node-red-contrib-kafkajs": "^0.0.7"
}
```

### 2.5 Config Node 配置节点

Config Node 不直接处理消息，而是被其他节点复用。

例子：

| Config Node | 被哪些节点使用 |
| --- | --- |
| MQTT Broker | MQTT In / MQTT Out |
| KafkaJS Client | KafkaJS Consumer / Producer |

当前 demo：

```text
Local EMQX MQTT broker -> 127.0.0.1:1883
Kafka broker -> 127.0.0.1:9092
```

### 2.6 Message 和 msg

Node-RED 中传递的消息是 JavaScript 对象，通常叫 `msg`。

典型结构：

```json
{
  "_msgid": "abc",
  "topic": "iot.telemetry.raw",
  "payload": {
    "deviceId": "TEMP-SENSOR-001",
    "temp": 86.5
  }
}
```

常用字段：

| 字段 | 含义 |
| --- | --- |
| `msg.payload` | 主数据 |
| `msg.topic` | 主题、路由、topic |
| `msg.headers` | HTTP 或 Kafka header |
| `msg.req` | HTTP In 请求对象 |
| `msg.res` | HTTP In 响应对象 |
| `msg.key` | Kafka message key |
| `msg.error` | Catch 捕获的错误信息 |

约定：

1. 主业务对象放 `msg.payload`。
2. Kafka topic 可放在 producer 配置里，也可放在 `msg.topic`。
3. 不要随意覆盖 `msg.req` / `msg.res`。
4. Function 返回的仍然是 `msg`，或者 `null`。

### 2.7 Deploy

Deploy 是把编辑器里的 flow 发布到运行时。

常见模式：

| 模式 | 含义 |
| --- | --- |
| Full Deploy | 重启所有 flow |
| Modified Flows | 只部署修改过的 flow |
| Modified Nodes | 只部署修改过的节点 |

初学时建议使用默认 Deploy，排查复杂问题时优先 Full Deploy。

### 2.8 Context 上下文

Context 是 Node-RED 的临时状态存储。

作用域：

| 作用域 | API | 可见范围 |
| --- | --- | --- |
| 节点级 | `context.get/set` | 当前节点 |
| Flow 级 | `flow.get/set` | 当前 tab |
| Global 级 | `global.get/set` | 全局 |

当前 demo 示例：

```javascript
const key = `highTempCount:${deviceId}`;
const previous = flow.get(key) || 0;
const count = temperature > 80 ? previous + 1 : 0;
flow.set(key, count);
```

适合放 context 的数据：

1. 短窗口计数。
2. 临时缓存。
3. 最近一次状态。
4. 去抖、节流、频率控制。

不适合放 context 的数据：

1. 关键业务数据。
2. 审计日志。
3. 必须长期保存的状态。
4. 需要强一致性的事务数据。

当前 demo 的 `settings.js`：

```javascript
module.exports = {
  flowFile: "flows.json",
  contextStorage: {
    default: { module: "memory" },
    file: { module: "localfilesystem" }
  }
};
```

## 3. Node-RED 如何启动和使用

### 3.1 项目内启动

```powershell
cd "D:\file_save\workspace\工作内容\ydcloudplus平台\物联感知\iot-platform-nodered-demo\node-red"
pnpm exec node-red --userDir .
```

访问：

```text
http://127.0.0.1:1880
```

`--userDir .` 的含义是把当前目录作为 Node-RED 用户目录。Node-RED 会读取：

```text
flows.json
settings.js
package.json
```

### 3.2 Docker 启动

note_cloud 中已记录 Node-RED compose 样例：

```powershell
D:\file_save\workspace\note_cloud\笔记\学习记录\docker\1.docker-compose文件样例\compose\node-red\docker-compose.yml
```

启动：

```powershell
docker compose up -d
```

说明：当前 demo 实测使用项目内 pnpm 启动，因为它直接加载本目录的 `flows.json` 和 KafkaJS 节点依赖。Docker 方式适合后续做独立运行环境。

### 3.3 导入 flow

在 Node-RED 页面：

1. 右上角菜单。
2. `Import`。
3. 选择 `node-red/flows.json`。
4. 导入到当前 flow 或新 flow。
5. 点击 `Deploy`。

### 3.4 导出 flow

右上角菜单：

```text
Export -> Current Flow / All Flows
```

建议导出到：

```text
node-red/flows.json
```

注意不要把敏感 credentials 明文提交。

## 4. Function 节点基础

Function 节点允许写 JavaScript。

最小示例：

```javascript
msg.payload = {
  ok: true,
  receivedAt: new Date().toISOString()
};

return msg;
```

### 4.1 返回值

返回一个消息：

```javascript
return msg;
```

丢弃消息：

```javascript
return null;
```

两个输出：

```javascript
if (msg.payload.temperature > 80) {
  return [msg, null];
}

return [null, msg];
```

多个输出：

```javascript
return [alarmMsg, logMsg, commandMsg];
```

某个输出发多条：

```javascript
return [[msg1, msg2, msg3], null];
```

### 4.2 修改 payload

```javascript
const input = msg.payload;

msg.payload = {
  deviceId: input.deviceId,
  temperature: input.payload.temp,
  humidity: input.payload.hum
};

return msg;
```

### 4.3 保留 msg 其他字段

推荐直接修改原 `msg`：

```javascript
msg.payload = buildPayload(msg.payload);
return msg;
```

不要无脑创建新对象：

```javascript
// 不推荐，可能丢失 msg.topic、msg.req、msg.res、msg.headers
return {
  payload: {}
};
```

如果确实要创建新对象，明确保留需要的字段：

```javascript
return {
  ...msg,
  payload: newPayload
};
```

### 4.4 node.warn

用于调试：

```javascript
node.warn(`deviceId=${msg.payload.deviceId}`);
return msg;
```

日志会出现在 Node-RED debug 面板和运行日志中。

### 4.5 node.error

用于主动抛出错误，并让 Catch 捕获：

```javascript
if (!msg.payload.deviceId) {
  node.error("deviceId is required", msg);
  return null;
}

return msg;
```

### 4.6 node.status

用于在节点下显示状态：

```javascript
node.status({ fill: "green", shape: "dot", text: "ok" });
return msg;
```

常见颜色：

```text
green  正常
yellow 等待或处理中
red    错误
blue   发送中或读取中
grey   空闲
```

### 4.7 多输出 Function 示例

Function 节点可以配置多个输出口。多个输出口不是 Node-RED 自动判断“成功/失败”，而是由 Function 代码的 `return` 结果决定。

规则可以记成一句话：

```text
return 数组第几个位置有 msg，就从第几个输出口发出；数组位置是 null，该输出口不发消息。
```

例如 Function 配了 2 个输出口：

```javascript
return [successMsg, errorMsg];
```

对应关系是：

```text
successMsg -> 第 1 个输出口
errorMsg   -> 第 2 个输出口
```

只走成功分支：

```javascript
return [msg, null];
```

只走失败分支：

```javascript
return [null, msg];
```

两个分支都走：

```javascript
return [msg1, msg2];
```

两个分支都不走：

```javascript
return null;
```

一个输出口连续发多条消息：

```javascript
return [[msg1, msg2, msg3], null];
```

标准化节点常用多输出：

```javascript
const raw = msg.payload;
const report = raw.payload;

if (!raw.deviceId || !report || typeof report.temp !== "number") {
  return [
    null,
    {
      payload: {
        rawEventId: raw.eventId,
        deviceId: raw.deviceId,
        errorMessage: "temperature is required"
      }
    }
  ];
}

const normalized = {
  eventId: `NORM-${raw.eventId}`,
  rawEventId: raw.eventId,
  deviceId: raw.deviceId,
  productKey: "temperature-sensor",
  eventType: "property_report",
  properties: {
    temperature: report.temp,
    humidity: report.hum,
    online: report.online !== false
  },
  occurredAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  sourceType: "kafka",
  status: report.online === false ? "offline" : "online"
};

return [{ payload: normalized }, null];
```

上面这段代码中，判断成功/失败的是 Function 代码本身：

```javascript
if (!raw.deviceId || !report || typeof report.temp !== "number") {
  return [null, invalidMsg];
}

return [normalizedMsg, null];
```

所以在当前 demo 的 `解析并标准化遥测数据` 节点中：

| 输出口 | 含义 | 后续链路 |
| --- | --- | --- |
| 第 1 个输出口 | 标准化成功 | 保存标准化遥测、发布标准化消息、进入规则判断 |
| 第 2 个输出口 | 数据无效或解析失败 | 保存无效数据、发布无效数据消息 |

如果走第 2 个输出口，成功分支不会收到消息。

## 5. Function 编写技巧

### 5.1 先判断输入结构

不要直接深层读取：

```javascript
const temperature = msg.payload.properties.temperature;
```

更稳妥：

```javascript
const payload = msg.payload || {};
const properties = payload.properties || {};
const temperature = properties.temperature;
```

### 5.2 类型校验

```javascript
if (typeof temperature !== "number") {
  node.error("temperature must be a number", msg);
  return null;
}
```

### 5.3 范围校验

```javascript
if (temperature < -40 || temperature > 125) {
  return [null, {
    payload: {
      rawEventId,
      deviceId,
      errorMessage: "temperature must be between -40 and 125"
    }
  }];
}
```

### 5.4 生成稳定 ID

demo 可用：

```javascript
const id = `ALARM-${Date.now()}`;
```

更利于排查：

```javascript
const id = `ALARM-HIGH-TEMP-${event.rawEventId}-${Date.now()}`;
```

正式系统建议由服务端生成 ID，或使用统一 ID 服务。

### 5.5 时间格式

当前 MySQL 使用 `datetime`，Function 中用：

```javascript
const now = new Date().toISOString().slice(0, 19).replace("T", " ");
```

输出：

```text
2026-07-16 10:30:00
```

### 5.6 JSON 字符串处理

输入可能是对象，也可能是字符串：

```javascript
let payload = msg.payload;

if (Buffer.isBuffer(payload)) {
  payload = JSON.parse(payload.toString());
} else if (typeof payload === "string") {
  payload = JSON.parse(payload);
}
```

当前 KafkaJS Consumer 输出的消息值在：

```javascript
msg.payload.value
```

兼容写法：

```javascript
const kafkaValue =
  msg.payload && msg.payload.payload && typeof msg.payload.payload.value !== "undefined"
    ? msg.payload.payload.value
    : (msg.payload && typeof msg.payload.value !== "undefined"
        ? msg.payload.value
        : msg.payload);

const input = Buffer.isBuffer(kafkaValue)
  ? JSON.parse(kafkaValue.toString())
  : (typeof kafkaValue === "string" ? JSON.parse(kafkaValue) : kafkaValue);
```

### 5.7 KafkaJS Producer 需要字符串或 Buffer

`node-red-contrib-kafkajs` 的 producer 最终调用 KafkaJS。KafkaJS message value 需要是 string、Buffer 或 ArrayBuffer。

因此对象写 Kafka 前要 stringify：

```javascript
if (typeof msg.payload !== "string" && !Buffer.isBuffer(msg.payload)) {
  msg.payload = JSON.stringify(msg.payload);
}

return msg;
```

当前 demo 在每个 KafkaJS Producer 前都加了 stringify Function。

### 5.8 不要让 Function 过大

Function 节点适合：

1. 数据转换。
2. 简单规则。
3. 消息组装。
4. 小窗口状态。

不适合：

1. 大量业务分支。
2. 多表事务。
3. 复杂权限判断。
4. 长时间阻塞。

复杂逻辑应下沉到平台服务，Node-RED 调 HTTP API。

## 6. 常用节点实战

### 6.1 Inject

用途：

1. 手动触发测试。
2. 定时任务。
3. 初始化消息。

离线巡检示例：

```text
Inject every 30 seconds
  -> HTTP GET /api/devices
  -> Function 判断 last_report_at
```

### 6.2 Debug

建议调试时设置输出：

```text
complete msg object
```

这样能看到：

```text
msg.topic
msg.payload
msg.headers
msg.error
```

### 6.3 JSON

JSON 节点用于：

1. 字符串转对象。
2. 对象转字符串。

MQTT payload 通常需要 JSON parse。

### 6.4 Switch

适合简单条件：

```text
msg.payload.properties.temperature > 80
msg.payload.properties.online == true
```

复杂条件建议写 Function。

### 6.5 Change

适合简单字段设置：

```text
set msg.topic to iot.telemetry.raw
move msg.payload.temp to msg.payload.temperature
delete msg.payload.debug
```

### 6.6 HTTP Request

用于调用平台 API。

当前 demo 使用：

```text
POST /api/platform/telemetry/normalized
POST /api/platform/invalid-data
POST /api/platform/rule-executions
POST /api/platform/alarms
POST /api/platform/commands
POST /api/platform/rule-errors
```

注意：

1. `msg.payload` 会作为请求体。
2. 通常设置 method 为 `POST`。
3. URL 指向 `http://127.0.0.1:3000/...`。
4. 如果 server 端口变了，需要同步改节点。

### 6.7 MQTT In

当前 demo：

```text
Broker: 127.0.0.1:1883
Topic: devices/+/property/report
QoS: 1
```

topic 通配符：

| 通配符 | 含义 |
| --- | --- |
| `+` | 匹配一层 |
| `#` | 匹配多层 |

示例：

```text
devices/TEMP-SENSOR-001/property/report
devices/CNC-001/property/report
```

都能被：

```text
devices/+/property/report
```

订阅到。

### 6.8 KafkaJS Consumer

当前 demo 消费：

```text
iot.telemetry.raw
iot.telemetry.normalized
```

重点字段：

```javascript
msg.payload.value
msg.payload.key
msg.payload.headers
msg.payload.offset
```

如果 value 是 JSON 字符串，需要：

```javascript
const event = JSON.parse(msg.payload.value);
```

### 6.9 KafkaJS Producer

当前 demo 写入：

```text
iot.telemetry.raw
iot.telemetry.normalized
iot.invalid.data
iot.rule.matched
iot.alarm.created
iot.command.downlink
```

写入前建议：

```javascript
msg.key = msg.payload.deviceId || msg.payload.commandId || null;
msg.payload = JSON.stringify(msg.payload);
return msg;
```

### 6.10 Link In / Link Out

Link 节点用于跨 tab 连接。

当前 demo：

```text
02-Kafka原始遥测消费
  -> Link Out
  -> 03-数据解析与标准化 Link In
```

优点：

1. flow tab 更清晰。
2. 可以把大流程拆开。
3. 避免跨 tab 拉很长的线。

风险：

1. 太多 link 会让链路难追踪。
2. 命名必须清晰。
3. 技术分享时要说明 link 连接到了哪里。

### 6.11 Catch

Catch 捕获同 tab 内指定节点的异常。

重要注意：

1. Catch 默认不是全局跨 tab 捕获。
2. 如果 Catch 放在单独 tab，不能自动捕获其他 tab。
3. 应在关键 tab 内放 Catch，或设置明确 scope。

当前 demo 的做法：

```text
各业务 tab 内 Catch
  -> Link Out
  -> 10-错误捕获与执行日志
  -> 格式化 Node-RED 错误
  -> POST /api/platform/rule-errors
```

## 7. 当前 demo 的关键流程解释

### 7.1 MQTT 到标准化

```text
EMQX
  -> MQTT In devices/+/property/report
  -> 解析 JSON 消息
  -> 转换 MQTT 原始遥测
  -> Stringify
  -> KafkaJS Producer iot.telemetry.raw
  -> KafkaJS Consumer iot.telemetry.raw
  -> 解析并标准化遥测数据
```

关键点：

1. MQTT 与 HTTP、Kafka 是同级接入/输出组件。
2. MQTT 入口不直接写数据库。
3. MQTT 先写 `iot.telemetry.raw`。
4. 标准化统一由 raw consumer 后的 flow 完成。

### 7.2 标准化

输入 raw：

```json
{
  "eventId": "MQTT-STRICT-20260716103647",
  "deviceId": "TEMP-SENSOR-001",
  "sourceType": "mqtt",
  "topic": "devices/TEMP-SENSOR-001/property/report",
  "payload": {
    "temp": 86.5,
    "hum": 62,
    "online": true
  }
}
```

输出 normalized：

```json
{
  "eventId": "NORM-MQTT-STRICT-20260716103647",
  "rawEventId": "MQTT-STRICT-20260716103647",
  "deviceId": "TEMP-SENSOR-001",
  "productKey": "temperature-sensor",
  "eventType": "property_report",
  "properties": {
    "temperature": 86.5,
    "humidity": 62,
    "online": true
  },
  "sourceType": "kafka",
  "status": "online"
}
```

### 7.3 阈值规则

条件：

```javascript
event.properties.temperature > 80
```

输出：

1. `HIGH_TEMPERATURE` 告警。
2. `HIGH_TEMP_AUTO_ALARM` 规则执行日志。
3. Kafka `iot.alarm.created`。
4. Kafka `iot.rule.matched`。

### 7.4 场景联动

条件：

```javascript
temperature > 80 && online === true
```

动作：

```text
生成 turnOnAlarm 指令
目标设备 ALARM-LIGHT-001
写 command_record
写 iot.command.downlink
```

### 7.5 连续异常窗口

核心：

```javascript
const key = `highTempCount:${deviceId}`;
const previous = flow.get(key) || 0;
const count = temperature > 80 ? previous + 1 : 0;
flow.set(key, count);
```

当 `count === 3`：

```text
CONTINUOUS_HIGH_TEMPERATURE
```

### 7.6 定时离线巡检

```text
Inject every 30 seconds
  -> 查询设备列表
  -> 判断超过 60 秒未上报
  -> DEVICE_OFFLINE
```

当前 demo 未做离线告警去重，长时间运行会重复产生离线告警。正式平台应做“同设备同类型未关闭告警去重”。

## 8. 错误处理设计

### 8.1 为什么要 Catch

没有 Catch 时，Function 报错可能只出现在 Node-RED 日志里，平台无法查询。

当前 demo 希望做到：

```text
节点异常
  -> Catch
  -> 格式化 Node-RED 错误
  -> POST /api/platform/rule-errors
  -> rule_execution_log
```

### 8.2 Catch 的 scope

Catch 必须放对位置。

错误示例：

```text
把 Catch 放在 10-错误捕获 tab
希望捕获其他所有 tab
```

这通常不成立。

正确做法：

```text
在 03 tab 放 Catch，scope 到 normalize function
在 04 tab 放 Catch，scope 到 threshold function
在 09 tab 放 Catch，scope 到 MQTT parse/format function
再用 Link Out 汇总到 10 tab
```

### 8.3 主动抛错

```javascript
try {
  msg.payload = JSON.parse(msg.payload);
  return msg;
} catch (error) {
  node.error(`JSON parse failed: ${error.message}`, msg);
  return null;
}
```

## 9. 编排设计原则

### 9.1 单一职责

一个节点只做一类事情：

```text
解析
标准化
判断
组装告警
写 API
写 Kafka
```

不要把所有逻辑塞进一个 Function。

### 9.2 明确输入输出

每个 Function 前后都应该能说清：

```text
输入 msg.payload 是什么结构
输出 msg.payload 是什么结构
失败时走哪里
```

### 9.3 规则和动作分开

建议：

```text
规则判断节点
  -> 告警节点
  -> 指令节点
```

不要在规则判断里顺手完成所有副作用。

### 9.4 平台状态由后端持久化

Node-RED 可以做判断，但最终状态应写回平台：

```text
telemetry_event
alarm_record
rule_execution_log
command_record
```

### 9.5 高风险动作保留人工确认

当前 demo 区分：

| 动作 | 触发方式 |
| --- | --- |
| `turnOnAlarm` | 规则自动触发 |
| `stopMachine` | 业务人工处理 |
| `playVoice` | 业务人工处理 |

分享时可以强调：

```text
低风险、确定性动作可以自动化。
高风险动作应由业务系统确认后下发。
```

## 10. Function 常见坑

### 10.1 忘记 return msg

错误：

```javascript
msg.payload.ok = true;
```

正确：

```javascript
msg.payload.ok = true;
return msg;
```

### 10.2 多输出返回结构错

错误：

```javascript
return msg1, msg2;
```

正确：

```javascript
return [msg1, msg2];
```

### 10.3 输出对象被后续节点修改

如果同一个 `msg` 发给多个分支，后续节点可能修改同一个对象。

稳妥做法：

```javascript
const alarmMsg = {
  ...msg,
  payload: alarm
};

const logMsg = {
  ...msg,
  payload: execution
};

return [alarmMsg, logMsg];
```

### 10.4 Kafka Producer 写对象

错误：

```javascript
msg.payload = { eventId: "1" };
return msg;
```

KafkaJS Producer 可能报：

```text
The "string" argument must be of type string or an instance of Buffer
```

正确：

```javascript
msg.payload = JSON.stringify(msg.payload);
return msg;
```

### 10.5 Catch 放错 tab

Catch 不是天然全局异常处理器。跨 tab 需要每个 tab 自己 Catch，再 Link 到统一处理 tab。

### 10.6 Context 当数据库用

错误：

```javascript
flow.set("allAlarms", alarms);
```

正确：

```text
Node-RED 做判断
平台 API 写 MySQL
```

## 11. 调试流程建议

### 11.1 从最短链路开始

```text
Inject -> Debug
```

然后逐步变成：

```text
Inject -> Function -> Debug
Inject -> Function -> HTTP Request
Kafka Consumer -> Debug
MQTT In -> JSON -> Debug
```

### 11.2 每个关键节点后接 Debug

调试阶段可以临时加 Debug。

稳定后再删除或禁用，避免日志太多。

Debug 面板本身不会自动显示所有节点经过的消息。要在右侧 Debug 面板看到内容，至少需要满足其中一种情况：

1. 当前链路中接了 `debug` 节点。
2. Function 节点中调用了 `node.warn()`、`node.log()` 等日志 API。
3. 某些节点运行异常并被 Catch 或运行日志捕获。

当前 demo 做现场观察时，可以按这个方法操作：

1. 打开 `http://127.0.0.1:1880`。
2. 打开右侧 `Debug` 面板，显示范围选择 `all nodes`。
3. 清空历史 Debug 日志。
4. 在 Web 设备模拟端触发普通温度或高温上报。
5. 回到 Node-RED，按 `02-Kafka原始遥测消费` -> `03-数据解析与标准化` -> `04-规则-阈值与无效数据` -> `06-规则-场景联动` 的顺序观察。
6. 如果需要看消息内容，在目标 Function 或 HTTP Request 后临时接 Debug 节点，输出选择 `complete msg object`，然后点击 `Deploy`。

建议重点观察：

| 观察点 | 说明 |
| --- | --- |
| Kafka Consumer 节点状态 | 判断 Node-RED 是否已经连上 Kafka 并加入消费组 |
| Function 节点输入输出 | 判断规则条件是否命中 |
| HTTP Request 节点 | 判断 Node-RED 是否成功回调 demo-server 写 MySQL |
| Kafka Producer 节点 | 判断 Node-RED 是否把规则结果重新写入 topic |
| Catch / 错误处理 tab | 判断 Function、HTTP、Kafka、MQTT 节点是否有运行异常 |

### 11.3 用唯一 eventId 排查

例如：

```text
MQTT-STRICT-20260716103647
```

沿链路查：

```text
Kafka raw
telemetry_event.raw_event_id
alarm_record.source_event_id
rule_execution_log.event_id
command_record.command_id
```

### 11.4 查 Kafka Consumer Group

```powershell
docker exec kafka-kraft /opt/kafka/bin/kafka-consumer-groups.sh `
  --bootstrap-server localhost:9092 `
  --describe `
  --group nodered-telemetry-normalizer
```

看：

```text
CURRENT-OFFSET
LOG-END-OFFSET
LAG
```

### 11.5 查 Node-RED 日志

启动 Node-RED 的终端会输出：

```text
Connected to broker
Consumer has joined the group
Function error
HTTP request error
```

## 12. 当前 demo 的 Node-RED 交付物

目录：

```text
node-red/
  flows.json
  package.json
  settings.js
  README.md
```

`package.json`：

```json
{
  "name": "iot-platform-node-red-flows",
  "private": true,
  "dependencies": {
    "node-red": "^5.0.1",
    "node-red-contrib-kafkajs": "^0.0.7"
  }
}
```

`settings.js`：

```javascript
module.exports = {
  flowFile: "flows.json",
  contextStorage: {
    default: { module: "memory" },
    file: { module: "localfilesystem" }
  }
};
```

## 13. 技术分享讲法

建议按照这个顺序讲：

1. 物联网平台为什么需要规则编排。
2. Node-RED 是什么。
3. Node-RED 不是完整平台，只是规则编排/集成执行层。
4. 设备数据如何进入平台：HTTP、MQTT、Kafka 同级定位。
5. 物模型如何影响标准化：属性、事件、服务。
6. `flows.json` 的 tab 划分。
7. MQTT 上报如何进入 `iot.telemetry.raw`。
8. Kafka raw consumer 如何进入标准化。
9. 阈值规则如何生成告警。
10. 场景联动如何生成 `turnOnAlarm`。
11. 业务人工动作为什么放在业务系统。
12. Catch 如何把异常写回平台。
13. Node-RED 适合什么、不适合什么。

## 14. 学习路线

建议按这个顺序练：

1. Inject + Debug。
2. Function 修改 `msg.payload`。
3. 多输出 Function。
4. HTTP Request 调平台 API。
5. MQTT In 订阅 EMQX。
6. KafkaJS Producer 写 topic。
7. KafkaJS Consumer 消费 topic。
8. Link 节点跨 tab 连接。
9. Catch 节点捕获错误。
10. Context 做连续计数。
11. 把完整闭环串起来。

## 15. 结论

Node-RED 的价值不是“少写代码”，而是让事件流、规则条件、动作编排、系统集成变得可视化、可解释、可演示。

在当前物联感知平台 demo 中，它最适合承担：

```text
设备数据进入后的规则编排与流程执行
```

不适合承担：

```text
设备主数据管理、权限、强事务、复杂业务审批
```

这个边界讲清楚，技术分享就会比较稳。
