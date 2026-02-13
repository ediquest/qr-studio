import React, { useEffect, useRef, useState } from 'react'
import Field from '../ui/Field.jsx'

export default function LabelsTab({
  t,
  presets,
  popularCodeIds,
  layout,
  actions,
}) {
  const [settingsCollapsed, setSettingsCollapsed] = useState(() => {
    try { return localStorage.getItem('rbs_labels_settings_collapsed') === '1' } catch(_) { return false }
  })
  const [spacePressed, setSpacePressed] = useState(false)
  const [panActive, setPanActive] = useState(false)
  const panRef = useRef({ active:false, x:0, y:0, left:0, top:0 })
  useEffect(() => {
    try { localStorage.setItem('rbs_labels_settings_collapsed', settingsCollapsed ? '1' : '0') } catch(_) {}
  }, [settingsCollapsed])
  useEffect(() => {
    const isEditable = (el) => {
      if (!(el instanceof HTMLElement)) return false
      return !!el.closest('input, textarea, select, [contenteditable="true"]')
    }
    const onKeyDown = (ev) => {
      if (ev.code !== 'Space' || isEditable(ev.target)) return
      setSpacePressed(true)
      ev.preventDefault()
    }
    const onKeyUp = (ev) => {
      if (ev.code !== 'Space') return
      setSpacePressed(false)
      setPanActive(false)
      panRef.current.active = false
    }
    const onBlur = () => {
      setSpacePressed(false)
      setPanActive(false)
      panRef.current.active = false
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('keyup', onKeyUp, { capture: true })
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('keyup', onKeyUp, { capture: true })
      window.removeEventListener('blur', onBlur)
    }
  }, [])
  const {
    presetKey, setPresetKey, pageW, setPageW, pageH, setPageH, cols, setCols, rows, setRows,
    selectedIdx, padMM, setPadMM,
    gapMM, setGapMM, skip, setSkip, pageScale, setPageScale, pageRotate, setPageRotate, showGrid,
    setShowGrid, showCutLines, setShowCutLines, cutLineWeight, setCutLineWeight, cutLineStyle, setCutLineStyle, freeLayout, setFreeLayout, editAll, lockAspect,
    setLockAspect, globalMulX, setGlobalMulX, globalMulY, setGlobalMulY, snapMM, setSnapMM,
    posOverrides, labels, perPage, pages, sheetZoom, viewportRef, contentRef, pdfQuality, setPdfQuality,
  } = layout
  const {
    setLabels, notify, defaultPosForIndex, clampPos, snapPos, setPosOverrides,
    clampPosToCell, setZoomCentered, exportPdf, resetLayoutDefaults, clearLabels, metrics, nodeSizeMM,
    renderLabelPages, onSheetPointerDownCapture, marqueeRect, openSaveSheetModal,
  } = actions
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheelNative = (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault()
        const d = ev.deltaY > 0 ? -0.1 : 0.1
        const next = Math.max(0.5, Math.min(3, +((sheetZoom + d).toFixed(2))))
        setZoomCentered(next)
        return
      }
      const maxTop = Math.max(0, (vp.scrollHeight * sheetZoom) - vp.clientHeight)
      const maxLeft = Math.max(0, (vp.scrollWidth * sheetZoom) - vp.clientWidth)
      const atTop = vp.scrollTop <= 0
      const atBottom = vp.scrollTop >= maxTop - 1
      const atLeft = vp.scrollLeft <= 0
      const atRight = vp.scrollLeft >= maxLeft - 1
      if ((ev.deltaY < 0 && atTop) || (ev.deltaY > 0 && atBottom) || (ev.deltaX < 0 && atLeft) || (ev.deltaX > 0 && atRight)) {
        return
      }
    }
    vp.addEventListener('wheel', onWheelNative, { passive: false })
    return () => vp.removeEventListener('wheel', onWheelNative)
  }, [viewportRef, sheetZoom, setZoomCentered])

  return (
    <div className="vstack">
      <div className="card vstack no-print">
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <div className="small">{settingsCollapsed ? t('labels.settingsHidden') : t('labels.gridTitle')}</div>
          <div className="hstack" style={{ gap: 8 }}>
            <button className="button" onClick={openSaveSheetModal}>{t('sheets.saveCurrent')}</button>
            <button className="button" onClick={() => setSettingsCollapsed((v) => !v)}>
              {settingsCollapsed ? t('labels.showSettings') : t('labels.hideSettings')}
            </button>
          </div>
        </div>
        {!settingsCollapsed ? (
        <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="vstack" style={{ minWidth: 'min(640px, 100%)' }}>
          <div className="hstack">
            <Field label={t('labels.preset')}>
              <select className="select" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                {presets.map((p) => (<option key={p.key} value={p.key}>{p.name}</option>))}
              </select>
            </Field>
            <Field label={t('labels.pageSize')}>
              <div className="hstack">
                <input className="input" style={{ width: 90 }} type="number" value={pageW} onChange={(e) => setPageW(parseFloat(e.target.value || '0'))} />
                <span>x</span>
                <input className="input" style={{ width: 90 }} type="number" value={pageH} onChange={(e) => setPageH(parseFloat(e.target.value || '0'))} />
              </div>
            </Field>
            <Field label={t('labels.gridColsRows')}>
              <div className="hstack">
                <input className="input" style={{ width: 80 }} type="number" min="1" value={cols} onChange={(e) => setCols(parseInt(e.target.value || '1', 10))} />
                <span>x</span>
                <input className="input" style={{ width: 80 }} type="number" min="1" value={rows} onChange={(e) => setRows(parseInt(e.target.value || '1', 10))} />
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
                <option value={0}>0 deg</option><option value={90}>90 deg</option><option value={180}>180 deg</option><option value={270}>270 deg</option>
              </select>
            </Field>
          </div>
          <div className="hstack" style={{ gap: 12, flexWrap: 'nowrap', marginTop: 6 }}>
            <label className="hstack small">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              {t('labels.showSlots')}
            </label>
            <label className="hstack small">
              <input type="checkbox" checked={showCutLines} onChange={(e) => setShowCutLines(e.target.checked)} />
              {t('labels.showCutLines')}
            </label>
            {showCutLines ? (
              <>
                <label className="hstack small">
                  {t('labels.cutLineWeight')}
                  <select className="select" value={cutLineWeight} onChange={(e) => setCutLineWeight(e.target.value)}>
                    <option value="thin">{t('labels.cutWeightThin')}</option>
                    <option value="standard">{t('labels.cutWeightStandard')}</option>
                    <option value="thick">{t('labels.cutWeightThick')}</option>
                  </select>
                </label>
                <label className="hstack small">
                  {t('labels.cutLineStyle')}
                  <select className="select" value={cutLineStyle} onChange={(e) => setCutLineStyle(e.target.value)}>
                    <option value="solid">{t('labels.cutStyleSolid')}</option>
                    <option value="dashed">{t('labels.cutStyleDashed')}</option>
                  </select>
                </label>
              </>
            ) : null}
            <label className="hstack small">
              <input type="checkbox" checked={freeLayout} onChange={(e) => setFreeLayout(e.target.checked)} />
              {t('labels.freeLayout')}
            </label>
          </div>
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

          <div className="small">{t('labels.count')}: {labels.length} | {t('labels.perPage')}: {perPage} | {t('labels.pages')}: {pages}</div>
          <div className="hstack">
            <div
              className="hstack small zoom-control"
              title="Ctrl+scroll = zoom, double-click = 100%"
              onDoubleClick={(e) => { e.preventDefault(); setZoomCentered(1) }}
            >
              {t('labels.zoom')}: {Math.round(sheetZoom * 100)}%
              <input className="input" type="range" min="50" max="300" step="10" value={Math.round(sheetZoom * 100)} onChange={(e) => setZoomCentered(parseInt(e.target.value, 10) / 100)} style={{ width: 140 }} />
            </div>
            <button className="button" onClick={() => window.print()}>{t('labels.print')}</button>
            <button className="button primary" onClick={exportPdf}>{t('labels.exportPdf')}</button>
            <label className="hstack small">
              PDF:
              <select className="select" value={pdfQuality} onChange={(e) => setPdfQuality(e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="compact">Compact</option>
                <option value="lowest">Lowest</option>
              </select>
            </label>
            <button className="button" onClick={resetLayoutDefaults}>{t('labels.reset')}</button>
            <button className="button" onClick={clearLabels}>{t('labels.clearLabels')}</button>
          </div>
        </div>
        </div>
        ) : (
        <div className="hstack labels-settings-compact">
          <Field label={t('labels.preset')}>
            <select className="select" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
              {presets.map((p) => (<option key={p.key} value={p.key}>{p.name}</option>))}
            </select>
          </Field>
          <div className="small">{t('labels.count')}: {labels.length} | {t('labels.perPage')}: {perPage} | {t('labels.pages')}: {pages}</div>
          <div className="hstack small zoom-control" title="Ctrl+scroll = zoom, double-click = 100%" onDoubleClick={(e) => { e.preventDefault(); setZoomCentered(1) }}>
            {t('labels.zoom')}: {Math.round(sheetZoom * 100)}%
            <input className="input" type="range" min="50" max="300" step="10" value={Math.round(sheetZoom * 100)} onChange={(e) => setZoomCentered(parseInt(e.target.value, 10) / 100)} style={{ width: 140 }} />
          </div>
          <button className="button primary" onClick={exportPdf}>{t('labels.exportPdf')}</button>
        </div>
        )}
      </div>

      <div className={'sheet-viewport' + (settingsCollapsed ? ' expanded' : '') + (spacePressed ? ' pan-ready' : '') + (panActive ? ' pan-active' : '')} ref={viewportRef} onPointerDownCapture={onSheetPointerDownCapture} onPointerDown={(e) => {
        if (!spacePressed || e.button !== 0) return
        const vp = e.currentTarget
        panRef.current = { active:true, x:e.clientX, y:e.clientY, left:vp.scrollLeft, top:vp.scrollTop }
        setPanActive(true)
        try { vp.setPointerCapture(e.pointerId) } catch (_) {}
        e.preventDefault()
        e.stopPropagation()
      }} onPointerMove={(e) => {
        if (!panRef.current.active) return
        const vp = e.currentTarget
        const dx = e.clientX - panRef.current.x
        const dy = e.clientY - panRef.current.y
        vp.scrollLeft = panRef.current.left - dx
        vp.scrollTop = panRef.current.top - dy
        e.preventDefault()
      }} onPointerUp={(e) => {
        if (!panRef.current.active) return
        panRef.current.active = false
        setPanActive(false)
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (_) {}
      }} onPointerCancel={() => {
        panRef.current.active = false
        setPanActive(false)
      }} onScroll={(e) => {
        const vp = e.currentTarget
        const maxTop = Math.max(0, (vp.scrollHeight * sheetZoom) - vp.clientHeight)
        const maxLeft = Math.max(0, (vp.scrollWidth * sheetZoom) - vp.clientWidth)
        if (vp.scrollTop > maxTop) vp.scrollTop = maxTop
        if (vp.scrollLeft > maxLeft) vp.scrollLeft = maxLeft
      }}>
        {!!marqueeRect && (
          <div className="selection-marquee" style={{ left: marqueeRect.x, top: marqueeRect.y, width: marqueeRect.w, height: marqueeRect.h }} />
        )}
        <div ref={contentRef} className="print-content" style={{ transform: `scale(${sheetZoom})`, transformOrigin: '0 0' }}>
          {renderLabelPages()}
        </div>
      </div>
    </div>
  )
}


