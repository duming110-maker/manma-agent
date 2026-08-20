/**
 * AI 自动沉淀记忆的模型面工具（P5 后置增强，docs/04-spec §3.6「会话中自动
 * 沉淀记忆」）：注册 `bc_write_memory`，让模型在对话中把值得长期记住的内容
 * 写入 krm 存储。走 `ctx.tools.register`（@deepseek-ai/dsh-tools 的 defineTool
 * 契约，tool-cordis 同款姿势），工具的 schema 自动投影进每次装配的模型工具集。
 *
 * 门控：工具按记忆总开关**动态注册/注销**——开关关闭时工具不在模型工具集里
 * （模型看不到也调不到）；同时 `execute` 内再 fail-closed 复检一次（防竞态），
 * 双保险保证「只有在记忆开关打开的情况下才生效」。作用域/类型/去重/新鲜度
 * 逻辑全部在 `KrmService.writeMemory`（src/krm.ts）。
 *
 * @module @bc-agent/capability-core/memory-tool
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { KrmService } from './krm.ts'

/**
 * 构造记忆写入工具的定义（每次 `ctx.tools.register` 用；返回的 disposer 由
 * 调用方持有，用于开关变化时的动态注销）。
 * @param krm - 已打开的 krm 存储服务（写入 + 门控）。
 * @returns 可注册的 ToolDefinition。
 */
export function createMemoryTool(krm: KrmService) {
  return defineTool({
    name: 'bc_write_memory',
    description:
      'Save a fact, preference, or project decision into the user\'s long-term memory, so the assistant can '
      + 'remember it across sessions. Use it when the user states a lasting preference, corrects or affirms your '
      + 'behavior, shares background about themselves, or makes a project decision worth keeping. Choose memoryType '
      + 'from the four-type taxonomy: user = identity/preference/background; feedback = a correction/affirmation of '
      + 'your behavior (must also provide why + howToApply); project = workspace progress/decisions/deadlines '
      + '(convert relative dates to absolute dates); reference = external locations/docs/config. Do NOT save things '
      + 'derivable from code, git history, content already covered by rules, one-off details, or plain fact lookups. '
      + 'If a memory with a similar title already exists, it is updated in place instead of duplicated.',
    parameters: {
      name: { type: 'string', required: true, description: 'Short scannable title for the memory (shown in the index).' },
      content: { type: 'string', required: true, description: 'The memory body in Markdown. Be specific and self-contained so it is useful later without context.' },
      memoryType: {
        type: 'string',
        required: true,
        enum: ['user', 'feedback', 'project', 'reference'],
        description: 'user = identity/preference/background; feedback = a correction/affirmation (why + howToApply required); project = workspace progress/decisions (workspace-scoped); reference = external locations/docs/config.',
      },
      description: { type: 'string', description: 'One-line summary for the index; derived from content when omitted.' },
      why: { type: 'string', description: 'Required when memoryType = feedback: the reason behind this correction or affirmation.' },
      howToApply: { type: 'string', description: 'Required when memoryType = feedback: how the assistant should apply it going forward.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          created: { type: 'boolean', required: true },
          scope: { type: 'string', required: true },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.message,
      }],
    },
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('bc_write_memory requires an agent-backed session')
      // 总开关关闭时 fail-closed（动态注册已是第一道门；此处防竞态双保险）。
      if (!krm.isMemoriesEnabled()) throw new Error('记忆功能已关闭（记忆总开关处于关闭状态），无法写入记忆')
      const cwd = exec.agent.session.header.cwd
      return krm.writeMemory(args, cwd)
    },
  })
}
