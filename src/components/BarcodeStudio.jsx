import React, { useEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { parseLines, parseCsv } from '../utils/batch.js'
import { PRESETS } from '../utils/layouts.js'
import { TWO_D_SET, fitRect, getImageSize, hasToSVG, makeBitmap, resolveBcid, toSvg } from '../utils/barcodeRender.js'
import { useI18n } from '../i18n.jsx'
import useGeneratorState from './barcode-studio/hooks/useGeneratorState.js'
import useLabelsLayoutState from './barcode-studio/hooks/useLabelsLayoutState.js'
import GeneratorTab from './barcode-studio/tabs/GeneratorTab.jsx'
import BatchTab from './barcode-studio/tabs/BatchTab.jsx'
import LabelsTab from './barcode-studio/tabs/LabelsTab.jsx'

const POPULAR_CODE_IDS = ['qrcode','code128','ean13','ean8','itf14','gs1-128','datamatrix','azteccode','pdf417'];
const ONE_D_HEIGHT_RATIO = 0.65  // portion of cellH used for 1D in Free layout

export default function BarcodeStudio() {
  const rootRef = useRef(null)
  const drawerRef = useRef(null)
  const [tab, setTab] = useState('generator')
  const [toast, setToast] = useState('')
  const [pdfQuality, setPdfQuality] = useState('lowest')
  const [selectedIds, setSelectedIds] = useState([])
  const [marqueeRect, setMarqueeRect] = useState(null)
  const previewCacheRef = useRef(new Map())
  const { t, lang } = useI18n()

  // generator
  const {
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
    hrtFont,
    setHrtFont,
    rotate,
    setRotate,
    error,
    genPreviewUrl,
    pngMul,
    setPngMul,
    downloadWhiteBg,
    setDownloadWhiteBg,
    gs1Report,
  } = useGeneratorState({ t, toSvg, makeBitmap })

  // batch
  const [batchInput, setBatchInput] = useState('')
  const [batchRows, setBatchRows] = useState([])
  const [batchBcid, setBatchBcid] = useState('code128')

  // labels & layout
  const {
    labels,
    setLabels,
    skip,
    setSkip,
    showGrid,
    setShowGrid,
    editMode,
    setEditMode,
    editAll,
    setEditAll,
    globalMulX,
    setGlobalMulX,
    globalMulY,
    setGlobalMulY,
    lockAspect,
    setLockAspect,
    sizeOverrides,
    setSizeOverrides,
    posOverrides,
    setPosOverrides,
    freeLayout,
    setFreeLayout,
    presetKey,
    setPresetKey,
    cols,
    setCols,
    rows,
    setRows,
    pageW,
    setPageW,
    pageH,
    setPageH,
    gapMM,
    setGapMM,
    padMM,
    setPadMM,
    pageRotate,
    setPageRotate,
    pageScale,
    setPageScale,
    sheetZoom,
    setSheetZoom,
    viewportRef,
    contentRef,
    snapMM,
    setSnapMM,
    selectedIdx,
    setSelectedIdx,
    perPage,
    pages,
  } = useLabelsLayoutState({ presets: PRESETS })

  function notify(msg){ setToast(msg); setTimeout(()=>setToast(''), 1400) }
  function addCurrentToLabels(){ setLabels(prev => [...prev, { bcid, text, scale, height, includeText }]); notify('Dodano 1 etykiete') }
  function addAllFromBatch(rows){ const toAdd = rows.map(r => ({ bcid: batchBcid, text: r, scale, height, includeText })); if (!toAdd.length) return; setLabels(prev => [...prev, ...toAdd]); setTab('labels'); notify(`Dodano ${toAdd.length} etykiet`) }
  function clearLabels(){ setLabels([]); setSizeOverrides({}); setPosOverrides({}); setSelectedIds([]); setSelectedIdx(null); notify('Wyczyszczono arkusze') }

  function effMul(idx, axis){ const o = sizeOverrides[idx] || {x:1,y:1}; if (editAll) return axis==='x'?globalMulX:globalMulY; return axis==='x'?o.x:o.y }
  function hasTextEnabled(item){ return item?.includeText !== false }
  function prunePreviewCache() {
    const cache = previewCacheRef.current
    if (cache.size <= 800) return
    const keys = Array.from(cache.keys())
    for (let i = 0; i < 250; i++) {
      const k = keys[i]
      if (k == null) break
      cache.delete(k)
    }
  }

  function getPreviewImage(item, idx){
    const is2d = TWO_D_SET.has(item.bcid)
    const baseScale = (Number(item.scale)||3) * (Number(pageScale)||1)
    const mulY = editAll ? globalMulY : ((sizeOverrides[idx]?.y)||1)
    const textOn = hasTextEnabled(item) ? 1 : 0
    const key = is2d
      ? `2d|${item.bcid}|${item.text}|${pageRotate||0}|${baseScale}`
      : `1d|${item.bcid}|${item.text}|${pageRotate||0}|${baseScale}|${Math.round(((Number(item.height)||50)*(Number(pageScale)||1)*mulY))}|${textOn}|${hrtFont}`
    const cache = previewCacheRef.current
    if (cache.has(key)) return cache.get(key)

    let img = null
    if (hasToSVG()) {
      const opts = { bcid: resolveBcid(item.bcid), text: item.text, rotate: pageRotate || 0 }
      if (is2d) {
        opts.scaleX = baseScale
        opts.scaleY = baseScale
      } else {
        // Keep base width in preview; horizontal resize is applied via CSS scaleX.
        opts.scaleX = baseScale
        opts.height = Math.round(((Number(item.height)||50)*(Number(pageScale)||1)*mulY))
        if (hasTextEnabled(item)) { opts.includetext = true; opts.textxalign = 'center'; opts.textfont = hrtFont }
      }
      const svg = toSvg(opts)
      img = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    } else if (is2d) {
      img = makeBitmap({
        bcid: resolveBcid(item.bcid),
        text: item.text,
        rotate: pageRotate || 0,
        scaleX: baseScale,
        scaleY: baseScale,
      })
    } else {
      img = makeBitmap({
        bcid: resolveBcid(item.bcid),
        text: item.text,
        rotate: pageRotate || 0,
        scaleX: baseScale,
        height: Math.round(((Number(item.height)||50)*(Number(pageScale)||1)*mulY)),
        ...(hasTextEnabled(item) ? { includetext:true, textxalign:'center', textfont:hrtFont } : {}),
      })
    }
    cache.set(key, img)
    prunePreviewCache()
    return img
  }

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((i) => i >= 0 && i < labels.length))
  }, [labels.length])

  useEffect(() => {
    if (!editMode) { setSelectedIds([]); setSelectedIdx(null) }
  }, [editMode, setSelectedIdx])

  useEffect(() => {
    const first = selectedIds.length ? selectedIds[0] : null
    if (selectedIdx !== first) setSelectedIdx(first)
  }, [selectedIds, selectedIdx, setSelectedIdx])

  function selectSingle(idx){
    setSelectedIds([idx])
    setSelectedIdx(idx)
  }

  function toggleSelection(idx){
    setSelectedIds((prev) => {
      const has = prev.includes(idx)
      const next = has ? prev.filter((v) => v !== idx) : [...prev, idx].sort((a,b)=>a-b)
      setSelectedIdx(next.length ? next[0] : null)
      return next
    })
  }

  function clearSelection(){
    setSelectedIds([])
    setSelectedIdx(null)
  }

  function closeSelectionPanel(){
    clearSelection()
    if (editAll) onToggleEditAll(false)
  }

  let lastError='';

  // metrics helpers
  function metrics(){ const innerW=pageW-2*padMM, innerH=pageH-2*padMM; const cellW=(innerW-(cols-1)*gapMM)/cols; const cellH=(innerH-(rows-1)*gapMM)/rows; return {innerW,innerH,cellW,cellH} }

  function onGridPointerDown(e, globalCellIndex){
    if (!editMode || freeLayout) return
    if (e.currentTarget?.closest?.('.sheet-viewport.pan-ready') || e.currentTarget?.closest?.('.sheet-viewport.pan-active')) return
    const idx = globalCellIndex - skip
    const additive = !!(e.ctrlKey || e.metaKey)
    if (!(idx >= 0 && idx < labels.length)) {
      if (!additive) clearSelection()
      return
    }
    if (additive) toggleSelection(idx)
    else selectSingle(idx)
    e.preventDefault()
    e.stopPropagation()
  }

  // free layout drag (absolute)
  const absRef = useRef({ active:false, idx:null, start:{x:0,y:0}, orig:{x:0,y:0}, pageIdx:0 })

  function onLabelPointerDown(e, idx, pageIndex){
    if (!editMode) return
    if (e.currentTarget?.closest?.('.sheet-viewport.pan-ready') || e.currentTarget?.closest?.('.sheet-viewport.pan-active')) return
    const additive = !!(e.ctrlKey || e.metaKey)
    if (additive) {
      toggleSelection(idx)
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!selectedIds.includes(idx)) selectSingle(idx)
    if (freeLayout) startFreeDrag(e, idx, pageIndex)
  }

  function onSheetPointerDownCapture(e){
    if (!editMode) return
    if (e.button !== 0) return
    if (e.target?.closest?.('.sheet-viewport.pan-ready') || e.target?.closest?.('.sheet-viewport.pan-active')) return
    if (e.target?.closest?.('[data-label-idx]')) return
    const vp = viewportRef.current
    if (!vp) return
    const vpRect = vp.getBoundingClientRect()
    const additive = !!(e.ctrlKey || e.metaKey)
    const baseSet = additive ? new Set(selectedIds) : new Set()
    const sx = e.clientX - vpRect.left
    const sy = e.clientY - vpRect.top
    setMarqueeRect({ x:sx, y:sy, w:0, h:0 })
    if (!additive) clearSelection()

    const onMove = (ev) => {
      const x0 = Math.min(sx, ev.clientX - vpRect.left)
      const y0 = Math.min(sy, ev.clientY - vpRect.top)
      const w = Math.abs((ev.clientX - vpRect.left) - sx)
      const h = Math.abs((ev.clientY - vpRect.top) - sy)
      const clientRect = { left: x0 + vpRect.left, top: y0 + vpRect.top, right: x0 + vpRect.left + w, bottom: y0 + vpRect.top + h }
      setMarqueeRect({ x:x0, y:y0, w, h })

      const next = new Set(baseSet)
      const nodes = document.querySelectorAll('[data-label-idx]')
      nodes.forEach((node) => {
        const idxRaw = node.getAttribute('data-label-idx')
        const idx = idxRaw == null ? -1 : parseInt(idxRaw, 10)
        if (!(idx >= 0)) return
        const r = node.getBoundingClientRect()
        const hit = r.right >= clientRect.left && r.left <= clientRect.right && r.bottom >= clientRect.top && r.top <= clientRect.bottom
        if (hit) next.add(idx)
      })
      const sorted = Array.from(next).sort((a,b)=>a-b)
      setSelectedIds(sorted)
      setSelectedIdx(sorted.length ? sorted[0] : null)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setMarqueeRect(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startFreeDrag(e, labelIndex, pageIndex){
    if (!editMode || !freeLayout) return
    const pageEl = document.querySelector(`[data-page-idx="${pageIndex}"]`)
    if (!pageEl) return
    const innerEl = pageEl.querySelector('[data-inner="1"]') || pageEl
    const innerRect = innerEl.getBoundingClientRect()
    const { innerW, innerH, cellW, cellH } = metrics()
    const pxPerMMx = innerRect.width / innerW
    const pxPerMMy = innerRect.height / innerH

    // anchor = where inside the node user grabbed, expressed in mm
    const nodeRect = e.currentTarget.getBoundingClientRect()
    const grabOffXmm = (e.clientX - nodeRect.left) / pxPerMMx
    const grabOffYmm = (e.clientY - nodeRect.top)  / pxPerMMy

    const snap = {}
    for (let i=0;i<labels.length;i++){
      const col = (i % cols), row = Math.floor(i / cols)
      const defX = col*(cellW+gapMM), defY = row*(cellH+gapMM)
      const po = posOverrides[i] || { x:defX, y:defY }
      snap[i] = { x: po.x, y: po.y }
    }

    try { e.currentTarget.setPointerCapture(e.pointerId) } catch(_) {}
    
    const onMove=(ev)=>{
      ev.preventDefault();
      const innerRect = innerEl.getBoundingClientRect()
      const { innerW, innerH, cellW, cellH } = metrics()
      const sx = innerRect.width / innerW, sy = innerRect.height / innerH
      const mouseXmm = (ev.clientX - innerRect.left) / sx
      const mouseYmm = (ev.clientY - innerRect.top)  / sy
      const targetX = mouseXmm - grabOffXmm
      const targetY = mouseYmm - grabOffYmm

      if (editAll){
        setPosOverrides(prev => {
          const out = { ...prev }
          for (let i=0;i<labels.length;i++){
            const base = snap[i]
            const { w, h } = nodeSizeMM(i)
            let nx = base.x + (targetX - snap[labelIndex].x)
            let ny = base.y + (targetY - snap[labelIndex].y)
            const snapped = snapPos({x:nx,y:ny})
            nx = Math.max(0, Math.min(innerW - w, snapped.x))
            ny = Math.max(0, Math.min(innerH - h, snapped.y))
            out[i] = { x:nx, y:ny }
          }
          return out
        })
      } else {
        const { w, h } = nodeSizeMM(labelIndex)
        let nx = targetX, ny = targetY
        const snapped = snapPos({x:nx,y:ny})
        nx = Math.max(0, Math.min(innerW - w, snapped.x))
        ny = Math.max(0, Math.min(innerH - h, snapped.y))
        setPosOverrides(prev => ({ ...prev, [labelIndex]: { x:nx, y:ny } }))
      }
    }
    const onUp=()=>{ window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    e.preventDefault(); e.stopPropagation()
  }




  function onToggleEditAll(enabled){
    setEditAll(enabled)
    if (!enabled){
      setSizeOverrides(prev => { const out={...prev}; for(let i=0;i<labels.length;i++){ out[i]={x:globalMulX,y:globalMulY} } return out })
    } else {
      const first = sizeOverrides[0]; if(first){ setGlobalMulX(first.x||1); setGlobalMulY(first.y||1) }
    }
  }

  
  function defaultPosForIndex(i){
    const { innerW, innerH, cellW, cellH } = metrics()
    const col = (i % cols), row = Math.floor(i / cols)
    return { x: col*(cellW+gapMM), y: row*(cellH+gapMM) }
  }
  function nodeSizeMM(i){
    const { cellW, cellH } = metrics()
    const mulX = effMul(i,'x'); const mulY = effMul(i,'y')
    const is2d = TWO_D_SET.has(labels[i]?.bcid||'')
    const h = is2d ? (cellH*mulY) : (cellH*mulY*ONE_D_HEIGHT_RATIO)
    return { w: is2d ? (cellW*mulX) : cellW, h }
  }
  function clampPosToCell(i, pos){
    const { cellW, cellH } = metrics()
    const base = defaultPosForIndex(i)
    const { w, h } = nodeSizeMM(i)
    return {
      x: Math.max(base.x, Math.min(base.x + cellW - w, pos.x)),
      y: Math.max(base.y, Math.min(base.y + cellH - h, pos.y)),
    }
  }
  function clampPos(i, pos){
    const { innerW, innerH } = metrics()
    const { w, h } = nodeSizeMM(i)
    return { x: Math.max(0, Math.min(innerW - w, pos.x)), y: Math.max(0, Math.min(innerH - h, pos.y)) }
  }
  function snapPos(pos){
    if(!snapMM) return pos
    return { x: Math.round(pos.x / snapMM) * snapMM, y: Math.round(pos.y / snapMM) * snapMM }
  }

  
  function setZoomCentered(nextZoom){
    const vp = viewportRef.current, ct = contentRef.current
    if (!vp || !ct){ setSheetZoom(nextZoom); return }
    const prev = sheetZoom || 1
    const centerX = vp.scrollLeft + vp.clientWidth/2
    const centerY = vp.scrollTop + vp.clientHeight/2
    const ratio = nextZoom / prev
    setSheetZoom(nextZoom)
    requestAnimationFrame(()=>{
      vp.scrollLeft = centerX * ratio - vp.clientWidth/2
      vp.scrollTop  = centerY * ratio - vp.clientHeight/2
    })
  }

  
  
  function cleanBwipError(err){
    const raw = (err && (err.message || err) || '') + '';
    // strip engine prefixes e.g. "bwipp.ean13badLength#4907:" or "bwip-js.ean13badLength:" and "Error:"/"Blad:"
    let s = raw
      .replace(/^(?:Blad|Error)\s*:\s*/i,'')
      .replace(/(?:bwipp|bwip-js)[.:][\w-]+(?:#\d+)?:\s*/ig,'')
      .replace(/\s+at\s+[\s\S]*$/,'') // drop stack
      .trim();

    const codeMatch = raw.match(/(?:bwipp|bwip-js)[.:]([\w-]+)(?:#\d+)?:\s*/i);
    const code = codeMatch && codeMatch[1] ? codeMatch[1].toLowerCase() : null;

    const dict = {
      'ean13badlength': t('errors.ean13badlength'),
      'ean8badlength':  t('errors.ean8badlength'),
      'upcabadlength':  t('errors.upcabadlength'),
      'upcebadlength':  t('errors.upcebadlength'),
      'itf14badlength': t('errors.itf14badlength'),
      'isbn10badlength': 'ISBN-10 musi miec 9 lub 10 cyfr (bez myslnikow)',
      'isbn13badlength': 'ISBN-13 musi miec 12 lub 13 cyfr (bez myslnikow)',
      'code39badcharacter': t('errors.code39badcharacter'),
      'code128badcharacter': t('errors.code128badcharacter'),
      'itfbadcharacter':    'ITF (Interleaved 2 of 5) akceptuje tylko cyfry',
      'postnetbadcharacter': 'POSTNET akceptuje tylko cyfry',
      'badcheckdigit': t('errors.badcheckdigit'),
      'badchecksum':   t('errors.badchecksum'),
      'qrcodetoolong': t('errors.toolong'),
      'datamatrixtoolong': t('errors.toolong'),
      'pdf417toolong': t('errors.toolong'),
    };
    if (code && dict[code]) return dict[code];

    // common generic messages
    if (/bar code text not specified/i.test(s) || /text not specified/i.test(s)) return t('generator.errorNoText');

    if (!s) s = t('errors.fallback');

    // Heuristic translation of common phrases
    s = s.replace(/\bmust be\b/gi,'musi miec')
         .replace(/\bshould be\b/gi,'powinno miec')
         .replace(/\bdigits?\b/gi,'cyfr')
         .replace(/\binvalid\b/gi,'nieprawidlowy')
         .replace(/\btoo long\b/gi,'za dlugi')
         .replace(/\btoo short\b/gi,'za krotki')
         .replace(/[.:\s]+$/,'')
         .trim();
    return s;
  }

  function renderLabelPages(){
    const out = []; const perPageLocal = perPage; const { innerW, innerH, cellW, cellH } = metrics()
    const useFreeLayout = freeLayout || Object.keys(posOverrides || {}).length > 0
    for (let p=0; p<pages; p++) {
      if (!useFreeLayout){
        out.push(
          <div key={p} data-page-idx={p} className="print-page print-sheet page-outline" style={{ width: pageW+'mm', height: pageH+'mm', padding: padMM+'mm' }}>
            <div className="label-grid" style={{ gridTemplateColumns:`repeat(${cols},1fr)`, gridTemplateRows:`repeat(${rows},1fr)`, gap: gapMM+'mm' }}>
              {Array.from({length: perPageLocal}).map((_,i)=>{
                const g=p*perPageLocal+i; const idx=g - skip; const item = idx>=0 && idx<labels.length ? labels[idx] : null
                let imgSrc=null
                if (item) {
                  try {
                    imgSrc = getPreviewImage(item, idx)
                  } catch(e){ console.error('Label render error', e); imgSrc='ERROR'; lastError=cleanBwipError(e) }
                }
                const mulX = editAll?globalMulX:((sizeOverrides[idx]?.x)||1)
                const mulY = editAll?globalMulY:((sizeOverrides[idx]?.y)||1)
                const is2d = TWO_D_SET.has(item?.bcid||'')
                const globalCellIndex = p*perPageLocal + i;
                return (
                  <div key={i} className={"label-cell "+((editAll || selectedIds.includes(idx))?"cell-highlight":"")} data-cell-index={globalCellIndex} data-label-idx={item ? idx : undefined}
                       onPointerDown={(e)=>onGridPointerDown(e, globalCellIndex)}
                       style={{position:'relative', borderStyle: showGrid?'dashed':'none', overflow:'hidden', touchAction:'none', userSelect:'none'}}>
                    {(() => {
                      if (imgSrc && imgSrc!=='ERROR') {
                        const wrapW = is2d ? ((mulX*100)+'%') : '100%'; const wrapH = (mulY*100)+'%';
                        return (
                          <div className="barcode-wrap" style={{position:'relative', width:wrapW, height:wrapH, display:'flex', alignItems:'center', justifyContent:'center'}}>
                            <img src={imgSrc} alt="barcode" draggable={false} style={is2d ? {maxWidth:'100%',maxHeight:'100%', pointerEvents:'none'} : {maxHeight:'100%',maxWidth:'none',width:'auto', transform:`scaleX(${mulX})`, transformOrigin:'center center', pointerEvents:'none'}} />
                          </div>
                        )
                      }
                      return (imgSrc==='ERROR' ? <span className="small" style={{color:'#b91c1c'}}>blad</span> : <span className="small">pusta</span>)
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        )
      } else {
        out.push(
          <div key={p} data-page-idx={p} className="print-page print-sheet page-outline" style={{ width: pageW+'mm', height: pageH+'mm', padding: padMM+'mm', position:'relative' }}>
            <div data-inner="1" style={{position:'absolute', left:padMM+'mm', top:padMM+'mm', width: innerW+'mm', height: innerH+'mm', border: showGrid?'1px dashed #cbd5e1':'none'}}>
              {Array.from({length: perPageLocal}).map((_,i)=>{
                const g=p*perPageLocal+i; const idx=g - skip; const item = idx>=0 && idx<labels.length ? labels[idx] : null
                if (!item) return <div key={i}></div>
                const col = i % cols; const row = Math.floor(i / cols)
                const { cellW, cellH } = metrics()
                const defX = col*(cellW+gapMM); const defY = row*(cellH+gapMM)
                const pos = posOverrides[idx] || { x: defX, y: defY }
                let imgSrc=null
                try {
                  imgSrc = getPreviewImage(item, idx)
                } catch(e){ console.error('Label render error', e); imgSrc='ERROR'; lastError=cleanBwipError(e) }
                const mulX = editAll?globalMulX:((sizeOverrides[idx]?.x)||1); const mulY = editAll?globalMulY:((sizeOverrides[idx]?.y)||1)
                const is2d = TWO_D_SET.has(item.bcid)
                const drawW = is2d ? (cellW*mulX) : cellW; const drawH = is2d ? (cellH*mulY) : (cellH*mulY*ONE_D_HEIGHT_RATIO)
                return (
                  <div key={i} className={"free-node" + ((editAll || selectedIds.includes(idx))?" cell-highlight":"")} data-label-idx={idx} style={{position:'absolute', left: pos.x+'mm', top: pos.y+'mm', width: drawW+'mm', height: drawH+'mm', touchAction:'none', userSelect:'none'}}
                       onPointerDown={(e)=>onLabelPointerDown(e, idx, p)}>
                    {imgSrc && imgSrc!=='ERROR' ? (
                      <div className="barcode-wrap" style={{position:'relative', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <img src={imgSrc} alt="barcode" draggable={false} style={is2d ? {maxWidth:'100%',maxHeight:'100%', pointerEvents:'none'} : {maxHeight:'100%',maxWidth:'none',width:'auto', transform:`scaleX(${mulX})`, transformOrigin:'center center', pointerEvents:'none'}} />
                      </div>
                    ) : (imgSrc==='ERROR' ? <span className="small" style={{color:'#b91c1c'}}>blad</span> : <span className="small">pusta</span>)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      }
    }
    return out
  }

  function resetLayoutDefaults(){
    const def = PRESETS[0];
    setPresetKey(def.key);
    setCols(def.cols);
    setRows(def.rows);
    setPageW(def.pageW);
    setPageH(def.pageH);
    setGapMM(def.gapMM);
    setPadMM(def.padMM);
    setSkip(0);
    setShowGrid(true);
    setEditMode(true);
    setEditAll(false);
    setLockAspect(false);
    setGlobalMulX(1);
    setGlobalMulY(1);
    setSizeOverrides({});
    setPosOverrides({});
    setFreeLayout(false);
    setPageRotate(0);
    setPageScale(1);
    setSheetZoom(1);
  }

  async function exportPdf(){
  const PDF_QUALITY = {
    lowest:  { dpiMul: 0.65, pxPerMm: 2.0, minW: 100, maxW: 420, minH: 90, maxH: 320, imageType: 'PNG', imageQuality: 0.7, forceNoText: false },
    compact: { dpiMul: 1.0, pxPerMm: 4.2, minW: 180, maxW: 720, minH: 150, maxH: 560, imageType: 'PNG', imageQuality: 0.8 },
    medium:  { dpiMul: 1.35, pxPerMm: 6.0, minW: 220, maxW: 900, minH: 180, maxH: 700, imageType: 'PNG', imageQuality: 0.9 },
    high:    { dpiMul: 1.8, pxPerMm: 8.2, minW: 260, maxW: 1200, minH: 220, maxH: 920, imageType: 'PNG', imageQuality: 0.95 },
  };
  const q = PDF_QUALITY[pdfQuality] || PDF_QUALITY.compact;
  const dpiMul = q.dpiMul;
  try {
    const orientation = pageW >= pageH ? 'l' : 'p';
    await (document?.fonts?.ready || Promise.resolve());
    const pdf = new jsPDF({ unit:'mm', format:[pageW,pageH], orientation });
    const { innerW, innerH, cellW, cellH } = metrics();
    const exportImageCache = new Map();
    let processed = 0;

    for (let p=0; p<pages; p++) {
      if (p>0) pdf.addPage([pageW,pageH], orientation);

      for (let i=0;i<perPage;i++) {
        const g=p*perPage+i; const idx=g - skip; const item = idx>=0 && idx<labels.length ? labels[idx] : null;
        if (!item) continue;
        const is2d = TWO_D_SET.has(item.bcid);
        let x, y, drawW, drawH;
        const mulX = editAll?globalMulX:((sizeOverrides[idx]?.x)||1);
        const mulY = editAll?globalMulY:((sizeOverrides[idx]?.y)||1);
        if (!freeLayout){
          const col = i % cols; const row = Math.floor(i / cols);
          const innerX = col*(cellW+gapMM); const innerY = row*(cellH+gapMM);
          drawW = is2d ? (cellW*mulX) : cellW; drawH = (TWO_D_SET.has(item.bcid)? (cellH*mulY) : (cellH*mulY));
          x = padMM + innerX + (cellW - drawW)/2; y = padMM + innerY + (cellH - drawH)/2;
        } else {
          const col = i % cols; const row = Math.floor(i / cols);
          const defX = col*(cellW+gapMM); const defY = row*(cellH+gapMM);
          const pos = posOverrides[idx] || { x:defX, y:defY };
          drawW = is2d ? (cellW*mulX) : cellW; drawH = (TWO_D_SET.has(item.bcid)? (cellH*mulY) : (cellH*mulY));
          x = padMM + pos.x; y = padMM + pos.y;
        }

        // Use a single high-DPI bitmap path for stable PDF export.
        const base = ((Number(item.scale)||3) * (Number(pageScale)||1)) * dpiMul;
        const opts = { bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0 };
        const canvasWidth = Math.max(q.minW, Math.min(q.maxW, Math.round(drawW * q.pxPerMm)));
        const canvasHeight = Math.max(q.minH, Math.min(q.maxH, Math.round(drawH * q.pxPerMm)));
        const canvasSize = Math.max(canvasWidth, canvasHeight);
        if (TWO_D_SET.has(item.bcid)) { opts.scaleX=base; opts.scaleY=base; }
        else {
          // Width in PDF is controlled by drawW to avoid fitRect cancelling the effect.
          opts.scaleX = base;
          opts.height = Math.round((Number(item.height)||50) * (Number(pageScale)||1) * (editAll?globalMulY:((sizeOverrides[idx]?.y)||1)));
          if (!q.forceNoText && hasTextEnabled(item)) { opts.includetext=true; opts.textxalign='center'; opts.textfont=hrtFont; }
        }
        const exportKey = [
          opts.bcid, opts.text, opts.rotate, opts.scaleX, opts.scaleY || '', opts.height || '',
          opts.includetext ? 1 : 0, opts.textfont || '', canvasSize, canvasWidth, canvasHeight, q.imageType, q.imageQuality
        ].join('|');
        let cached = exportImageCache.get(exportKey);
        if (!cached) {
          const dataUrl = makeBitmap({ ...opts, canvasSize, canvasWidth, canvasHeight, imageFormat: q.imageType, imageQuality: q.imageQuality });
          const size = await getImageSize(dataUrl);
          cached = { dataUrl, size };
          exportImageCache.set(exportKey, cached);
        }
        const { dataUrl, size } = cached;
        let fit = { x, y, w: drawW, h: drawH };
        if (size && is2d) {
          fit = fitRect(x, y, drawW, drawH, size.w, size.h);
        } else if (size && !is2d) {
          const ratio = size.w / Math.max(1, size.h);
          const baseWAtH = drawH * ratio;
          const scaledW = Math.max(1, baseWAtH * mulX);
          const finalW = Math.min(drawW, scaledW);
          fit = { x: x + (drawW - finalW)/2, y, w: finalW, h: drawH };
        }
        pdf.addImage(dataUrl, q.imageType, fit.x, fit.y, fit.w, fit.h);

        processed++;
        if (processed % 16 === 0) await new Promise((r) => setTimeout(r, 0));
      } // end perPage
    } // end pages

    pdf.save('labels.pdf');
  } catch(e) {
    alert('Blad eksportu PDF: '+(e?.message||e));
  }
}
  const selectedPrimary = selectedIds.length ? selectedIds[0] : ((editAll && labels.length) ? 0 : null)
  const selectedCount = selectedIds.length
  const targetIds = editAll ? labels.map((_, i) => i) : selectedIds
  const targetCount = targetIds.length
  const panelMulX = selectedPrimary != null ? effMul(selectedPrimary, 'x') : 1
  const panelMulY = selectedPrimary != null ? effMul(selectedPrimary, 'y') : 1
  const panelBcid = selectedPrimary != null ? (labels[selectedPrimary]?.bcid || 'code128') : 'code128'
  const panelText = selectedPrimary != null ? (labels[selectedPrimary]?.text || '') : ''
  const panelIncludeText = selectedPrimary != null ? hasTextEnabled(labels[selectedPrimary]) : true

  function setSelectionMulX(v){
    if (!targetIds.length) return
    if (editAll) { setGlobalMulX(v); return }
    setSizeOverrides((prev) => {
      const out = { ...prev }
      targetIds.forEach((idx) => {
        const cur = out[idx] || { x:1, y:1 }
        out[idx] = { ...cur, x: v }
      })
      return out
    })
  }

  function setSelectionMulY(v){
    if (!targetIds.length) return
    if (editAll) { setGlobalMulY(v); return }
    setSizeOverrides((prev) => {
      const out = { ...prev }
      targetIds.forEach((idx) => {
        const cur = out[idx] || { x:1, y:1 }
        out[idx] = { ...cur, y: v }
      })
      return out
    })
  }

  function setSelectionBcid(next){
    if (!targetIds.length) return
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, bcid: next }) : l))
  }

  function setSelectionIncludeText(enabled){
    if (!targetIds.length) return
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, includeText: !!enabled }) : l))
  }

  function setSelectionText(next){
    if (!targetIds.length) return
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, text: next }) : l))
  }

  function applyNumberWheel(el, deltaY){
    if (!el || !(el instanceof HTMLInputElement) || el.type !== 'number') return
    if (el.disabled || el.readOnly) return

    const cur = Number(el.value || '0')
    if (Number.isNaN(cur)) return

    const stepRaw = el.step && el.step !== 'any' ? Number(el.step) : 1
    const step = Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : 1
    const dir = deltaY < 0 ? 1 : -1
    let next = cur + dir * step

    const min = el.min !== '' ? Number(el.min) : null
    const max = el.max !== '' ? Number(el.max) : null
    if (min != null && Number.isFinite(min)) next = Math.max(min, next)
    if (max != null && Number.isFinite(max)) next = Math.min(max, next)

    const stepStr = String(el.step || '')
    const decimals = stepStr.includes('.') ? (stepStr.split('.')[1] || '').length : 0
    if (decimals > 0) next = Number(next.toFixed(decimals))

    const nextValue = String(next)
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (nativeSetter) nativeSetter.call(el, nextValue)
    else el.value = nextValue
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function onNumberWheelCapture(e){
    const el = e.target
    if (!(el instanceof HTMLInputElement) || el.type !== 'number') return
    e.preventDefault()
    e.stopPropagation()
    applyNumberWheel(el, e.deltaY)
  }

  useEffect(() => {
    const onNativeWheel = (ev) => {
      const root = rootRef.current
      const t = ev.target
      if (!root || !(t instanceof HTMLElement) || !root.contains(t)) return
      const el = t.closest('input[type="number"]')
      if (!(el instanceof HTMLInputElement)) return
      if (el.disabled || el.readOnly) return
      ev.preventDefault()
      ev.stopPropagation()
      applyNumberWheel(el, ev.deltaY)
    }
    window.addEventListener('wheel', onNativeWheel, { capture: true, passive: false })
    return () => window.removeEventListener('wheel', onNativeWheel, { capture: true })
  }, [])

  function resetSelectionChanges(){
    setSizeOverrides({})
    setGlobalMulX(1)
    setGlobalMulY(1)
  }

  useEffect(() => {
    if (tab !== 'labels' || !(selectedCount > 0 || editAll)) return
    const onPointerDownOutside = (ev) => {
      const target = ev.target
      if (!(target instanceof HTMLElement)) return
      if (drawerRef.current && drawerRef.current.contains(target)) return
      if (target.closest('.sheet-viewport')) return
      if (target.closest('[data-label-idx]')) return
      closeSelectionPanel()
    }
    window.addEventListener('pointerdown', onPointerDownOutside, true)
    return () => window.removeEventListener('pointerdown', onPointerDownOutside, true)
  }, [tab, selectedCount, editAll])

  return (
    <div ref={rootRef} className="container" onWheelCapture={onNumberWheelCapture}>
      <div className="tabs no-print">
        {['generator','batch','labels'].map(tabKey => (
          <div key={tabKey} className={'tab '+(tab===tabKey?'active':'')} onClick={()=>setTab(tabKey)}>
            {tabKey==='generator'?t('app.tabs.generator'):tabKey==='batch'?t('app.tabs.batch'):t('app.tabs.labels')}
          </div>
        ))}
      </div>

      {tab==='generator' && (
        <GeneratorTab
          t={t}
          popularCodeIds={POPULAR_CODE_IDS}
          is2dSet={TWO_D_SET}
          bcid={bcid}
          setBcid={setBcid}
          text={text}
          setText={setText}
          scale={scale}
          setScale={setScale}
          height={height}
          setHeight={setHeight}
          includeText={includeText}
          setIncludeText={setIncludeText}
          rotate={rotate}
          setRotate={setRotate}
          hrtFont={hrtFont}
          setHrtFont={setHrtFont}
          addCurrentToLabels={addCurrentToLabels}
          pngMul={pngMul}
          setPngMul={setPngMul}
          downloadWhiteBg={downloadWhiteBg}
          setDownloadWhiteBg={setDownloadWhiteBg}
          makeBitmap={makeBitmap}
          toSvg={toSvg}
          genPreviewUrl={genPreviewUrl}
          error={error}
          gs1Report={gs1Report}
        />
      )}

      {tab==='batch' && (
        <BatchTab
          t={t}
          popularCodeIds={POPULAR_CODE_IDS}
          parseCsv={parseCsv}
          parseLines={parseLines}
          batchInput={batchInput}
          setBatchInput={setBatchInput}
          batchRows={batchRows}
          setBatchRows={setBatchRows}
          batchBcid={batchBcid}
          setBatchBcid={setBatchBcid}
          addAllFromBatch={addAllFromBatch}
          setLabels={setLabels}
          setTab={setTab}
          scale={scale}
          height={height}
          notify={notify}
        />
      )}

      {tab==='labels' && (
        <>
          <LabelsTab
            t={t}
            presets={PRESETS}
            popularCodeIds={POPULAR_CODE_IDS}
            layout={{
              presetKey, setPresetKey, pageW, setPageW, pageH, setPageH, cols, setCols, rows, setRows,
              selectedIdx, padMM, setPadMM,
              gapMM, setGapMM, skip, setSkip, pageScale, setPageScale, pageRotate, setPageRotate,
              showGrid, setShowGrid, editMode, setEditMode, freeLayout, setFreeLayout, editAll, lockAspect,
              setLockAspect, globalMulX, setGlobalMulX, globalMulY, setGlobalMulY, snapMM, setSnapMM,
              posOverrides, labels, perPage, pages, sheetZoom, viewportRef, contentRef, pdfQuality, setPdfQuality,
            }}
            actions={{
              setLabels, notify, onToggleEditAll, defaultPosForIndex, clampPos, snapPos, setPosOverrides,
              clampPosToCell, setZoomCentered, exportPdf, resetLayoutDefaults, clearLabels, metrics,
              nodeSizeMM, renderLabelPages, onSheetPointerDownCapture, marqueeRect,
            }}
          />
          <div className={'selection-drawer no-print ' + ((selectedCount>0 || editAll) ? 'open' : '')}>
            <div ref={drawerRef} className="selection-drawer-inner">
              <label className="hstack small">
                <input type="checkbox" checked={editAll} onChange={(e)=>onToggleEditAll(e.target.checked)} />
                {t('labels.editAll')}
              </label>
              <div className="small">
                {editAll ? t('labels.scopeAll', { count: targetCount }) : t('labels.selectedCount', { count: selectedCount })}
              </div>
              <div className="hstack" style={{ alignItems:'center' }}>
                <span className="small">{t('labels.widthShort')}</span>
                <input className="input" type="range" min="0.2" max="5" step="0.05" value={panelMulX} onChange={(e)=>setSelectionMulX(parseFloat(e.target.value||'1'))} style={{ width: 180 }} />
                <input className="input" type="number" min="0.2" max="5" step="0.1" value={panelMulX} onChange={(e)=>setSelectionMulX(parseFloat(e.target.value||'1'))} style={{ width: 74 }} />
              </div>
              <div className="hstack" style={{ alignItems:'center' }}>
                <span className="small">{t('labels.heightShort')}</span>
                <input className="input" type="range" min="0.2" max="5" step="0.05" value={panelMulY} onChange={(e)=>setSelectionMulY(parseFloat(e.target.value||'1'))} style={{ width: 180 }} />
                <input className="input" type="number" min="0.2" max="5" step="0.1" value={panelMulY} onChange={(e)=>setSelectionMulY(parseFloat(e.target.value||'1'))} style={{ width: 74 }} />
              </div>
              <select className="select" value={panelBcid} onChange={(e)=>setSelectionBcid(e.target.value)} style={{ minWidth: 180 }}>
                {POPULAR_CODE_IDS.map((id) => <option key={id} value={id}>{t(`codes.${id.replace('-', '_')}.label`)}</option>)}
              </select>
              <label className="hstack small">
                <input type="checkbox" checked={panelIncludeText} onChange={(e)=>setSelectionIncludeText(e.target.checked)} />
                {t('labels.includeText')}
              </label>
              <input className="input" type="text" value={panelText} disabled={editAll} onChange={(e)=>setSelectionText(e.target.value)} placeholder={editAll ? t('labels.textDisabledInEditAll') : t('labels.codeContent')} style={{ minWidth: 220, opacity: editAll ? 0.55 : 1 }} />
              <button className="button" onClick={resetSelectionChanges}>{t('labels.resetChanges')}</button>
              <button className="button" onClick={closeSelectionPanel}>{t('labels.clearSelection')}</button>
            </div>
          </div>
        </>
      )}

      {!!toast && <div className="toast">{toast}</div>}
    </div>
  )
}
