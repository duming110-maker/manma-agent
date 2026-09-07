/**
 * dsh 子进程输出处理：从 stdout 扫描端口（`dsh web: http://127.0.0.1:<port>`），
 * 同时把子进程输出落盘 `userData/logs/desktop.log` 并环形缓存最近 200 行，
 * 供 fail-loud 对话框展示（启动失败时附日志尾部，比白屏好）。
 * @module desktop/src/port-parse
 */

import { mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

/** URL 日志行正则（dsh CLI web 命令带 token 的 URL 输出）。 */
const URL_LINE = /dsh web: (http:\/\/127\.0\.0\.1:\d+[^\s]*)/u

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
 * 从 dsh 子进程 stdout 解析完整 URL（包含 token）：返回 promise，逐行扫描 URL 行；
 * resolve 后停止扫描。
 */
export function scanPort(sink) {
  return new Promise((resolve) => {
    const original = sink.onData.bind(sink)
    sink.onData = (chunk) => {
      original(chunk)
      const match = URL_LINE.exec(chunk)
      if (match?.[1] !== undefined) resolve(match[1])
    }
  })
}