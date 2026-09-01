/**
 * The conversation view's self-built session header (P2-d): the frontend-user
 * ConversationPage header form (reference/demo/frontend-user/src/components/
 * ConversationPage.tsx — read-only source; header row spec: px-6 py-3, 14px
 * medium title, bottom hairline) rendered in the --bc- token system, grown
 * with the card's own affordances — the session title with in-place rename,
 * the read-only workspace/directory badge, and the D13 archive entry.
 *
 * Rename channel: the adapter's renameSession (the documented ISession.rename
 * verb through the binding — the official ui-workspace wrapper's exact hop).
 * Commit is optimistic-free: the header keeps showing the store's title until
 * the rename's projection settle echoes back (immediate, same store the
 * sidebar rows read — so both surfaces move in the same frame). Enter
 * commits, Escape cancels, blur commits what was typed; an unchanged or blank
 * draft is a silent no-op. Failures surface as inline copy beside the title.
 *
 * Blank sessions show the localized New-Session label (the sidebar row rule);
 * their rename seeds the durable title only (absent until a rename or a
 * durable projection — never displayTitle, whose session-id fallback must not
 * land in an edit box).
 *
 * The archive entry reuses the adapter's archiveSession (D13); nothing is
 * done afterwards on purpose — the official object layer clears an archived
 * current selection into the no-session state (workspaces service project()
 * sweep), and the frame's no-current rule turns that into the welcome view.
 */
import { useEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { UpstreamEditor, UpstreamFace, UpstreamSessionHeader } from '../adapters/upstream.ts'
import { ArchiveIcon, CheckIcon, ChevronDownIcon, CodeIcon, FolderIcon } from './icons.tsx'

/** Props: projected header data + the adapter action face + the `t` seat. */
export interface BcSessionHeaderProps {
  header: UpstreamSessionHeader
  upstream: UpstreamFace
  /** The frame's `t` seat (bc namespace; copy lives in ./locale.ts). */
  t: TranslateNS<'bc'>
}

/**
 * The last path segment of a directory string (both separators — the host
 * path canon is platform-native), for the ungrouped badge fallback.
 * @param path - the session's canonical cwd.
 * @returns the basename, or the input verbatim when it has no segment.
 */
function pathBasename(path: string): string {
  const parts = path.split(/[\\/]/).filter(part => part !== '')
  return parts[parts.length - 1] ?? path
}

/**
 * The session header (see module doc): editable title + workspace badge +
 * archive entry, in the frontend-user header geometry.
 * @param props - projected header data + the adapter action face + `t` seat.
 * @returns the header element tree.
 */
export function BcSessionHeader({ header, upstream, t }: BcSessionHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  // Settled flag: Enter/Escape mark the edit done BEFORE the state flip so the
  // input's unmount-time blur cannot re-commit what was already settled.
  const settledRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // A session switch mid-edit ends the edit (the draft belongs to the old id).
  useEffect(() => {
    settledRef.current = true
    setEditing(false)
  }, [header.id])

  // Entering the edit: seed the durable title, focus, and select-all.
  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const beginEdit = (): void => {
    setDraft(header.durableTitle ?? '')
    setError(undefined)
    settledRef.current = false
    setEditing(true)
  }

  const cancelEdit = (): void => {
    settledRef.current = true
    setEditing(false)
  }

  const commitEdit = (): void => {
    settledRef.current = true
    setEditing(false)
    const next = draft.trim()
    // An unchanged or blank draft is a no-op (the host normalizes acceptance;
    // there is nothing to ask it).
    if (next === '' || next === (header.durableTitle ?? '')) return
    void upstream.renameSession(header.id, next)
      .then(() => { setError(undefined) })
      .catch(() => { setError(t('header.renameFailed')) })
  }

  // The「打开」split button: the primary action fires the default open method
  // (explorer or a detected editor); the chevron opens the "open with" chooser.
  const [openMenuOpen, setOpenMenuOpen] = useState(false)
  const [editors, setEditors] = useState<readonly UpstreamEditor[]>([])
  const [defaultOpen, setDefaultOpenId] = useState('explorer')
  const openRef = useRef<HTMLDivElement>(null)

  // Load the machine-global editor roster + persisted default once on mount
  // (the host detected editors at startup, so this is a single echo).
  useEffect(() => {
    upstream.listOpenWithOptions()
      .then(state => { setEditors(state.editors); setDefaultOpenId(state.defaultOpen) })
      .catch(() => {})
  }, [upstream])

  // A session switch ends the open dropdown (the menu belongs to the old id).
  useEffect(() => {
    setOpenMenuOpen(false)
  }, [header.id])

  // Outside-click + Escape close the transient popover.
  useEffect(() => {
    if (!openMenuOpen) return
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || openRef.current?.contains(event.target) === true) return
      setOpenMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenuOpen])

  const openPath = header.workspacePath ?? header.cwd

  const openByMethod = (method: string, path: string): void => {
    if (method === 'explorer') {
      void upstream.openPath(path)
      return
    }
    const editor = editors.find(item => item.id === method)
    // Fall back to the explorer when the default editor is no longer detected.
    if (editor === undefined) {
      void upstream.openPath(path)
      return
    }
    void upstream.openEditor({ id: editor.id, path })
  }

  const openWithDefault = (): void => {
    if (openPath !== undefined) openByMethod(defaultOpen, openPath)
  }

  const chooseDefault = (method: string): void => {
    const prev = defaultOpen
    setDefaultOpenId(method)
    setOpenMenuOpen(false)
    void upstream.setDefaultOpen(method).catch(() => { setDefaultOpenId(prev) })
  }

  const title = header.blank ? t('sessions.new') : header.displayTitle
  const badgeLabel = header.workspaceTitle
    ?? (header.cwd !== undefined ? pathBasename(header.cwd) : t('sessions.ungrouped'))
  const badgeTip = header.cwd ?? header.workspaceTitle ?? badgeLabel

  return (
    <div className="bc-web-ui-session-header" data-bc-session-header>
      {editing
        ? (
          <input
            ref={inputRef}
            className="bc-web-ui-session-rename"
            data-bc-session-rename
            type="text"
            value={draft}
            placeholder={t('header.renamePlaceholder')}
            spellCheck={false}
            onChange={(event) => { setDraft(event.target.value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitEdit()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancelEdit()
              }
            }}
            onBlur={() => { if (!settledRef.current) commitEdit() }}
          />
        )
        : (
          <span
            className="bc-web-ui-session-header-title"
            data-bc-session-title
            title={t('header.renameHint')}
            tabIndex={0}
            onDoubleClick={beginEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                beginEdit()
              }
            }}
          >
            {title}
          </span>
        )}
      <span className="bc-web-ui-session-header-badge" data-bc-session-badge title={badgeTip}>
        {badgeLabel}
      </span>
      {error !== undefined && (
        <span className="bc-web-ui-session-header-error" data-bc-session-rename-error role="alert">
          {error}
        </span>
      )}
      <span className="bc-web-ui-session-header-spacer" aria-hidden="true" />
      <div className="bc-web-ui-session-header-open" data-bc-open-button ref={openRef}>
        <button
          type="button"
          className="bc-web-ui-session-header-open-button"
          data-bc-open-trigger
          disabled={openPath === undefined}
          onClick={openWithDefault}
        >
          {defaultOpen === 'explorer' ? <FolderIcon size={14} /> : <CodeIcon size={14} />}
          <span>{t('header.open')}</span>
        </button>
        <button
          type="button"
          className="bc-web-ui-session-header-open-toggle"
          data-bc-open-toggle
          aria-haspopup="menu"
          aria-expanded={openMenuOpen}
          aria-label={t('header.open')}
          onClick={() => setOpenMenuOpen(v => !v)}
        >
          <ChevronDownIcon size={14} className="bc-web-ui-session-header-open-toggle-caret" />
        </button>
        {openMenuOpen && (
          <div className="bc-web-ui-session-header-open-menu" data-bc-open-menu role="menu">
            {editors.map(editor => (
              <button
                key={editor.id}
                type="button"
                role="menuitemradio"
                aria-checked={editor.id === defaultOpen}
                className="bc-web-ui-session-header-open-item"
                onClick={() => chooseDefault(editor.id)}
              >
                <CodeIcon size={14} />
                <span>{editor.name}</span>
                {editor.id === defaultOpen && (
                  <CheckIcon size={14} className="bc-web-ui-session-header-open-check" />
                )}
              </button>
            ))}
            {editors.length > 0 && (
              <div className="bc-web-ui-session-header-open-sep" data-bc-open-sep aria-hidden="true" />
            )}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={defaultOpen === 'explorer'}
              className="bc-web-ui-session-header-open-item"
              onClick={() => chooseDefault('explorer')}
            >
              <FolderIcon size={14} />
              <span>{t('header.openExplorer')}</span>
              {defaultOpen === 'explorer' && (
                <CheckIcon size={14} className="bc-web-ui-session-header-open-check" />
              )}
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="bc-web-ui-session-header-archive"
        data-bc-archive-button
        title={t('sessions.archive')}
        aria-label={t('sessions.archive')}
        onClick={() => { upstream.archiveSession(header.id) }}
      >
        <ArchiveIcon size={14} />
      </button>
    </div>
  )
}
