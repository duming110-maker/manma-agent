/**
 * The new-task welcome view (P2-c): the main-area content the shell frame
 * renders in place of the official conversation surface while the user is
 * composing a new task. Its form (workspace dropdown + multi-line task input)
 * is the docs/03 §5 welcome-page spec (`/` 新建任务/欢迎页) — the frontend-user
 * demo's own welcome page is a centered hero without either — re-based on the
 * official feeds; no router, the frame's own view state decides who owns the
 * main area.
 *
 * D7 hard constraint, rendered: the submit action stays disabled until a
 * workspace is chosen — a session is never created without its workspace
 * (the P0-4 finding: cwd fallback for a workspace-less create is
 * uncontrollable). Preselection borrows the official recency projection
 * (recentWorkspaceId, the last-used workspace) and falls back to the first
 * registry row; with no workspaces at all the view shows the empty state
 * (workspace creation UI is P3b, out of scope here).
 *
 * The submit lifecycle: the frame's onSubmit drives create → open → first
 * prompt and resolves once the conversation view takes over; a rejection
 * keeps this view mounted with the failure copy so the draft survives for a
 * retry. Prompt-side failures after a successful open are the official
 * surface's own error affordances (promptError snapshot / turn errors) —
 * this view only owns creation failures.
 */
import { useEffect, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  UpstreamWorkspaceId, UpstreamWorkspaceOptions,
} from '../adapters/upstream.ts'

/** Props: projected workspace options + the frame-owned submit action + the `t` seat. */
export interface BcWelcomeViewProps {
  /** Selectable workspaces (adapter projection of the official feed). */
  options: UpstreamWorkspaceOptions
  /**
   * Start the new task: create/open the session in the chosen workspace and
   * send the first message. Resolves once the conversation view takes over;
   * rejects on creation failure (the draft stays for a retry).
   * @param opts - chosen workspace + task text.
   */
  onSubmit(opts: { workspaceId: UpstreamWorkspaceId; text: string }): Promise<void>
  /** The frame's `t` seat (bc namespace; copy lives in ./locale.ts). */
  t: TranslateNS<'bc'>
}

/**
 * The welcome view (see module doc): workspace dropdown with official
 * last-used preselection, multi-line task input, D7-guarded submit.
 * @param props - workspace options + submit action + `t` seat.
 * @returns the welcome view element tree.
 */
export function BcWelcomeView({ options, onSubmit, t }: BcWelcomeViewProps) {
  const [selected, setSelected] = useState<UpstreamWorkspaceId | undefined>(undefined)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  // Preselection: the official last-used workspace when it is still listed,
  // else the first registry row (runs once per emptiness of the selection).
  useEffect(() => {
    if (selected !== undefined || options.items.length === 0) return
    const recent = options.recentId !== undefined
      && options.items.some(item => item.id === options.recentId)
      ? options.recentId
      : undefined
    setSelected(recent ?? options.items[0]?.id)
  }, [options.items, options.recentId, selected])

  // Self-healing selection: a workspace deleted from another surface stops
  // counting as chosen (D7 turns the submit off again instead of sending a
  // stale id into the create channel).
  const chosen = selected !== undefined && options.items.some(item => item.id === selected)
    ? selected
    : undefined
  const empty = !options.loading && options.items.length === 0
  const canSubmit = chosen !== undefined && text.trim() !== '' && !submitting

  const submit = (): void => {
    if (chosen === undefined || text.trim() === '' || submitting) return
    setSubmitting(true)
    setError(undefined)
    void onSubmit({ workspaceId: chosen, text: text.trim() })
      .catch(() => { setError(t('welcome.submitFailed')) })
      .finally(() => { setSubmitting(false) })
  }

  return (
    <div
      className="bc-web-ui-welcome"
      data-bc-welcome
      data-bc-welcome-state={empty ? 'empty' : options.loading ? 'loading' : 'ready'}
    >
      <div className="bc-web-ui-welcome-card">
        <div className="bc-web-ui-welcome-field">
          <label className="bc-web-ui-welcome-label" htmlFor="bc-welcome-workspace">{t('welcome.workspaceLabel')}</label>
          {empty
            ? (
              <p className="bc-web-ui-welcome-empty" data-bc-welcome-empty>
                {t('welcome.workspaceEmpty')}
                <span className="bc-web-ui-welcome-empty-hint">{t('welcome.workspaceEmptyHint')}</span>
              </p>
            )
            : (
              <select
                id="bc-welcome-workspace"
                className="bc-web-ui-welcome-select"
                data-bc-workspace-select
                value={chosen === undefined ? '' : String(chosen)}
                disabled={options.loading || submitting}
                onChange={(event) => {
                  const found = options.items.find(item => String(item.id) === event.target.value)
                  setSelected(found?.id)
                }}
              >
                {options.loading
                  ? <option value="">{t('welcome.workspaceLoading')}</option>
                  : chosen === undefined && <option value="">{t('welcome.noWorkspaceOption')}</option>}
                {options.items.map(item => (
                  <option key={String(item.id)} value={String(item.id)}>{item.title}</option>
                ))}
              </select>
            )}
        </div>
        <div className="bc-web-ui-welcome-field">
          <label className="bc-web-ui-welcome-label" htmlFor="bc-welcome-task">{t('welcome.taskLabel')}</label>
          <textarea
            id="bc-welcome-task"
            className="bc-web-ui-welcome-textarea"
            data-bc-task-input
            rows={5}
            placeholder={t('welcome.taskPlaceholder')}
            value={text}
            disabled={submitting}
            onChange={(event) => { setText(event.target.value) }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>
        <div className="bc-web-ui-welcome-actions">
          <button
            type="button"
            className="bc-web-ui-welcome-submit"
            data-bc-submit-task
            disabled={!canSubmit}
            onClick={submit}
          >
            {submitting ? t('welcome.submitting') : t('welcome.submit')}
          </button>
          <span className="bc-web-ui-welcome-hint">{t('welcome.submitHint')}</span>
        </div>
        {error !== undefined && (
          <p className="bc-web-ui-welcome-error" data-bc-welcome-error role="alert">{error}</p>
        )}
      </div>
    </div>
  )
}
