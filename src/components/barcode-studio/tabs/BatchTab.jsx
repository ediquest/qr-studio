import React from 'react'
import Field from '../ui/Field.jsx'
import Toolbar from '../ui/Toolbar.jsx'

export default function BatchTab({
  t,
  popularCodeIds,
  parseCsv,
  parseLines,
  generateSequence,
  batchInput,
  setBatchInput,
  batchRows,
  setBatchRows,
  batchBcid,
  setBatchBcid,
  addAllFromBatch,
  seqPattern,
  setSeqPattern,
  seqCount,
  setSeqCount,
  seqStep,
  setSeqStep,
  seqStart,
  setSeqStart,
  seqPad,
  setSeqPad,
  setLabels,
  setTab,
  scale,
  height,
  notify,
}) {
  return (
    <div className="grid-generator" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="card vstack">
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <strong>{t('batch.title')}</strong>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              parseCsv(
                f,
                (rows) => setBatchRows(rows),
                (err) => alert('Błąd CSV: ' + err?.message)
              )
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
          <Field label="Typ kodu (dla Batch)">
            <select className="select" value={batchBcid} onChange={(e) => setBatchBcid(e.target.value)}>
              {popularCodeIds.map((id) => (
                <option key={id} value={id}>{t(`codes.${id.replace('-', '_')}.label`)}</option>
              ))}
            </select>
          </Field>
          <button className="button primary" onClick={() => setBatchRows(parseLines(batchInput))}>{t('batch.generateList')}</button>
          <button className="button" onClick={() => setBatchRows([])}>{t('batch.clearList')}</button>
          <button className="button" onClick={() => addAllFromBatch(batchRows)}>Dodaj WSZYSTKIE do arkusza</button>
        </Toolbar>

        <div className="card vstack">
          <strong>Generator sekwencji (auto-inkrementacja)</strong>
          <div className="hstack">
            <Field label="Wzorzec">
              <input className="input" style={{ width: 260 }} value={seqPattern} onChange={(e) => setSeqPattern(e.target.value)} />
            </Field>
            <Field label="Start">
              <input className="input" type="number" style={{ width: 100 }} value={seqStart} onChange={(e) => setSeqStart(parseInt(e.target.value || '1', 10))} />
            </Field>
            <Field label="Pad (szer.)">
              <input className="input" type="number" style={{ width: 120 }} value={seqPad} onChange={(e) => setSeqPad(parseInt(e.target.value || '1', 10))} />
            </Field>
            <Field label="Ile">
              <input className="input" type="number" style={{ width: 100 }} value={seqCount} onChange={(e) => setSeqCount(parseInt(e.target.value || '1', 10))} />
            </Field>
            <Field label="Krok">
              <input className="input" type="number" style={{ width: 100 }} value={seqStep} onChange={(e) => setSeqStep(parseInt(e.target.value || '1', 10))} />
            </Field>
          </div>
          <Toolbar>
            <button className="button" onClick={() => setBatchRows(generateSequence(seqPattern, { count: seqCount, step: seqStep, start: seqStart, padWidth: seqPad }))}>{t('batch.buildList')}</button>
            <button className="button primary" onClick={() => addAllFromBatch(generateSequence(seqPattern, { count: seqCount, step: seqStep, start: seqStart, padWidth: seqPad }))}>{t('batch.addSequenceToSheet')}</button>
          </Toolbar>
        </div>
      </div>

      <div className="card vstack">
        <div className="hstack" style={{ justifyContent: 'space-between' }}>
          <div><strong>Wyniki ({batchRows.length})</strong></div>
          <div className="small">{t('batch.clickToAddOne')}</div>
        </div>
        <div className="vstack">
          {batchRows.map((row, idx) => (
            <div key={idx} className="hstack" style={{ justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
              <div className="small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row}</div>
              <button
                className="button"
                onClick={() => {
                  setLabels((prev) => [...prev, { bcid: batchBcid, text: row, scale, height }])
                  setTab('labels')
                  notify('Dodano 1 etykietę')
                }}
              >{t('batch.addLabel')}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
