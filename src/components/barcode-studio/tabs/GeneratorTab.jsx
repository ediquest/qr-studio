import React from 'react'
import Field from '../ui/Field.jsx'
import Toolbar from '../ui/Toolbar.jsx'

function NumberWheelInput({ value, onValue, min, max, step = 1, style, ...rest }) {
  return (
    <input
      {...rest}
      className="input"
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      style={style}
      onChange={(e) => onValue(parseFloat(e.target.value || String(min ?? 0)))}
      onWheel={(e) => {
        if (document.activeElement !== e.currentTarget) return
        e.preventDefault()
        const dir = e.deltaY < 0 ? 1 : -1
        const nextRaw = Number(value) + dir * Number(step || 1)
        const next = Math.max(
          min ?? Number.NEGATIVE_INFINITY,
          Math.min(max ?? Number.POSITIVE_INFINITY, nextRaw)
        )
        onValue(next)
      }}
    />
  )
}

function DownloadIcon({ kind }) {
  if (kind === 'png') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" />
        <circle cx="9" cy="9" r="2" fill="currentColor" />
        <path d="M6 17l4-4 3 3 3-3 2 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" />
      <path d="M14 3v5h5" fill="none" stroke="currentColor" />
      <path d="M10 15h4M10 18h4" fill="none" stroke="currentColor" />
    </svg>
  )
}

export default function GeneratorTab({
  t,
  popularCodeIds,
  is2dSet,
  bcid,
  setBcid,
  text,
  setText,
  scale,
  setScale,
  height,
  setHeight,
  includeText,
  setIncludeText,
  rotate,
  setRotate,
  hrtFont,
  setHrtFont,
  addCurrentToLabels,
  pngMul,
  setPngMul,
  makeBitmap,
  toSvg,
  genPreviewUrl,
  error,
  gs1Report,
}) {
  const is2d = is2dSet.has(bcid)

  const downloadPng = () => {
    try {
      const base = (Number(scale) || 3) * (Number(pngMul) || 1)
      const opts = { bcid, text, rotate }
      if (is2d) {
        opts.scaleX = base
        opts.scaleY = base
      } else {
        opts.scaleX = base
        opts.height = (Number(height) || 50) * (Number(pngMul) || 1)
        if (includeText) {
          opts.includetext = true
          opts.textxalign = 'center'
          opts.textfont = hrtFont
        }
      }
      const png = makeBitmap(opts)
      const a = document.createElement('a')
      a.href = png
      a.download = `${bcid}.png`
      a.click()
    } catch (e) {
      alert('Błąd PNG: ' + (e?.message || e))
    }
  }

  const downloadSvg = () => {
    try {
      const base = Number(scale) || 3
      const opts = { bcid, text, rotate }
      if (is2d) {
        opts.scaleX = base
        opts.scaleY = base
      } else {
        opts.scaleX = base
        opts.height = Number(height) || 50
        if (includeText) {
          opts.includetext = true
          opts.textxalign = 'center'
        }
      }
      const svg = toSvg(opts)
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${bcid}.svg`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Błąd SVG: ' + (e?.message || e))
    }
  }

  return (
    <div className="grid-generator">
      <div className="card vstack">
        <Field label={t('generator.dataToEncode')}>
          <textarea
            className="input textarea"
            placeholder={is2d ? t('generator.placeholder2d') : t('generator.placeholder1d')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="small">{t('generator.chars')}: {text.length}</div>
        </Field>

        <div className="grid-generator" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label={t('generator.codeType')}>
            <select className="select" value={bcid} onChange={(e) => setBcid(e.target.value)}>
              {popularCodeIds.map((id) => (
                <option key={id} value={id}>{t(`codes.${id.replace('-', '_')}.label`)}</option>
              ))}
            </select>
            <div className="small">{t(`codes.${(typeof bcid === 'string' ? bcid : '').replace('-', '_')}.note`)}</div>
          </Field>
          <div className="grid-generator" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label={t('generator.scale')}>
              <NumberWheelInput
                value={scale}
                min={1}
                max={16}
                step={1}
                onValue={(v) => setScale(parseInt(String(v || 1), 10))}
              />
              <div className="small">{t('generator.moduleWidth')}</div>
            </Field>
            {!is2d && (
              <Field label={t('generator.height1d')}>
                <NumberWheelInput
                  value={height}
                  min={20}
                  max={300}
                  step={5}
                  onValue={(v) => setHeight(parseInt(String(v || 20), 10))}
                />
                <div className="small">{t('generator.heightBars')}</div>
              </Field>
            )}
          </div>
        </div>

        <Toolbar>
          {!is2d && (
            <label className="hstack small">
              <input type="checkbox" checked={includeText} onChange={(e) => setIncludeText(e.target.checked)} />
              {t('generator.hrtText')}
            </label>
          )}
          <label className="hstack small">
            {t('generator.rotate')}
            <select className="select" value={rotate} onChange={(e) => setRotate(parseInt(e.target.value, 10))}>
              <option value={0}>0 deg</option><option value={90}>90 deg</option><option value={180}>180 deg</option><option value={270}>270 deg</option>
            </select>
          </label>
          <label className="hstack small">{t('generator.hrtFont')}
            <select className="select" value={hrtFont} disabled={is2d || !includeText} onChange={(e) => setHrtFont(e.target.value)}>
              <option value="Helvetica">Helvetica</option>
              <option value="Courier">Courier</option>
              <option value="Times-Roman">Times-Roman</option>
              <option value="Times-Bold">Times-Bold</option>
              <option value="OCR-A">OCR-A</option>
              <option value="OCR-B">OCR-B</option>
            </select>
          </label>
          <button className="button" onClick={addCurrentToLabels}>{t('generator.addToSheet')}</button>
        </Toolbar>
      </div>

      <div className="card">
        <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <div><strong>{t('generator.preview')}</strong> <span className="badge"> {is2d ? '2D' : '1D'} • {t(`codes.${(typeof bcid === 'string' ? bcid : '').replace('-', '_')}.label`)}</span></div>
        </div>
        <div className="preview">{genPreviewUrl ? <img src={genPreviewUrl} alt="preview" /> : <div className="small">{t('generator.noPreview')}</div>}</div>

        <div className="hstack" style={{ gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="hstack small">{t('generator.pngTimes')}
            <NumberWheelInput
              value={pngMul}
              min={1}
              max={10}
              step={1}
              style={{ width: 100, marginLeft: 6 }}
              onValue={(v) => setPngMul(Math.max(1, Math.min(10, parseInt(String(v || 1), 10))))}
            />
          </label>

          <button className="button" onClick={downloadPng}>
            <span className="hstack" style={{ gap: 6 }}>
              <DownloadIcon kind="png" />
              <strong>PNG</strong>
            </span>
          </button>

          <button className="button" onClick={downloadSvg}>
            <span className="hstack" style={{ gap: 6 }}>
              <DownloadIcon kind="svg" />
              <strong>SVG</strong>
            </span>
          </button>
        </div>

        {error ? <div className="small" style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div> :
          <div className="small" style={{ marginTop: 8 }}>{t('generator.emptyHint')}</div>}

        {gs1Report && (
          <div className="card" style={{ marginTop: 12 }}>
            <div><strong>Weryfikacja GS1 (AI)</strong></div>
            {gs1Report.issues.length ? (
              <ul>{gs1Report.issues.map((x, i) => <li key={i} className="small">• {x}</li>)}</ul>
            ) : <div className="small" style={{ color: '#059669' }}>{t('gs1.ok')}</div>}
          </div>
        )}
      </div>
    </div>
  )
}


