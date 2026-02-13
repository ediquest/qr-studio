import React, { useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { parseLines, parseCsv } from '../utils/batch.js'
import { PRESETS } from '../utils/layouts.js'
import { TWO_D_SET, fitRect, getImageSize, getSvgSize, hasToSVG, makeBitmap, resolveBcid, toSvg } from '../utils/barcodeRender.js'
import { useI18n } from '../i18n.jsx'
import useGeneratorState from './barcode-studio/hooks/useGeneratorState.js'
import useLabelsLayoutState from './barcode-studio/hooks/useLabelsLayoutState.js'
import GeneratorTab from './barcode-studio/tabs/GeneratorTab.jsx'
import BatchTab from './barcode-studio/tabs/BatchTab.jsx'
import LabelsTab from './barcode-studio/tabs/LabelsTab.jsx'

const POPULAR_CODE_IDS = ['qrcode','code128','ean13','ean8','itf14','gs1-128','datamatrix','azteccode','pdf417'];
const ONE_D_HEIGHT_RATIO = 0.65  // portion of cellH used for 1D in Free layout

export default function BarcodeStudio() {
  const [tab, setTab] = useState('generator')
  const [toast, setToast] = useState('')
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
    hoverCell,
    setHoverCell,
    snapMM,
    setSnapMM,
    selectedIdx,
    setSelectedIdx,
    sheetBcid,
    setSheetBcid,
    changeAllCodes,
    setChangeAllCodes,
    perPage,
    pages,
  } = useLabelsLayoutState({ presets: PRESETS })

  function notify(msg){ setToast(msg); setTimeout(()=>setToast(''), 1400) }
  function addCurrentToLabels(){ setLabels(prev => [...prev, { bcid, text, scale, height }]); notify('Dodano 1 etykiete') }
  function addAllFromBatch(rows){ const toAdd = rows.map(r => ({ bcid: batchBcid, text: r, scale, height })); if (!toAdd.length) return; setLabels(prev => [...prev, ...toAdd]); setTab('labels'); notify(`Dodano ${toAdd.length} etykiet`) }
  function clearLabels(){ setLabels([]); setSizeOverrides({}); setPosOverrides({}); notify('Wyczyszczono arkusze') }

  function effMul(idx, axis){ const o = sizeOverrides[idx] || {x:1,y:1}; if (editAll) return axis==='x'?globalMulX:globalMulY; return axis==='x'?o.x:o.y }

  let lastError='';
  function makeLabelSvg(item, idx){
    const opts = { bcid: resolveBcid(item.bcid), text: item.text, rotate: pageRotate||0 }
    const base = (Number(item.scale)||3) * (Number(pageScale)||1)
    if (TWO_D_SET.has(item.bcid)) { opts.scaleX=base; opts.scaleY=base }
    else { opts.scaleX=base; const mulY=effMul(idx,'y'); opts.height=Math.round(((Number(item.height)||50)*(Number(pageScale)||1)*mulY)); opts.includetext=true; opts.textxalign='center'; opts.textfont=hrtFont }
    if (hasToSVG()) return toSvg(opts)
    return null
  }

  // metrics helpers
  function metrics(){ const innerW=pageW-2*padMM, innerH=pageH-2*padMM; const cellW=(innerW-(cols-1)*gapMM)/cols; const cellH=(innerH-(rows-1)*gapMM)/rows; return {innerW,innerH,cellW,cellH} }

  // grid drag (swap)
  const dragRef = useRef({ active:false, fromGlobal:null, toGlobal:null, pointerId:null })
  function startPointerDrag(e, globalCellIndex){
    if (!editMode || freeLayout) return
    if (e.target?.dataset?.resize === '1') return
    dragRef.current = { active:true, fromGlobal: globalCellIndex, toGlobal: globalCellIndex, pointerId: e.pointerId }
    setHoverCell(globalCellIndex)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch(_){}
    const onMove = (ev) => {
      if (!dragRef.current.active) return
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const cell = el && el.closest && el.closest('[data-cell-index]')
      if (cell) { const to = parseInt(cell.getAttribute('data-cell-index')||'-1',10); if (!isNaN(to)) { dragRef.current.toGlobal = to; setHoverCell(to) } }
    }
    const onUp = () => {
      const { fromGlobal, toGlobal } = dragRef.current
      dragRef.current = { active:false, fromGlobal:null, toGlobal:null, pointerId:null }
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); setHoverCell(null)
      if (fromGlobal==null || toGlobal==null || fromGlobal===toGlobal) return
      const fromIdx = fromGlobal - skip; const toIdx = toGlobal - skip
      setLabels(prev => { const arr = prev.slice(); if (!(fromIdx>=0 && fromIdx<arr.length)) return prev; const [item] = arr.splice(fromIdx,1); arr.splice(Math.max(0, Math.min(toIdx, arr.length)), 0, item); return arr })
    }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
    e.preventDefault()
  }

  // free layout drag (absolute)
  const absRef = useRef({ active:false, idx:null, start:{x:0,y:0}, orig:{x:0,y:0}, pageIdx:0 })
  
  
  
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
    return { w: cellW*mulX, h }
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
    // strip engine prefixes e.g. "bwipp.ean13badLength#4907:" or "bwip-js.ean13badLength:" and "Error:"/"BĹ‚Ä…d:"
    let s = raw
      .replace(/^(?:BĹ‚Ä…d|Blad|Error)\s*:\s*/i,'')
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
      'isbn10badlength': 'ISBN-10 musi mieÄ‡ 9 lub 10 cyfr (bez myĹ›lnikĂłw)',
      'isbn13badlength': 'ISBN-13 musi mieÄ‡ 12 lub 13 cyfr (bez myĹ›lnikĂłw)',
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

    // Heurystyczne tĹ‚umaczenie popularnych zwrotĂłw
    s = s.replace(/\bmust be\b/gi,'musi mieÄ‡')
         .replace(/\bshould be\b/gi,'powinno mieÄ‡')
         .replace(/\bdigits?\b/gi,'cyfr')
         .replace(/\binvalid\b/gi,'nieprawidĹ‚owy')
         .replace(/\btoo long\b/gi,'za dĹ‚ugi')
         .replace(/\btoo short\b/gi,'za krĂłtki')
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
                    const svgStr = makeLabelSvg(item, idx)
                    if (svgStr) imgSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgStr)
                    else imgSrc = TWO_D_SET.has(item.bcid)
                      ? makeBitmap({ bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0, scaleX: (Number(item.scale)||3)*(Number(pageScale)||1), scaleY: (Number(item.scale)||3)*(Number(pageScale)||1) })
                      : makeBitmap({ bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0, scaleX: (Number(item.scale)||3)*(Number(pageScale)||1), height: Math.round(((Number(item.height)||50)*(Number(pageScale)||1)*(editAll?globalMulY:((sizeOverrides[idx]?.y)||1)))), includetext:true, textxalign:'center' })
                  } catch(e){ console.error('Label render error', e); imgSrc='ERROR'; lastError=cleanBwipError(e) }
                }
                const mulX = editAll?globalMulX:((sizeOverrides[idx]?.x)||1)
                const mulY = editAll?globalMulY:((sizeOverrides[idx]?.y)||1)
                const globalCellIndex = p*perPageLocal + i;
                return (
                  <div key={i} className={"label-cell "+(hoverCell===globalCellIndex?"cell-highlight":"")} data-cell-index={globalCellIndex}
                       onPointerDown={(e)=>startPointerDrag(e, globalCellIndex)}
                       style={{position:'relative', borderStyle: showGrid?'dashed':'none', cursor: editMode && item ? (dragRef.current.active?'grabbing':'grab') : 'default', overflow:'hidden', touchAction:'none', userSelect:'none'}}>
                    {(() => {
                      if (imgSrc && imgSrc!=='ERROR') {
                        const wrapW = (mulX*100)+'%'; const wrapH = (TWO_D_SET.has(item?.bcid||'') ? (mulY*100)+'%' : '100%');
                        return (
                          <div className="barcode-wrap" style={{position:'relative', width:wrapW, height:wrapH, display:'flex', alignItems:'center', justifyContent:'center'}}>
                            <img src={imgSrc} alt="barcode" draggable={false} style={{maxWidth:'100%',maxHeight:'100%', pointerEvents:'none'}} />
                            {editMode && (<div title="Skaluj proporcjonalnie" data-resize="1" onPointerDown={(e)=>startResize(e, idx, 'both')} style={{position:'absolute', right:2, bottom:2, width:16, height:16, border:'1px solid #475569', background:'#e2e8f0', borderRadius:4, cursor:'nwse-resize', display:'grid', placeItems:'center', fontSize:10, color:'#334155', zIndex:2}}>â—˘</div>)}
                          </div>
                        )
                      }
                      return (imgSrc==='ERROR' ? <span className="small" style={{color:'#b91c1c'}}>bĹ‚Ä…d</span> : <span className="small">pusta</span>)
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
                  const svgStr = makeLabelSvg(item, idx)
                  if (svgStr) imgSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgStr)
                  else imgSrc = TWO_D_SET.has(item.bcid)
                    ? makeBitmap({ bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0, scaleX: (Number(item.scale)||3)*(Number(pageScale)||1), scaleY: (Number(item.scale)||3)*(Number(pageScale)||1) })
                    : makeBitmap({ bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0, scaleX: (Number(item.scale)||3)*(Number(pageScale)||1), height: Math.round(((Number(item.height)||50)*(Number(pageScale)||1)*(editAll?globalMulY:((sizeOverrides[idx]?.y)||1)))), includetext:true, textxalign:'center' })
                } catch(e){ console.error('Label render error', e); imgSrc='ERROR'; lastError=cleanBwipError(e) }
                const mulX = editAll?globalMulX:((sizeOverrides[idx]?.x)||1); const mulY = editAll?globalMulY:((sizeOverrides[idx]?.y)||1)
                const drawW = (cellW*mulX); const drawH = (TWO_D_SET.has(item.bcid)? (cellH*mulY) : (cellH*mulY*ONE_D_HEIGHT_RATIO))
                return (
                  <div key={i} className={"free-node" + (selectedIdx===idx?" cell-highlight":"")} style={{position:'absolute', left: pos.x+'mm', top: pos.y+'mm', width: drawW+'mm', height: drawH+'mm', cursor: editMode?'move':'default', touchAction:'none', userSelect:'none'}}
                       onPointerDown={(e)=> { setSelectedIdx(idx); startFreeDrag(e, idx, p) } } onClick={()=>setSelectedIdx(idx)}>
                    {imgSrc && imgSrc!=='ERROR' ? (
                      <div className="barcode-wrap" style={{position:'relative', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <img src={imgSrc} alt="barcode" draggable={false} style={{maxWidth:'100%',maxHeight:'100%', pointerEvents:'none'}} />
                        {editMode && (<div title="Skaluj proporcjonalnie" data-resize="1" onPointerDown={(e)=>startResize(e, idx, 'both')} style={{position:'absolute', right:2, bottom:2, width:16, height:16, border:'1px solid #475569', background:'#e2e8f0', borderRadius:4, cursor:'nwse-resize', display:'grid', placeItems:'center', fontSize:10, color:'#334155', zIndex:2}}>â—˘</div>)}
                      </div>
                    ) : (imgSrc==='ERROR' ? <span className="small" style={{color:'#b91c1c'}}>bĹ‚Ä…d</span> : <span className="small">pusta</span>)}
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

  function startResize(e, labelIndex, axis='both'){
    if (!editMode) return
    const startX = e.clientX; const startY = e.clientY
    const wrapEl = e.currentTarget && e.currentTarget.parentElement
    const rect = wrapEl ? wrapEl.getBoundingClientRect() : { width: 250, height: 250 }
    const startW = Math.max(1, rect.width)
    const startH = Math.max(1, rect.height)
    const base = sizeOverrides[labelIndex] || { x:1, y:1 }
    const baseX = editAll ? globalMulX : base.x; const baseY = editAll ? globalMulY : base.y
    function onMove(ev){
      const dx = (ev.clientX - startX); const dy = (ev.clientY - startY)
      let newX = baseX, newY = baseY
      if (axis==='x') newX = Math.max(0.2, Math.min(5, baseX * (1 + dx / startW)))
      else if (axis==='y') newY = Math.max(0.2, Math.min(5, baseY * (1 + dy / startH)))
      else {
        const scale = 1 + Math.max(dx / startW, dy / startH)
        const clamped = Math.max(0.2, Math.min(5, scale))
        newX = Math.max(0.2, Math.min(5, baseX * clamped))
        newY = Math.max(0.2, Math.min(5, baseY * clamped))
      }
      if (editAll){ setGlobalMulX(newX); setGlobalMulY(lockAspect?newX:newY) }
      else { setSizeOverrides(prev => ({ ...prev, [labelIndex]: { x:newX, y: (lockAspect && axis!=='x') ? newX : newY } })) }
    }
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch(_){}
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); e.preventDefault(); e.stopPropagation()
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
    setEditMode(false);
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
    setHoverCell(null);
  }

  async function exportPdf(){
  const dpiMul = 3; // render denser bitmap for PDF to avoid pixelated HRT
  try {
    const orientation = pageW >= pageH ? 'l' : 'p';
    await (document?.fonts?.ready || Promise.resolve());
    const pdf = new jsPDF({ unit:'mm', format:[pageW,pageH], orientation });
    const { innerW, innerH, cellW, cellH } = metrics();

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
          drawW = cellW*mulX; drawH = (TWO_D_SET.has(item.bcid)? (cellH*mulY) : (cellH*mulY));
          x = padMM + innerX + (cellW - drawW)/2; y = padMM + innerY + (cellH - drawH)/2;
        } else {
          const col = i % cols; const row = Math.floor(i / cols);
          const defX = col*(cellW+gapMM); const defY = row*(cellH+gapMM);
          const pos = posOverrides[idx] || { x:defX, y:defY };
          drawW = cellW*mulX; drawH = (TWO_D_SET.has(item.bcid)? (cellH*mulY) : (cellH*mulY));
          x = padMM + pos.x; y = padMM + pos.y;
        }

        // Prefer vector SVG when available â€“ keeps edges and text crisp
        let usedVector = false;
        if (hasToSVG() && typeof window.svg2pdf === 'function') {
          try {
            const optsSvg = { bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0 };
            const baseSvg = (Number(item.scale)||3) * (Number(pageScale)||1);
            const heightSvg = Math.round((Number(item.height)||50) * (Number(pageScale)||1) * (editAll?globalMulY:((sizeOverrides[idx]?.y)||1)));
            if (TWO_D_SET.has(item.bcid)) { optsSvg.scaleX=baseSvg; optsSvg.scaleY=baseSvg; }
            else { optsSvg.scaleX=baseSvg; optsSvg.height=heightSvg; optsSvg.includetext=true; optsSvg.textxalign='center'; optsSvg.textfont=hrtFont; }
            const svgStr = toSvg(optsSvg);
            if (svgStr){
              const svgEl = new DOMParser().parseFromString(svgStr, 'image/svg+xml').documentElement;
              const size = getSvgSize(svgStr);
              const fit = (is2d && size) ? fitRect(x, y, drawW, drawH, size.w, size.h) : { x, y, w: drawW, h: drawH };
              window.svg2pdf(svgEl, pdf, {x: fit.x, y: fit.y, width: fit.w, height: fit.h});
              usedVector = true;
            }
          } catch(_){ usedVector = false; }
        }

        if (!usedVector) {
          // Highâ€‘DPI bitmap fallback to keep HRT sharp
          const base = ((Number(item.scale)||3) * (Number(pageScale)||1)) * dpiMul;
          const opts = { bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0 };
          if (TWO_D_SET.has(item.bcid)) { opts.scaleX=base; opts.scaleY=base; }
          else {
            opts.scaleX = base;
            opts.height = Math.round((Number(item.height)||50) * (Number(pageScale)||1) * (editAll?globalMulY:((sizeOverrides[idx]?.y)||1)));
            opts.includetext=true; opts.textxalign='center'; opts.textfont=hrtFont;
          }
          const png = makeBitmap(opts);
          const size = await getImageSize(png);
          const fit = (is2d && size) ? fitRect(x, y, drawW, drawH, size.w, size.h) : { x, y, w: drawW, h: drawH };
          pdf.addImage(png, 'PNG', fit.x, fit.y, fit.w, fit.h);
        }
      } // end perPage
    } // end pages

    pdf.save('labels.pdf');
  } catch(e) {
    alert('BĹ‚Ä…d eksportu PDF: '+(e?.message||e));
  }
}
  return (
    <div className="container">
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
        <LabelsTab
          t={t}
          presets={PRESETS}
          popularCodeIds={POPULAR_CODE_IDS}
          layout={{
            presetKey, setPresetKey, pageW, setPageW, pageH, setPageH, cols, setCols, rows, setRows,
            sheetBcid, setSheetBcid, changeAllCodes, setChangeAllCodes, selectedIdx, padMM, setPadMM,
            gapMM, setGapMM, skip, setSkip, pageScale, setPageScale, pageRotate, setPageRotate,
            showGrid, setShowGrid, editMode, setEditMode, freeLayout, setFreeLayout, editAll, lockAspect,
            setLockAspect, globalMulX, setGlobalMulX, globalMulY, setGlobalMulY, snapMM, setSnapMM,
            posOverrides, labels, perPage, pages, sheetZoom, viewportRef, contentRef,
          }}
          actions={{
            setLabels, notify, onToggleEditAll, defaultPosForIndex, clampPos, snapPos, setPosOverrides,
            clampPosToCell, setZoomCentered, exportPdf, resetLayoutDefaults, clearLabels, metrics,
            nodeSizeMM, renderLabelPages,
          }}
        />
      )}

      {!!toast && <div className="toast">{toast}</div>}

    </div>
  )
}






