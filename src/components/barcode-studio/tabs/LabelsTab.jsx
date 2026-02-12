import React from 'react'
import Field from '../ui/Field.jsx'

export default function LabelsTab({
  t,
  presets,
  popularCodeIds,
  layout,
  actions,
}) {
  const {
    presetKey, setPresetKey, pageW, setPageW, pageH, setPageH, cols, setCols, rows, setRows,
    sheetBcid, setSheetBcid, changeAllCodes, setChangeAllCodes, selectedIdx, padMM, setPadMM,
    gapMM, setGapMM, skip, setSkip, pageScale, setPageScale, pageRotate, setPageRotate, showGrid,
    setShowGrid, editMode, setEditMode, freeLayout, setFreeLayout, editAll, lockAspect,
    setLockAspect, globalMulX, setGlobalMulX, globalMulY, setGlobalMulY, snapMM, setSnapMM,
    posOverrides, labels, perPage, pages, sheetZoom, viewportRef, contentRef,
  } = layout
  const {
    setLabels, notify, onToggleEditAll, defaultPosForIndex, clampPos, snapPos, setPosOverrides,
    clampPosToCell, setZoomCentered, exportPdf, resetLayoutDefaults, clearLabels, metrics, nodeSizeMM,
    renderLabelPages,
  } = actions

  return (
    <div className="vstack">
      <div className="card hstack no-print" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="vstack" style={{ minWidth: 'min(640px, 100%)' }}>
          <div className="hstack">
            <Field label="Preset">
              <select className="select" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                {presets.map((p) => (<option key={p.key} value={p.key}>{p.name}</option>))}
              </select>
            </Field>
            <Field label="Strona (mm) – szer. × wys.">
              <div className="hstack">
                <input className="input" style={{ width: 90 }} type="number" value={pageW} onChange={(e) => setPageW(parseFloat(e.target.value || '0'))} />
                <span>×</span>
                <input className="input" style={{ width: 90 }} type="number" value={pageH} onChange={(e) => setPageH(parseFloat(e.target.value || '0'))} />
              </div>
            </Field>
            <Field label="Siatka – kol. × wiersze">
              <div className="hstack">
                <input className="input" style={{ width: 80 }} type="number" min="1" value={cols} onChange={(e) => setCols(parseInt(e.target.value || '1', 10))} />
                <span>×</span>
                <input className="input" style={{ width: 80 }} type="number" min="1" value={rows} onChange={(e) => setRows(parseInt(e.target.value || '1', 10))} />
              </div>
            </Field>
            <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 6px' }} />
            <Field label={t('labels.sheetCode')}>
              <div className="hstack">
                <select className="select" value={sheetBcid} onChange={(e) => {
                  const next = e.target.value
                  setSheetBcid(next)
                  if (changeAllCodes) {
                    setLabels((prev) => prev.map((l) => ({ ...l, bcid: next })))
                  } else if (selectedIdx != null) {
                    setLabels((prev) => prev.map((l, i) => i === selectedIdx ? ({ ...l, bcid: next }) : l))
                  } else {
                    notify(t('labels.selectLabelOrAll'))
                  }
                }}>
                  {popularCodeIds.map((id) => <option key={id} value={id}>{t(`codes.${id.replace('-', '_')}.label`)}</option>)}
                </select>
                <label className="hstack small" style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={changeAllCodes} onChange={(e) => setChangeAllCodes(e.target.checked)} />
                  {t('labels.changeAllCodes')}
                </label>
              </div>
            </Field>
          </div>

          <div className="hstack">
            <Field label={t('labels.margins')}>
              <input className="input" style={{ width: 100 }} type="number" min="0" value={padMM} onChange={(e) => setPadMM(parseFloat(e.target.value || '0'))} />
            </Field>
            <Field label={t('labels.gutter')}>
              <input className="input" style={{ width: 100 }} type="number" min="0" value={gapMM} onChange={(e) => setGapMM(parseFloat(e.target.value || '0'))} />
            </Field>
            <Field label={t('labels.skip')}>
              <input className="input" style={{ width: 100 }} type="number" min="0" value={skip} onChange={(e) => setSkip(parseInt(e.target.value || '0', 10))} />
            </Field>
            <Field label={t('labels.scaleX')}>
              <input className="input" style={{ width: 120 }} type="number" min="0.2" step="0.1" value={pageScale} onChange={(e) => setPageScale(parseFloat(e.target.value || '1'))} />
            </Field>
            <Field label={t('labels.rotateOnSheet')}>
              <select className="select" value={pageRotate} onChange={(e) => setPageRotate(parseInt(e.target.value, 10))}>
                <option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
              </select>
            </Field>
          </div>
          <div className="hstack" style={{ gap: 12, flexWrap: 'nowrap', marginTop: 6 }}>
            <label className="hstack small">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              {t('labels.showGrid')}
            </label>
            <label className="hstack small">
              <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
              {t('labels.editMode')}
            </label>
            <label className="hstack small">
              <input type="checkbox" checked={freeLayout} onChange={(e) => setFreeLayout(e.target.checked)} />
              {t('labels.freeLayout')}
            </label>
            <label className="hstack small">
              <input type="checkbox" checked={editAll} onChange={(e) => onToggleEditAll(e.target.checked)} />
              {t('labels.editAll')}
            </label>
          </div>
          {editAll && (
            <div className="hstack" style={{ alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'nowrap' }}>
              <label className="hstack small" style={{ whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} />
                Zablokuj proporcje
              </label>
              <div className="hstack" style={{ alignItems: 'center' }}>
                <span className="small">{t('labels.widthShort')} ×</span>
                <input className="input" type="range" min="0.2" max="5" step="0.05" value={globalMulX} onChange={(e) => { const v = parseFloat(e.target.value); setGlobalMulX(v); if (lockAspect) setGlobalMulY(v) }} style={{ width: 220 }} />
                <input className="input" type="number" min="0.2" max="5" step="0.1" value={globalMulX} onChange={(e) => { const v = parseFloat(e.target.value || '1'); setGlobalMulX(v); if (lockAspect) setGlobalMulY(v) }} style={{ width: 90 }} />
              </div>
              <div className="hstack" style={{ alignItems: 'center' }}>
                <span className="small">{t('labels.heightShort')} ×</span>
                <input className="input" type="range" min="0.2" max="5" step="0.05" value={globalMulY} onChange={(e) => { const v = parseFloat(e.target.value); setGlobalMulY(v); if (lockAspect) setGlobalMulX(v) }} style={{ width: 220 }} />
                <input className="input" type="number" min="0.2" max="5" step="0.1" value={globalMulY} onChange={(e) => { const v = parseFloat(e.target.value || '1'); setGlobalMulY(v); if (lockAspect) setGlobalMulX(v) }} style={{ width: 90 }} />
              </div>
            </div>
          )}
        </div>

        <div className="hstack" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label className="hstack small">
            {t('labels.snap')}
            <select className="select" value={snapMM} onChange={(e) => setSnapMM(parseInt(e.target.value || '0', 10))}>
              <option value={0}>Off</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={5}>5</option>
            </select>
          </label>

          <div className="hstack small" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '6px 8px' }}>
            <span>{t('labels.posMM')}:</span>
            <span>X</span>
            <input className="input" type="number" style={{ width: 90 }} value={(selectedIdx != null ? (posOverrides[selectedIdx]?.x ?? defaultPosForIndex(selectedIdx).x) : 0)} onChange={(e) => {
              const idx = selectedIdx ?? 0
              const v = parseFloat(e.target.value || '0')
              const pos = clampPos(idx, snapPos({ x: v, y: (posOverrides[idx]?.y ?? defaultPosForIndex(idx).y) }))
              setPosOverrides((prev) => ({ ...prev, [idx]: pos }))
            }} />
            <span>Y</span>
            <input className="input" type="number" style={{ width: 90 }} value={(selectedIdx != null ? (posOverrides[selectedIdx]?.y ?? defaultPosForIndex(selectedIdx).y) : 0)} onChange={(e) => {
              const idx = selectedIdx ?? 0
              const v = parseFloat(e.target.value || '0')
              const pos = clampPos(idx, snapPos({ x: (posOverrides[idx]?.x ?? defaultPosForIndex(idx).x), y: v }))
              setPosOverrides((prev) => ({ ...prev, [idx]: pos }))
            }} />
          </div>

          <div className="hstack small" style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '6px 8px' }}>
            <span>{t('labels.moveAll')}:</span>
            <span>{t('labels.dX')}</span>
            <input className="input" type="number" style={{ width: 90 }} value={0} onChange={() => {}} onBlur={(e) => {
              const dx = parseFloat(e.target.value || '0'); e.target.value = '0'
              setPosOverrides((prev) => { const out = { ...prev }; for (let i = 0; i < labels.length; i++) { const base = out[i] ?? defaultPosForIndex(i); const next = snapPos({ x: base.x + dx, y: base.y }); out[i] = showGrid ? clampPosToCell(i, next) : clampPos(i, next) } return out })
            }} />
            <span>{t('labels.dY')}</span>
            <input className="input" type="number" style={{ width: 90 }} value={0} onChange={() => {}} onBlur={(e) => {
              const dy = parseFloat(e.target.value || '0'); e.target.value = '0'
              setPosOverrides((prev) => { const out = { ...prev }; for (let i = 0; i < labels.length; i++) { const base = out[i] ?? defaultPosForIndex(i); const next = snapPos({ x: base.x, y: base.y + dy }); out[i] = showGrid ? clampPosToCell(i, next) : clampPos(i, next) } return out })
            }} />
          </div>

          <div className="small">{t('labels.count')}: {labels.length} • {t('labels.perPage')}: {perPage} • {t('labels.pages')}: {pages}</div>
          <div className="hstack">
            <div className="hstack small" title="Ctrl+scroll = zoom">
              {t('labels.zoom')}: {Math.round(sheetZoom * 100)}%
              <input className="input" type="range" min="50" max="300" step="10" value={Math.round(sheetZoom * 100)} onChange={(e) => setZoomCentered(parseInt(e.target.value, 10) / 100)} style={{ width: 140 }} />
            </div>
            <button className="button" onClick={() => window.print()}>{t('labels.print')}</button>
            <button className="button primary" onClick={exportPdf}>{t('labels.exportPdf')}</button>
            <button className="button" onClick={resetLayoutDefaults}>{t('labels.reset')}</button>
            <button className="button" onClick={clearLabels}>{t('labels.clearLabels')}</button>
            <div className="hstack" style={{ marginLeft: 16, gap: 8 }}>
              <button className="button icon-btn" title="{t('labels.alignLeft')}" onClick={() => {
                if (editAll) {
                  setPosOverrides((prev) => { const out = { ...prev }; for (let i = 0; i < labels.length; i++) { const base = out[i] ?? defaultPosForIndex(i); const x = showGrid ? defaultPosForIndex(i).x : 0; const p = snapPos({ x, y: base.y }); out[i] = showGrid ? clampPosToCell(i, p) : clampPos(i, p) } return out })
                } else if (selectedIdx != null) {
                  setPosOverrides((prev) => { const base = prev[selectedIdx] ?? defaultPosForIndex(selectedIdx); const x = showGrid ? defaultPosForIndex(selectedIdx).x : 0; const p = snapPos({ x, y: base.y }); return { ...prev, [selectedIdx]: showGrid ? clampPosToCell(selectedIdx, p) : clampPos(selectedIdx, p) } })
                }
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8" />
                  <path d="M6 3v18M6 8h10M6 16h12" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button className="button icon-btn" title="Wyśrodkuj poziomo" onClick={() => {
                if (editAll) {
                  setPosOverrides((prev) => { const out = { ...prev }; const { innerW, cellW } = metrics(); for (let i = 0; i < labels.length; i++) { const { w } = nodeSizeMM(i); const base = out[i] ?? defaultPosForIndex(i); const x = showGrid ? (defaultPosForIndex(i).x + (cellW - w) / 2) : (innerW - w) / 2; const p = snapPos({ x, y: base.y }); out[i] = showGrid ? clampPosToCell(i, p) : clampPos(i, p) } return out })
                } else if (selectedIdx != null) {
                  const { innerW, cellW } = metrics(); const { w } = nodeSizeMM(selectedIdx); const base = (posOverrides[selectedIdx] ?? defaultPosForIndex(selectedIdx)); const x = showGrid ? (defaultPosForIndex(selectedIdx).x + (cellW - w) / 2) : (innerW - w) / 2; const p = snapPos({ x, y: base.y }); setPosOverrides((prev) => ({ ...prev, [selectedIdx]: showGrid ? clampPosToCell(selectedIdx, p) : clampPos(selectedIdx, p) }))
                }
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8" />
                  <path d="M12 3v18M6 8h12M4 16h16" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button className="button icon-btn" title="{t('labels.alignTop')}" onClick={() => {
                if (editAll) {
                  setPosOverrides((prev) => { const out = { ...prev }; for (let i = 0; i < labels.length; i++) { const base = out[i] ?? defaultPosForIndex(i); const y = showGrid ? defaultPosForIndex(i).y : 0; const p = snapPos({ x: base.x, y }); out[i] = showGrid ? clampPosToCell(i, p) : clampPos(i, p) } return out })
                } else if (selectedIdx != null) {
                  setPosOverrides((prev) => { const base = prev[selectedIdx] ?? defaultPosForIndex(selectedIdx); const y = showGrid ? defaultPosForIndex(selectedIdx).y : 0; const p = snapPos({ x: base.x, y }); return { ...prev, [selectedIdx]: showGrid ? clampPosToCell(selectedIdx, p) : clampPos(selectedIdx, p) } })
                }
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8" />
                  <path d="M3 6h18M8 6v10M16 6v12" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button className="button icon-btn" title="{t('labels.centerV')}" onClick={() => {
                if (editAll) {
                  setPosOverrides((prev) => { const out = { ...prev }; const { innerH, cellH } = metrics(); for (let i = 0; i < labels.length; i++) { const { h } = nodeSizeMM(i); const base = out[i] ?? defaultPosForIndex(i); const y = showGrid ? (defaultPosForIndex(i).y + (cellH - h) / 2) : (innerH - h) / 2; const p = snapPos({ x: base.x, y }); out[i] = showGrid ? clampPosToCell(i, p) : clampPos(i, p) } return out })
                } else if (selectedIdx != null) {
                  const { innerH, cellH } = metrics(); const { h } = nodeSizeMM(selectedIdx); const base = (posOverrides[selectedIdx] ?? defaultPosForIndex(selectedIdx)); const y = showGrid ? (defaultPosForIndex(selectedIdx).y + (cellH - h) / 2) : (innerH - h) / 2; const p = snapPos({ x: base.x, y }); setPosOverrides((prev) => ({ ...prev, [selectedIdx]: showGrid ? clampPosToCell(selectedIdx, p) : clampPos(selectedIdx, p) }))
                }
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8" />
                  <path d="M3 12h18M8 4v16M16 6v12" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button className="button icon-btn" title="Wyśrodkuj (H+V)" onClick={() => {
                if (editAll) {
                  setPosOverrides((prev) => { const out = { ...prev }; const { innerW, innerH, cellW, cellH } = metrics(); for (let i = 0; i < labels.length; i++) { const { w, h } = nodeSizeMM(i); const x = showGrid ? (defaultPosForIndex(i).x + (cellW - w) / 2) : (innerW - w) / 2; const y = showGrid ? (defaultPosForIndex(i).y + (cellH - h) / 2) : (innerH - h) / 2; const p = snapPos({ x, y }); out[i] = showGrid ? clampPosToCell(i, p) : clampPos(i, p) } return out })
                } else if (selectedIdx != null) {
                  const { innerW, innerH, cellW, cellH } = metrics(); const { w, h } = nodeSizeMM(selectedIdx); const x = showGrid ? (defaultPosForIndex(selectedIdx).x + (cellW - w) / 2) : (innerW - w) / 2; const y = showGrid ? (defaultPosForIndex(selectedIdx).y + (cellH - h) / 2) : (innerH - h) / 2; const p = snapPos({ x, y }); setPosOverrides((prev) => ({ ...prev, [selectedIdx]: showGrid ? clampPosToCell(selectedIdx, p) : clampPos(selectedIdx, p) }))
                }
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8" />
                  <path d="M12 4v16M4 12h16M8 8h8M8 16h8" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="sheet-viewport" ref={viewportRef} onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          const d = e.deltaY > 0 ? -0.1 : 0.1
          const next = Math.max(0.5, Math.min(3, +((sheetZoom + d).toFixed(2))))
          setZoomCentered(next)
        }
      }}>
        <div ref={contentRef} style={{ transform: `scale(${sheetZoom})`, transformOrigin: '0 0' }}>
          {renderLabelPages()}
        </div>
      </div>
    </div>
  )
}
