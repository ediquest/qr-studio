import React, { useMemo, useState } from 'react'

function SheetMiniature({ sheet }) {
  const snap = sheet?.snapshot || {}
  const cols = Math.max(1, Math.min(6, Number(snap.cols) || 3))
  const rows = Math.max(1, Math.min(6, Number(snap.rows) || 3))
  const total = cols * rows
  const filled = Math.max(0, Math.min(total, Array.isArray(snap.labels) ? snap.labels.length : 0))
  return (
    <div className="sheet-miniature">
      <div className="sheet-mini-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={'sheet-mini-cell ' + (i < filled ? 'filled' : 'empty')} />
        ))}
      </div>
      <div className="sheet-mini-meta small">
        {(snap.pageW || 0)} x {(snap.pageH || 0)} mm | {snap.cols || 0}x{snap.rows || 0}
      </div>
    </div>
  )
}

export default function MySheetsTab({ t, sheets, onOpen, onRename, onDelete }) {
  const norm = (v) =>
    String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const labelSearchText = (l) => {
    const text = String(l?.text || '')
    const customRaw = String(l?.customCaptionText || '')
    const customResolved = l?.customCaptionEnabled
      ? (String(customRaw).trim() || text)
      : ''
    return [text, customRaw, customResolved, String(l?.bcid || '')].join(' ')
  }

  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = norm(String(query || '').trim())
    if (!q) return sheets
    return sheets.filter((s) => {
      const name = norm(s?.name || '')
      const labels = Array.isArray(s?.snapshot?.labels) ? s.snapshot.labels : []
      const labelsText = norm(labels.map((l) => labelSearchText(l)).join(' '))
      return name.includes(q) || labelsText.includes(q)
    })
  }, [sheets, query])
  return (
    <div className="vstack">
      <div className="card vstack">
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <strong>{t('sheets.title')}</strong>
          <div className="small">{t('sheets.count', { count: filtered.length })}</div>
        </div>
        <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
          {query ? (
            <button className="button" onClick={() => setQuery('')}>{t('sheets.clearSearch')}</button>
          ) : null}
          <input
            className="input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('sheets.searchPlaceholder')}
            style={{ minWidth: 420 }}
          />
        </div>
        {!filtered.length ? (
          <div className="small">{t('sheets.empty')}</div>
        ) : (
          <div className="sheets-grid">
            {filtered.map((s) => (
              <button key={s.id} type="button" className="sheet-tile" onClick={() => onOpen(s.id)} title={t('sheets.open')}>
                <div className="sheet-tile-actions">
                  <button type="button" className="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRename(s.id) }}>
                    {t('sheets.rename')}
                  </button>
                  <button type="button" className="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(s.id) }}>
                    {t('sheets.delete')}
                  </button>
                </div>
                <div className="sheet-tile-title">{s.name || t('sheets.untitled')}</div>
                <SheetMiniature sheet={s} />
                <div className="small">{new Date(s.updatedAt || s.createdAt || Date.now()).toLocaleString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
