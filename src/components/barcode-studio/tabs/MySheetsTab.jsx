import React, { useMemo, useState } from 'react'
import { TWO_D_SET, hasToSVG, makeBitmap, resolveBcid, toSvg } from '../../../utils/barcodeRender.js'

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

function previewUrlForLabel(label) {
  if (!label?.bcid || !String(label?.text || '').trim()) return null
  try {
    const bcid = String(label.bcid || '')
    const opts = {
      bcid: resolveBcid(bcid),
      text: String(label.text || ''),
      rotate: 0,
    }
    const baseScale = Math.max(2, Math.min(8, Number(label.scale) || 3))
    if (TWO_D_SET.has(bcid)) {
      opts.scaleX = baseScale
      opts.scaleY = baseScale
    } else {
      opts.scaleX = baseScale
      opts.height = Math.max(20, Math.min(140, Number(label.height) || 50))
      opts.includetext = false
    }
    if (hasToSVG()) {
      const svg = toSvg(opts)
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    }
    return makeBitmap(opts)
  } catch (_) {
    return null
  }
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
  const queryNorm = useMemo(() => norm(String(query || '').trim()), [query])
  const filtered = useMemo(() => {
    if (!queryNorm) return sheets
    return sheets.filter((s) => {
      const name = norm(s?.name || '')
      const labels = Array.isArray(s?.snapshot?.labels) ? s.snapshot.labels : []
      const labelsText = norm(labels.map((l) => labelSearchText(l)).join(' '))
      return name.includes(queryNorm) || labelsText.includes(queryNorm)
    })
  }, [sheets, queryNorm])

  const firstMatchedLabel = (sheet) => {
    if (!queryNorm) return null
    const labels = Array.isArray(sheet?.snapshot?.labels) ? sheet.snapshot.labels : []
    const idx = labels.findIndex((l) => norm(labelSearchText(l)).includes(queryNorm))
    if (idx < 0) return null
    return { label: labels[idx], index: idx }
  }

  const searchRows = useMemo(() => {
    if (!queryNorm) return []
    return filtered.map((sheet) => {
      const hit = firstMatchedLabel(sheet)
      if (!hit) return { sheet, label: null, index: null, previewUrl: null }
      return { sheet, label: hit.label, index: hit.index, previewUrl: previewUrlForLabel(hit.label) }
    })
  }, [filtered, queryNorm])
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
        ) : queryNorm ? (
          <div className="sheet-search-rows">
            {searchRows.map((row) => (
              <div key={row.sheet.id} className="sheet-search-row">
                <button type="button" className="sheet-tile" onClick={() => onOpen(row.sheet.id)} title={t('sheets.open')}>
                  <div className="sheet-tile-actions">
                    <button type="button" className="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRename(row.sheet.id) }}>
                      {t('sheets.rename')}
                    </button>
                    <button type="button" className="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(row.sheet.id) }}>
                      {t('sheets.delete')}
                    </button>
                  </div>
                  <div className="sheet-tile-title">{row.sheet.name || t('sheets.untitled')}</div>
                  <SheetMiniature sheet={row.sheet} />
                  {row.label ? <div className="sheet-tile-code">{row.label.text || '-'}</div> : null}
                  <div className="small">{new Date(row.sheet.updatedAt || row.sheet.createdAt || Date.now()).toLocaleString()}</div>
                </button>

                <button
                  type="button"
                  className="sheet-tile sheet-search-preview"
                  onClick={() => onOpen(row.sheet.id, row.index != null ? { highlightIndex: row.index } : undefined)}
                  title={t('sheets.open')}
                >
                  <div className="small" style={{ fontWeight: 700 }}>{t('sheets.matchPreview')}</div>
                  {row.label ? (
                    <>
                      <div className="small">{t('sheets.matchIndex', { index: row.index + 1 })}</div>
                      {row.previewUrl ? (
                        <div className="sheet-search-preview-image">
                          <img src={row.previewUrl} alt="matched-code" />
                        </div>
                      ) : (
                        <div className="small">{t('generator.noPreview')}</div>
                      )}
                      <div className="sheet-search-preview-code">{row.label.text || '-'}</div>
                      {row.label.customCaptionEnabled && String(row.label.customCaptionText || '').trim() ? (
                        <div className="small">{t('sheets.matchCaption')}: {row.label.customCaptionText}</div>
                      ) : null}
                      <div className="small">{t('sheets.matchType')}: {row.label.bcid || '-'}</div>
                    </>
                  ) : (
                    <div className="small">{t('sheets.matchNoCode')}</div>
                  )}
                </button>
              </div>
            ))}
          </div>
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
