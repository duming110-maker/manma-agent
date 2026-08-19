/**
 * Host half of @bc-agent/capability-core (P0-3 spike, D3' feasibility probe).
 *
 * Registers the `/ext` business RPC channel through the DOCUMENTED
 * `ctx.connection.rpc.handle` service (reference/upstream
 * packages/client/connection/src/rpc-host.ts): Connection owns the physical
 * webServer route and applies the official browser-trust fence
 * (api-request-trust.ts) to every request BEFORE the transport envelope is
 * decoded, so the channel inherits the same Host-header / sec-fetch-site /
 * Origin / POST+JSON checks as `/api` with zero fence code of ours.
 *
 * This spike registers exactly one probe endpoint (`ext.probe`, URL
 * `/ext/ext.probe`) and nothing else: no business methods, no storage, no
 * browser half (a package without a `dsh.client` manifest is a host row only
 * — the client-modules scanner records a "not a client package" verdict).
 *
 * @module @bc-agent/capability-core
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'

/** The dedicated business RPC channel (03-architecture D3'); `/api` is reserved. */
const EXT_CHANNEL = '/ext'

/** The one probe endpoint this spike owns. The wire method must equal it exactly. */
const PROBE_ENDPOINT = 'ext.probe'

/** Wait for the connection service: the channel registry lives on it. */
export const inject = ['connection']

/**
 * Register the `/ext` channel with loopback-only authority: Connection passes
 * an empty trust list to the fence, so even a deployment that declares
 * `trustedHosts` for `/api` keeps our business plane loopback-local (iron rule 6).
 * `handle` scopes its webServer route to this fiber via its own effect; the
 * outer `ctx.effect` returns the channel disposer per the registry convention.
 * @param ctx - owning plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(
    () => ctx.connection.rpc.handle(EXT_CHANNEL, handleExt, { authority: 'loopback' }),
    'bc-capability-core: /ext rpc channel',
  )
}

/**
 * Probe dispatch: echo the decoded payload inside the documented result value.
 * Unknown endpoints answer the envelope's business-error branch without
 * leaking anything beyond the endpoint name that was asked for.
 * @param endpoint - endpoint segment(s) under `/ext/` (must equal the wire method).
 * @param payload - decoded envelope payload, echoed back verbatim as `pong`.
 * @returns the RpcResult value `{ ok, channel, pong }`.
 */
const handleExt: ConnectionRpcHandler = async (endpoint, payload) => {
  if (endpoint !== PROBE_ENDPOINT) {
    return {
      ok: false,
      error: {
        code: 'bad-request',
        message: `unknown /ext endpoint ${JSON.stringify(endpoint)}`,
        details: { issues: [] },
      },
    }
  }
  return { ok: true, value: { ok: true, channel: 'ext', pong: payload } }
}
