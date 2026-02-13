import React, { useEffect, useRef, useState } from 'react'
import Field from '../ui/Field.jsx'
import Toolbar from '../ui/Toolbar.jsx'

function hasDraggedFiles(e) {
  return Array.from(e.dataTransfer?.types || []).includes('Files')
}

function clampInt(v, fallback = 0) {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isNaN(n) ? fallback : n
}

function makeDefaultSegment() {
  return { id: Date.now() + Math.random(), value: '', mode: 'static', step: 1, pad: 0, min: 0, max: 999 }
}

function segmentValue(segment, index) {
  if (segment.mode === 'static') {
    return segment.value ?? ''
  }

  if (segment.mode === 'inc' || segment.mode === 'dec') {
    const base = clampInt(segment.value, 0)
    const step = Math.max(1, clampInt(segment.step, 1))
    const dir = segment.mode === 'inc' ? 1 : -1
    const n = base + dir * step * index
    const pad = Math.max(0, clampInt(segment.pad, String(Math.abs(base)).length || 1))
    const abs = String(Math.abs(n)).padStart(pad, '0')
    return n < 0 ? `-${abs}` : abs
  }

  if (segment.mode === 'random') {
    const minRaw = clampInt(segment.min, 0)
    const maxRaw = clampInt(segment.max, 999)
    const min = Math.min(minRaw, maxRaw)
    const max = Math.max(minRaw, maxRaw)
    const n = Math.floor(Math.random() * (max - min + 1)) + min
    const pad = Math.max(0, clampInt(segment.pad, 0))
    const abs = String(Math.abs(n)).padStart(pad, '0')
    return n < 0 ? `-${abs}` : abs
  }

  return segment.value ?? ''
}

function generateSegmentSequence(segments, count) {
  const total = Math.max(1, clampInt(count, 1))
  const out = []
  for (let i = 0; i < total; i++) {
    out.push(segments.map((seg) => segmentValue(seg, i)).join(''))
  }
  return out
}

function AccordionHeader({ title, open, onClick }) {
  return (
    <button
      type="button"
      className="button"
      onClick={onClick}
      style={{
        width: '100%',
        justifyContent: 'space-between',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <strong>{title}</strong>
      <span className="small">{open ? '−' : '+'}</span>
    </button>
  )
}

function AccordionBody({ open, children }) {
  return (
    <div
      style={{
        maxHeight: open ? 1600 : 0,
        opacity: open ? 1 : 0,
        overflow: 'hidden',
        transform: `translateY(${open ? 0 : -4}px)`,
        transition: 'max-height 220ms ease, opacity 180ms ease, transform 180ms ease',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div style={{ paddingTop: open ? 8 : 0 }}>
        {children}
      </div>
    </div>
  )
}

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export default function BatchTab({
  t,
  popularCodeIds,
  parseCsv,
  parseLines,
  batchInput,
  setBatchInput,
  batchRows,
  setBatchRows,
  batchBcid,
  setBatchBcid,
  addAllFromBatch,
  setLabels,
  setTab,
  scale,
  height,
  notify,
}) {
  const [isDropActive, setIsDropActive] = useState(false)
  const [isWindowDrag, setIsWindowDrag] = useState(false)
  const inputRef = useRef(null)
  const dragDepthRef = useRef(0)
  const [rowSelection, setRowSelection] = useState({})
  const hasSelectedRows = batchRows.some((_, idx) => rowSelection[idx] ?? true)

  const [seqCount, setSeqCount] = useState(10)
  const [segments, setSegments] = useState([
    { id: 1, value: 'DOCK', mode: 'static', step: 1, pad: 0, min: 0, max: 999 },
    { id: 2, value: '.', mode: 'static', step: 1, pad: 0, min: 0, max: 999 },
    { id: 3, value: '001', mode: 'inc', step: 1, pad: 3, min: 0, max: 999 },
  ])

  const [openPanel, setOpenPanel] = useState('batch')

  const processTextFile = async (file) => {
    const text = await file.text()
    setBatchInput(text)
    setBatchRows(parseLines(text))
  }

  const processFile = async (file) => {
    if (!file) return
    const name = (file.name || '').toLowerCase()
    const isCsv = name.endsWith('.csv') || file.type === 'text/csv'
    const isTxt = name.endsWith('.txt') || file.type === 'text/plain'

    if (isCsv) {
      parseCsv(
        file,
        (rows) => setBatchRows(rows),
        (err) => alert(t('batch.errorCsv') + ': ' + err?.message)
      )
      return
    }

    if (isTxt || !file.type) {
      try {
        await processTextFile(file)
      } catch (err) {
        alert(t('batch.errorTxt') + ': ' + (err?.message || err))
      }
      return
    }

    try {
      await processTextFile(file)
    } catch (err) {
      alert(t('batch.errorUnsupported') + ': ' + (err?.message || err))
    }
  }

  useEffect(() => {
    const onWindowDragEnter = (e) => {
      if (!hasDraggedFiles(e)) return
      e.preventDefault()
      dragDepthRef.current += 1
      setIsWindowDrag(true)
    }

    const onWindowDragOver = (e) => {
      if (!hasDraggedFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }

    const onWindowDragLeave = (e) => {
      if (!hasDraggedFiles(e)) return
      e.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setIsWindowDrag(false)
    }

    const onWindowDrop = async (e) => {
      if (!hasDraggedFiles(e)) return
      e.preventDefault()
      dragDepthRef.current = 0
      setIsWindowDrag(false)
      setIsDropActive(false)
      const file = e.dataTransfer.files?.[0]
      await processFile(file)
    }

    window.addEventListener('dragenter', onWindowDragEnter)
    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('dragleave', onWindowDragLeave)
    window.addEventListener('drop', onWindowDrop)

    return () => {
      window.removeEventListener('dragenter', onWindowDragEnter)
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('dragleave', onWindowDragLeave)
      window.removeEventListener('drop', onWindowDrop)
    }
  }, [t])

  useEffect(() => {
    setRowSelection(() => {
      const next = {}
      for (let i = 0; i < batchRows.length; i++) next[i] = true
      return next
    })
  }, [batchRows])

  const dropHint = isWindowDrag || isDropActive

  const updateSegment = (id, patch) => {
    setSegments((prev) => prev.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)))
  }

  const addSegment = () => {
    setSegments((prev) => [...prev, makeDefaultSegment()])
  }

  const removeSegment = (id) => {
    setSegments((prev) => (prev.length > 1 ? prev.filter((seg) => seg.id !== id) : prev))
  }

  return (
    <div className="grid-generator" style={{ gridTemplateColumns: '1.15fr 0.85fr' }}>
      <div className="card vstack">
        <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div className="hstack" style={{ gap: 10, alignItems: 'center' }}>
            <strong>{t('batch.titleShort')}</strong>
            <span className="small">{t('batch.codeType')}:</span>
            <select className="select" value={batchBcid} onChange={(e) => setBatchBcid(e.target.value)}>
              {popularCodeIds.map((id) => (
                <option key={id} value={id}>{t(`codes.${id.replace('-', '_')}.label`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="vstack" style={{ gap: 8 }}>
          <AccordionHeader
            title={t('batch.panelBatch')}
            open={openPanel === 'batch'}
            onClick={() => setOpenPanel('batch')}
          />

          <AccordionBody open={openPanel === 'batch'}>
            <div className="vstack" style={{ gap: 8 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    inputRef.current?.click()
                  }
                }}
                onDragEnter={(e) => {
                  if (!hasDraggedFiles(e)) return
                  e.preventDefault()
                  setIsDropActive(true)
                }}
                onDragOver={(e) => {
                  if (!hasDraggedFiles(e)) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }}
                onDragLeave={(e) => {
                  if (!hasDraggedFiles(e)) return
                  e.preventDefault()
                  if (!e.currentTarget.contains(e.relatedTarget)) setIsDropActive(false)
                }}
                onDrop={async (e) => {
                  if (!hasDraggedFiles(e)) return
                  e.preventDefault()
                  setIsDropActive(false)
                  const file = e.dataTransfer.files?.[0]
                  await processFile(file)
                }}
                style={{
                  border: `2px dashed ${dropHint ? '#0284c7' : '#94a3b8'}`,
                  borderRadius: 12,
                  padding: 16,
                  background: dropHint ? 'linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%)' : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                  boxShadow: dropHint ? '0 0 0 3px rgba(2,132,199,0.18)' : 'inset 0 1px 0 rgba(255,255,255,0.75)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 120ms ease',
                }}
              >
                <div className="small" style={{ fontWeight: 600 }}>
                  {t('batch.dropHint')}
                </div>
                <div className="small" style={{ marginTop: 4 }}>
                  {t('batch.dropSubhint')}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    await processFile(f)
                    e.target.value = ''
                  }}
                />
              </div>

              <textarea
                className="input textarea"
                placeholder={t('batch.helpLinePerRow')}
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
              />
              <Toolbar>
                <div style={{ flex: 1 }} />
                <button className="button primary" onClick={() => setBatchRows(parseLines(batchInput))}>{t('batch.generateList')}</button>
              </Toolbar>
            </div>
          </AccordionBody>

          <AccordionHeader
            title={t('batch.panelSequence')}
            open={openPanel === 'sequence'}
            onClick={() => setOpenPanel('sequence')}
          />

          <AccordionBody open={openPanel === 'sequence'}>
            <div className="card vstack" style={{ marginTop: 0 }}>
              <div className="vstack" style={{ gap: 8 }}>
                {segments.map((seg) => (
                  <div key={seg.id} className="hstack" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap', paddingBottom: 2 }}>
                    <Field label={t('batch.segmentValue')}>
                      <input className="input" style={{ width: 130 }} value={seg.value} onChange={(e) => updateSegment(seg.id, { value: e.target.value })} />
                    </Field>

                    <Field label={t('batch.segmentMode')}>
                      <select className="select" style={{ width: 135 }} value={seg.mode} onChange={(e) => updateSegment(seg.id, { mode: e.target.value })}>
                        <option value="static">{t('batch.segmentModeStatic')}</option>
                        <option value="inc">{t('batch.segmentModeInc')}</option>
                        <option value="dec">{t('batch.segmentModeDec')}</option>
                        <option value="random">{t('batch.segmentModeRandom')}</option>
                      </select>
                    </Field>

                    {(seg.mode === 'inc' || seg.mode === 'dec') && (
                      <>
                        <Field label={t('batch.segmentStep')}>
                          <input className="input" type="number" style={{ width: 74 }} value={seg.step} onChange={(e) => updateSegment(seg.id, { step: clampInt(e.target.value, 1) })} />
                        </Field>
                        <Field label={t('batch.segmentPad')}>
                          <input className="input" type="number" style={{ width: 74 }} value={seg.pad} onChange={(e) => updateSegment(seg.id, { pad: Math.max(0, clampInt(e.target.value, 0)) })} />
                        </Field>
                      </>
                    )}

                    {seg.mode === 'random' && (
                      <>
                        <Field label={t('batch.segmentMin')}>
                          <input className="input" type="number" style={{ width: 74 }} value={seg.min} onChange={(e) => updateSegment(seg.id, { min: clampInt(e.target.value, 0) })} />
                        </Field>
                        <Field label={t('batch.segmentMax')}>
                          <input className="input" type="number" style={{ width: 74 }} value={seg.max} onChange={(e) => updateSegment(seg.id, { max: clampInt(e.target.value, 999) })} />
                        </Field>
                        <Field label={t('batch.segmentPad')}>
                          <input className="input" type="number" style={{ width: 74 }} value={seg.pad} onChange={(e) => updateSegment(seg.id, { pad: Math.max(0, clampInt(e.target.value, 0)) })} />
                        </Field>
                      </>
                    )}

                    <button
                      className="button icon-btn"
                      title={t('batch.removeField')}
                      aria-label={t('batch.removeField')}
                      onClick={() => removeSegment(seg.id)}
                      disabled={segments.length <= 1}
                      style={{ marginBottom: 2, width: 36, height: 36, display: 'grid', placeItems: 'center', padding: 0, color: '#b91c1c' }}
                    >
                      <RemoveIcon />
                    </button>
                  </div>
                ))}
              </div>

              <div className="hstack" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                <button className="button" onClick={addSegment}>{t('batch.addField')}</button>
              </div>

              <Toolbar>
                <div style={{ flex: 1 }} />
                <div className="hstack small" style={{ alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span>{t('batch.sequenceCount')}</span>
                  <input className="input" type="number" style={{ width: 120 }} value={seqCount} onChange={(e) => setSeqCount(Math.max(1, clampInt(e.target.value, 1)))} />
                </div>
                <button
                  className="button primary"
                  style={{ marginBottom: 2 }}
                  onClick={() => setBatchRows(generateSegmentSequence(segments, seqCount))}
                >
                  {t('batch.generateList')}
                </button>
              </Toolbar>
            </div>
          </AccordionBody>
        </div>
      </div>

      <div className="card vstack">
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <div><strong>{t('batch.results', { count: batchRows.length })}</strong></div>
          <div className="small">{t('batch.clickToAddOne')}</div>
        </div>
        <div className="vstack">
          {batchRows.map((row, idx) => (
            <div key={idx} className="hstack" style={{ justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
              <input
                type="checkbox"
                checked={rowSelection[idx] ?? true}
                onChange={(e) => setRowSelection((prev) => ({ ...prev, [idx]: e.target.checked }))}
                style={{ marginRight: 8 }}
              />
              <div className="small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row}</div>
              <button
                className="button"
                onClick={() => {
                  setLabels((prev) => [...prev, { bcid: batchBcid, text: row, scale, height }])
                  setTab('labels')
                  notify(t('batch.addedOne'))
                }}
              >{t('batch.addLabel')}</button>
            </div>
          ))}
        </div>

        <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button className="button" onClick={() => setBatchRows([])} disabled={!batchRows.length}>{t('batch.clearList')}</button>
          <button
            className="button primary"
            onClick={() => addAllFromBatch(batchRows.filter((_, idx) => rowSelection[idx] ?? true))}
            disabled={!batchRows.length || !hasSelectedRows}
            style={!batchRows.length || !hasSelectedRows ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {t('batch.addToSheet')}
          </button>
        </div>
      </div>
    </div>
  )
}
