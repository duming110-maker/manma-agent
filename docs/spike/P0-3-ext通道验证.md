# P0-3 spike：`connection.rpc.handle('/ext')` 通道验证（D3' 可行性）

- 版本：v1（2026-08-18，P0-3 产出）
- 上游事实来源：`reference/upstream`（git SHA `99f6f02f`，npm `0.1.0-rc.7`）。文中路径均相对 `reference/upstream/`，行号以该 SHA 为准。
- 结论先行：**D3' GO**。`connection.rpc.handle` 存在、签名与架构假设一致，`/ext` 通道逐项继承了官方信任栅栏且与 `/api` 并存无干扰；03-architecture D3 的退路 ③（`webServer.register` 自复刻栅栏）**无需准备代码**，降级为文档性 contingency。

## 1. `connection.rpc.handle` 的实际签名与信封

### 1.1 服务入口与签名（代码出处）

- 服务由 `@deepseek-ai/dsh-client-connection` 的 Host 半提供：`HostConnectionService extends Service`，`super(ctx, 'connection')`（`packages/client/connection/src/rpc-host.ts` L43–53）；该插件行已在 web-app bundle roster（`packages/bundle/web-app/cordis.patch.yml` L156–157，`id: connection`）。
- 文档化签名（`packages/client/connection/src/rpc.ts` L25–37）：

```ts
handle(channel: string, handler: ConnectionRpcHandler, options: ConnectionRpcHandlerOptions): () => Promise<void>
// ConnectionRpcHandler = (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult<unknown>>
// ConnectionRpcHandlerOptions = { authority: 'trusted-host' | 'loopback' }   // rpc.ts L6–12
```

- 消费方式：官方 api-gateway 的同款用法是 `ctx.inject(['connection'], ctx2 => ctx2.connection.rpc.…)`（`packages/api/gateway/src/index.ts` L104–111）。bc 侧等价写法：对象插件 `export const inject = ['connection']` + `apply(ctx)`。
- 注册即返回异步 disposer；内部把 `webServer.register` 的路由挂在调用方 fiber 上（`owner.effect(...)`，rpc-host.ts L111–114）——插件卸载即撤路由，bc 侧再包一层 `ctx.effect` 符合注册表约定。
- 通道名约束：`/^\/[A-Za-z0-9._~-]+$/` 且**不得为 `/api`**（保留给共享通道；`assertChannel` rpc-host.ts L220–224）。`intercept('/api', …)` 每通道仅一个拦截器、二次注册抛错（rpc-host.ts L132–135）——D3 备选 ②「座位已被 Typert 网关占用」的实证。

### 1.2 线上信封（与 /api 同一 schema）

- 请求：`POST /ext/<endpoint>`，body `{"type":"client-request","rpcId":"...","method":"<endpoint>","payload":{...}}`；**body 的 `method` 必须与 URL endpoint 逐字相等**（rpc-host.ts L172–178），否则业务错误分支 `bad-request`。endpoint 取通道前缀后的段（`/` 分段，禁 `.`/`..`/空段，rpc-host.ts L200–209）。
- 解码顺序（rpc-host.ts L144–188）：非 POST 或 endpoint 不存在 → `404 not found`；`Content-Type` 非 `application/json` → `415 content type must be application/json`；body 非 JSON → `400 body is not JSON`；信封不合 `clientRequestSchema`（`packages/host/apiproxy/src/api/rpc.schema.ts` L98–103）→ HTTP 200 + `bad-request` 业务错误（rpcId 回退 `invalid-request`）。
- 响应：`{"type":"server-response","rpcId":"<回显>","result":{"ok":true,"value":<handler 返回>} }`；业务错误走 `result.ok=false` + `error.code`（闭集 `RpcErrorDetailsMap`）。handler 抛异常 → `500 handler failure: ...`。
- 请求体上限：`bridge()` 默认 `maxRequestBodyBytes` 160 MiB（`http-bridge.ts` L12、L32），/ext 与 /api 同享。

### 1.3 `authority` 的语义（bc 选型：`'loopback'`）

`register()` 里 `authority === 'loopback'` 时把**空信任表**传给栅栏（rpc-host.ts L97），效果：即使部署为 `/api` 声明了 `trustedHosts`（LAN 放行），`/ext` 仍只接受 loopback Host。这正对铁律 6（数据不出本机）与 S3 的「非 loopback Host 被拒」，且与官方把特权方法钉死 loopback 的手法同源（connection/src/index.ts L89–119 注释）。

## 2. 继承到的栅栏项（逐条：谁做的、证据）

栅栏全部在**官方 connection 包**里、在**信封解码之前**执行，bc 插件零栅栏代码：

| # | 检查 | 官方实现位置 | 实测行为（curl） |
|---|---|---|---|
| 1 | Host 头 loopback/trustedHosts（DNS-rebinding 防御，无标记豁免） | `api-request-trust.ts` L96–108：Host 必须可解析为主机名，且 hostname 为 loopback（`loopback-hostname.ts`）或命中 trustedHosts（WHATWG 规范化比较，L31–88）；不满足 → 路由层直接 `403 forbidden`（rpc-host.ts L102–107） | `Host: evil.example` → `403 forbidden` |
| 2 | `sec-fetch-site: cross-site` 拒绝 | `api-request-trust.ts` L111 | 同头 → `403 forbidden` |
| 3 | Origin 一致性 | `api-request-trust.ts` L116–122：带 Origin 时须与 Host 权限（host:port）经 URL 规范化后相等；缺 Origin 放行（Host 栅栏已兜底）；`null` origin 拒绝 | `Origin: http://evil.example` → `403 forbidden`；`Origin: http://127.0.0.1:<port>` 放行 |
| 4 | 强制 POST | `rpcFetchHandler` rpc-host.ts L151–153 | GET /ext/ext.probe → `404 not found` |
| 5 | 强制 `application/json` | rpc-host.ts L155–158 | `Content-Type: text/plain` → `415` |

关键结构事实：`/api` 与 `/ext` 的第 1–3 项出自**同一个函数** `isTrustedApiRequest`——`/api` 在 `connection/src/index.ts` L165、`/ext`（及任何 `handle` 通道）在 `rpc-host.ts` L103 调用；第 4–5 项 `/ext` 由 `rpcFetchHandler` 执行，`/api` 由 apiProxy 的 fetch 面（`toFetchHandler`）执行，实测对外形态一致（同 404/415 文案）。`/ext` 不带 `/api` 特有的两件东西：特权方法 loopback 再栅栏（PRIVILEGED_METHODS，属 /api 共享面）与 WebSocket downlink（426 路径）。

## 3. 与 `/api` 并存证据

同进程同一 webServer 上（测试实例 127.0.0.1:52966，冷启动后）：

- `POST /api/session.create`（官方信封）→ HTTP 200 `result.ok:true` 返回 `sessionId`（官方网关照常，Typert 拦截器未被 /ext 注册触碰）；
- 同进程 `POST /ext/ext.probe` → HTTP 200 `{"ok":true,"channel":"ext","pong":{…}}`（bc 通道照常）；
- 五项栅栏向量打 `/api` 与 `/ext` 的响应**逐字相同**（403/403/403/404/415，见 §2 实测列）；
- 浏览器 roster 无扰动：`GET /plugins/@bc-agent/web-ui/client.js` → 200；首页 `__DSH_BOOT__` 仅含 `@bc-agent/web-ui`，无 capability-core 条目（无 `dsh.client` manifest 的包被 client-modules 扫描器记「not a client package」负缓存，`packages/client/modules/src/index.ts` 头注）；`GET /plugins/@bc-agent/capability-core/client.js` → 404（预期）。

## 4. 验收记录（命令 + 实际输出摘要）

环境：Windows Git Bash、node 24.15.0、pnpm 11.7.0；自有测试实例（独立 `DSH_HOME=apps/desktop/.data/p0-3-home`，随机端口，未触碰 3000/50893 两个既有实例）。

1. `pnpm install` / `pnpm run typecheck` / `pnpm run lint` → exit 0/0/0（capability-core 三 script 齐备；frontend-user 的 2 条 react-hooks warning 为存量、非本包）。
2. 冷启动两次（首启安装两插件 link → 杀进程 → 重启零安装步骤，幂等）：首启 `dsh web: http://127.0.0.1:52825`，冷启 `52966`。
3. 探测与并存（§3 前两条命令，均 HTTP 200 + 预期回显/ sessionId）。
4. S3 栅栏逐项：§2 表「实测行为」列（两通道同形）。
5. 信封边界：method≠endpoint → 200+`bad-request "method … does not match endpoint"`；未知 endpoint → 200+`bad-request "unknown /ext endpoint"`（bc handler 分支）；裸 `/ext` GET → 404；非 JSON body → 400。
6. `netstat -ano | grep :52966` → 仅 `127.0.0.1:52966 LISTENING`。
7. `find reference -newermt "2026-08-18 19:32:25" -type f | wc -l` → 0（reference/ 零改动）。

复现命令样例（P=端口）：

```sh
curl -s -w '\n[HTTP %{http_code}]\n' -X POST http://127.0.0.1:$P/ext/ext.probe \
  -H 'Content-Type: application/json' \
  -d '{"type":"client-request","rpcId":"probe-1","method":"ext.probe","payload":{"hello":"bc"}}'
curl -s -w '\n[HTTP %{http_code}]\n' -X POST http://127.0.0.1:$P/ext/ext.probe \
  -H 'Host: evil.example' -H 'Content-Type: application/json' -d '<同上信封>'
# sec-fetch-site / Origin / GET / text/plain 向量同法替换头与动词；/api 对照换路径为 /api/session.create
```

## 5. D3' 结论与退路影响

- **GO**：`connection.rpc.handle` 真实存在且为文档化公共面（`rpc-host.ts` L1 文件头注释 "Host registry and HTTP adapter for generic Connection RPC channels" + `rpc.ts` JSDoc + 安装包公共类型出口 `lib/types/index.d.ts` 再导出 `HostConnectionRpc`/`ConnectionRpcHandler` + 上游自有测试 `node-half.host.spec.ts`），信封/栅栏/信使语义与 03-architecture D3 的假设逐项吻合；S3 冒烟断言（非 loopback Host / cross-site 被拒）在 /ext 通道上成立。`capability-core` 的 `/ext` 通道框架定位（03-architecture §3）就此落地为真实代码骨架。
- **退路 ③（`webServer.register` 裸路由自复刻栅栏）**：主路径已成立，**不准备任何代码**。若未来上游移除/收紧 `connection.rpc`，复刻成本约为「Host 解析 + loopback/trusted 判定 + sec-fetch-site + Origin 等价比较 + POST/JSON 强制」≈ 120 行量级（对 api-request-trust.ts 的镜面实现），但需永久跟随上游栅栏语义演进并自冒烟——这正是 D3 否决它的理由，仅留档不实施。
- 退路 ②（`intercept('/api')`）确证死亡：每通道单拦截器，座位被官方 Typert 网关占用（rpc-host.ts L132–135 重复注册抛错）。
- 上游盯梢点（进 03-architecture §7.4 已有清单）：`connection.rpc` API 形状（rpc.ts）、`isTrustedApiRequest` 语义（api-request-trust.ts）、`clientRequestSchema` 字段（rpc.schema.ts）、`RpcErrorCode` 闭集（rpc.ts RpcErrorDetailsMap——bc 业务错误码只能从中取，当前用 `bad-request`，后续业务码需求需 PM/架构确认映射策略）。

## 6. 已知边界与移交

- 探测方法仅一个（`ext.probe`）；无业务 RPC、无存储（D4 在 P3）、无前端调用（adapters 在 P2）。
- bc handler 对未知 endpoint 的拒绝形态是 `bad-request` 业务分支（HTTP 200）；若 PM 期望 404 形态，需在上游闭集内另行选型（当前闭集无 404 语义码）。
- `authority:'loopback'` 是 bc 的选型（比官方 trusted-host 更严）；若未来企业部署要 LAN 访问 /ext，改注册参数即可，不影响本卡结论。
- 测试数据落 `apps/desktop/.data/p0-3-home`（非 C 盘、非 reference/、独立于用户实例的 `.data/dsh-home`）；测试实例已按边界要求关闭。
