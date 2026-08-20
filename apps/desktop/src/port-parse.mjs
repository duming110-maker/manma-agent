/**
 * dsh 子进程输出处理：从 stdout 扫描端口（`dsh web: http://127.0.0.1:<port>`），
 * 同时把子进程输出落盘 `userData/logs/desktop.log` 并环形缓存最近 200 行，
 * 供 fail-loud 对话框展示（启动失败时附日志尾部，比白屏好）。
 * @module desktop/src/port-parse
 */

import { mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

/** 端口日志行正则（dsh CLI web 命令的 URL 输出）。 */
const PORT_LINE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)/u

/** 环形缓存容量（最近 N 行）。 */
const TAIL_LINES = 200

/**
 * 构造输出 sink：消费子进程 stdout/stderr 的 chunk，按行扫描端口、写日志、
 * 维护环形缓存。
 * @param options - 日志落点。
 * @returns sink（onData + tail）。
 */
export function createLogSink(options) {
  const lines = []
  /** 跨 chunk 的半行缓冲。 */
  let buffer = ''
  const push = (line) => {
    lines.push(line)
    if (lines.length > TAIL_LINES) lines.splice(0, lines.length - TAIL_LINES)
  }
  return {
    onData(chunk) {
      buffer += chunk
      const parts = buffer.split(/\r?\n/)
      buffer = parts.pop() ?? ''
      for (const line of parts) {
        if (line !== '') push(line)
      }
      if (buffer !== '') push(buffer)
      mkdirSync(join(options.logFile, '..'), { recursive: true })
      appendFileSync(options.logFile, chunk, 'utf8')
    },
    tail() {
      const complete = [...lines]
      if (buffer !== '') complete.push(buffer)
      return complete.join('\n')
    },
  }
}

/**
 * 从 dsh 子进程 stdout 解析端口：返回 promise，逐行扫描端口行；resolve 后
 * 停止扫描（端口只出现一次）。不 resolve（由调用方超时处理）。
 * @param sink - 输出 sink（onData 里扫描）。
 * @param onLine - 每行回调（供 sink 复用；扫描器内部调 sink.onData 时拆行）。
 */
export function scanPort(sink) {
  return new Promise((resolve) => {
    const original = sink.onData.bind(sink)
    sink.onData = (chunk) => {
      original(chunk)
      const match = PORT_LINE.exec(chunk)
      if (match?.[1] !== undefined) resolve(Number(match[1]))
    }
  })
}
