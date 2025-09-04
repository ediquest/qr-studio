import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as bw from 'bwip-js'
import { jsPDF } from 'jspdf'
import { validateGs1 } from '../utils/gs1.js'
import { parseLines, parseCsv, generateSequence, detectNumericRun } from '../utils/batch.js'
import { PRESETS } from '../utils/layouts.js'
import { useI18n } from '../i18n.jsx'

const POPULAR_CODE_IDS = ['qrcode','code128','ean13','ean8','upca','code39','itf14','gs1-128','datamatrix','pdf417','azteccode','upce','code93','code11','msi','codabar','interleaved2of5','standard2of5','postnet','planet','usps4cb','rm4scc','pharmacode','pharmacode2','isbn','issn','ismn'];
// Aliases for bwip-js encoder names (to match UI ids)
const BCID_ALIASES = {
  'rm4scc': 'royalmail',  // RM4SCC (Royal Mail/KIX) encoder name in bwip-js
  // add future aliases here if needed
};
const resolveBcid = (id) => BCID_ALIASES[id] || id;

const TWO_D_SET = new Set(['qrcode','datamatrix','pdf417','azteccode'])
const ONE_D_HEIGHT_RATIO = 0.65  // portion of cellH used for 1D in Free layout

function Field({ label, children }) { return (<div className="vstack"><label className="small">{label}</label>{children}</div>) }
function Toolbar({ children }) { return <div className="hstack">{children}</div> }

// helpers
function rotCode(deg){ const m={0:'N',90:'R',180:'I',270:'L'}; return m[deg] ?? 'N'; }
function hasToSVG(){ try { return typeof bw.toSVG==='function' || typeof bw.toSvg==='function' } catch(_) { return false } }
function toSvg(opts){
  const fn = bw.toSVG || bw.toSvg
  if (!fn) throw new Error('bwip-js: toSVG not available')
  return fn({ ...opts, rotate: rotCode(opts.rotate||0) })
}
function toCanvasFn(){ return bw.toCanvas || bw.toCanvas ? bw.toCanvas : null }
function makeBitmap(opts){
  const canvas = document.createElement('canvas')
  canvas.width = 1600; canvas.height = 1600
  const fn = bw.toCanvas
  if (!fn) throw new Error('bwip-js: toCanvas not available')
  const safe = { ...opts, rotate: rotCode(opts.rotate||0) }
  fn(canvas, safe)
  return canvas.toDataURL('image/png')
}

export default function BarcodeStudio() {
  const [tab, setTab] = useState('generator')
  const [toast, setToast] = useState('')
  const { t, lang } = useI18n()

  // generator
  const [bcid, setBcid] = useState('qrcode')
  const [text, setText] = useState('DOCK.001')
  const [scale, setScale] = useState(4)
  const [height, setHeight] = useState(50)
  const [includeText, setIncludeText] = useState(true)
  const [hrtFont, setHrtFont] = useState('Helvetica')
  const [rotate, setRotate] = useState(0)
  const [error, setError] = useState('')
  const [genPreviewUrl, setGenPreviewUrl] = useState('')
  const [pngMul, setPngMul] = useState(4)

  useEffect(()=>{
    try{
      const saved = JSON.parse(localStorage.getItem('rbs_gen')||'null')
      if(saved){ setBcid(saved.bcid||'qrcode'); setText(typeof saved.text==='string'?saved.text:''); setScale(+saved.scale||4); setHeight(+saved.height||50); setIncludeText(!!saved.includeText); setRotate(+saved.rotate||0); if(saved.hrtFont) setHrtFont(saved.hrtFont) }
      const u = localStorage.getItem('rbs_gen_url'); if(u) setGenPreviewUrl(u)
      const pm = parseInt(localStorage.getItem('rbs_pngmul')||'4',10); if(!Number.isNaN(pm)) setPngMul(pm)
    }catch(_){}
  },[])
  useEffect(()=>{ try{ localStorage.setItem('rbs_gen', JSON.stringify({ bcid, text, scale, height, includeText, rotate, hrtFont })) }catch(_){ } }, [bcid,text,scale,height,includeText,rotate,hrtFont])
  useEffect(()=>{ try{ localStorage.setItem('rbs_pngmul', String(pngMul)) }catch(_){ } }, [pngMul])

  useEffect(()=>{
    try{
      const opts = { bcid, text: normalizeInput(bcid, text || ''), rotate }
      const base = (Number(scale)||3)
      if (TWO_D_SET.has(bcid)) { opts.scaleX=base; opts.scaleY=base; }
      else { opts.scaleX=base; opts.height=Number(height)||50; if (includeText){ opts.includetext=true; opts.textxalign='center' } }
      try { const svg = toSvg(opts); const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); setGenPreviewUrl(url); localStorage.setItem('rbs_gen_url', url); setError('') }
      catch(_) { const png = makeBitmap(opts); setGenPreviewUrl(png); localStorage.setItem('rbs_gen_url', png); setError('') }
    }catch(e){ setError(cleanBwipError(e)) }
  }, [bcid, text, scale, height, includeText, rotate])

  // batch
  const [batchInput, setBatchInput] = useState('')
  const [batchRows, setBatchRows] = useState([])
  const [batchBcid, setBatchBcid] = useState('code128')
  const [seqPattern, setSeqPattern] = useState('DOCK.001')
  const [seqCount, setSeqCount] = useState(10)
  const [seqStep, setSeqStep] = useState(1)
  const det = detectNumericRun(seqPattern)
  const [seqStart, setSeqStart] = useState(det ? det.start : 1)
  const [seqPad, setSeqPad] = useState(det ? det.width : 3)
  useEffect(()=>{ const d=detectNumericRun(seqPattern); if(d){ setSeqStart(d.start); setSeqPad(d.width) } }, [seqPattern])

  // labels & layout
  const [labels, setLabels] = useState([])
  const [skip, setSkip] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editAll, setEditAll] = useState(false)
  const [globalMulX, setGlobalMulX] = useState(1)
  const [globalMulY, setGlobalMulY] = useState(1)
  const [lockAspect, setLockAspect] = useState(false)
  const [sizeOverrides, setSizeOverrides] = useState({}) // idx -> {x,y}
  const [posOverrides, setPosOverrides] = useState({}) // idx -> {x,y} in mm (free layout)
  const [freeLayout, setFreeLayout] = useState(false)
  const [presetKey, setPresetKey] = useState(PRESETS[0].key)
  const preset = PRESETS.find(p=>p.key===presetKey) || PRESETS[0]
  const [cols, setCols] = useState(preset.cols)
  const [rows, setRows] = useState(preset.rows)
  const [pageW, setPageW] = useState(preset.pageW)
  const [pageH, setPageH] = useState(preset.pageH)
  const [gapMM, setGapMM] = useState(preset.gapMM)
  const [padMM, setPadMM] = useState(preset.padMM)
  const [pageRotate, setPageRotate] = useState(0)
  const [pageScale, setPageScale] = useState(1)
  const [sheetZoom, setSheetZoom] = useState(1)
  const viewportRef = useRef(null)
  const contentRef = useRef(null)
  const [hoverCell, setHoverCell] = useState(null)

  const [snapMM, setSnapMM] = useState(0); // 0=off, 1,2,5
  const [selectedIdx, setSelectedIdx] = useState(null);


  useEffect(()=>{ setCols(preset.cols); setRows(preset.rows); setPageW(preset.pageW); setPageH(preset.pageH); setGapMM(preset.gapMM); setPadMM(preset.padMM) }, [presetKey])

  const gs1Report = useMemo(() => { if (bcid !== 'gs1-128' && bcid !== 'qrcode' && bcid !== 'datamatrix') return null; if (!text.includes('(')) return null; return validateGs1(text) }, [text, bcid])

  function notify(msg){ setToast(msg); setTimeout(()=>setToast(''), 1400) }
  function addCurrentToLabels(){ setLabels(prev => [...prev, { bcid, text, scale, height }]); setTab('labels'); notify('Dodano 1 etykietę') }
  function addAllFromBatch(rows){ const toAdd = rows.map(r => ({ bcid: batchBcid, text: r, scale, height })); if (!toAdd.length) return; setLabels(prev => [...prev, ...toAdd]); setTab('labels'); notify(`Dodano ${toAdd.length} etykiet`) }
  function clearLabels(){ setLabels([]); setSizeOverrides({}); setPosOverrides({}); notify('Wyczyszczono arkusze') }

  const perPage = Math.max(1, (cols|0) * (rows|0))
  const totalCells = (skip|0) + labels.length
  const pages = Math.ceil(totalCells / perPage) || 1

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
    // strip engine prefixes e.g. "bwipp.ean13badLength#4907:" or "bwip-js.ean13badLength:" and "Error:"/"Błąd:"
    let s = raw
      .replace(/^(?:Błąd|Blad|Error)\s*:\s*/i,'')
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
      'isbn10badlength': 'ISBN-10 musi mieć 9 lub 10 cyfr (bez myślników)',
      'isbn13badlength': 'ISBN-13 musi mieć 12 lub 13 cyfr (bez myślników)',
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

    // Heurystyczne tłumaczenie popularnych zwrotów
    s = s.replace(/\bmust be\b/gi,'musi mieć')
         .replace(/\bshould be\b/gi,'powinno mieć')
         .replace(/\bdigits?\b/gi,'cyfr')
         .replace(/\binvalid\b/gi,'nieprawidłowy')
         .replace(/\btoo long\b/gi,'za długi')
         .replace(/\btoo short\b/gi,'za krótki')
         .replace(/[.:\s]+$/,'')
         .trim();
    return s;
  }

  function normalizeInput(bcid, value){
    let v = (value || '').toString().trim();
    if (['ean13','ean8','upca','upce','itf14','isbn','isbn10','isbn13','postnet','kix','itf'].some(x=>bcid.startsWith(x))) {
      v = v.replace(/[^0-9]/g,'');
    }
    return v;
  }
function renderLabelPages(){
    const out = []; const perPageLocal = perPage; const { innerW, innerH, cellW, cellH } = metrics()
    for (let p=0; p<pages; p++) {
      if (!freeLayout){
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
                       style={{position:'relative', borderStyle: showGrid?'dashed':'none', cursor: editMode && item ? (dragRef.current.active?'grabbing':'grab') : 'default', overflow: editMode ? 'visible' : 'hidden', touchAction:'none', userSelect:'none'}}>
                    {(() => {
                      if (imgSrc && imgSrc!=='ERROR') {
                        const wrapW = (mulX*100)+'%'; const wrapH = (TWO_D_SET.has(item?.bcid||'') ? (mulY*100)+'%' : '100%');
                        return (
                          <div className="barcode-wrap" style={{position:'relative', width:wrapW, height:wrapH, display:'flex', alignItems:'center', justifyContent:'center'}}>
                            <img src={imgSrc} alt="barcode" draggable={false} style={{maxWidth:'100%',maxHeight:'100%', pointerEvents:'none'}} />
                            {editMode && (<div title="Skaluj proporcjonalnie" data-resize="1" onPointerDown={(e)=>startResize(e, idx, 'both')} style={{position:'absolute', right:-6, bottom:-6, width:16, height:16, border:'1px solid #475569', background:'#e2e8f0', borderRadius:4, cursor:'nwse-resize', display:'grid', placeItems:'center', fontSize:10, color:'#334155', zIndex:2}}>◢</div>)}
                          </div>
                        )
                      }
                      return (imgSrc==='ERROR' ? <span className="small" style={{color:'#b91c1c'}}>błąd</span> : <span className="small">pusta</span>)
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
                        {editMode && (<div title="Skaluj proporcjonalnie" data-resize="1" onPointerDown={(e)=>startResize(e, idx, 'both')} style={{position:'absolute', right:-6, bottom:-6, width:16, height:16, border:'1px solid #475569', background:'#e2e8f0', borderRadius:4, cursor:'nwse-resize', display:'grid', placeItems:'center', fontSize:10, color:'#334155', zIndex:2}}>◢</div>)}
                      </div>
                    ) : (imgSrc==='ERROR' ? <span className="small" style={{color:'#b91c1c'}}>błąd</span> : <span className="small">pusta</span>)}
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
    const base = sizeOverrides[labelIndex] || { x:1, y:1 }
    const baseX = editAll ? globalMulX : base.x; const baseY = editAll ? globalMulY : base.y
    function onMove(ev){
      const dx = (ev.clientX - startX); const dy = (ev.clientY - startY)
      let newX = baseX, newY = baseY
      if (axis==='x') newX = Math.max(0.2, Math.min(5, baseX + dx/250))
      else if (axis==='y') newY = Math.max(0.2, Math.min(5, baseY + dy/250))
      else { const d = (dx+dy)/250; newX = Math.max(0.2, Math.min(5, baseX + d)); newY = Math.max(0.2, Math.min(5, baseY + d)) }
      if (editAll){ setGlobalMulX(newX); setGlobalMulY(lockAspect?newX:newY) }
      else { setSizeOverrides(prev => ({ ...prev, [labelIndex]: { x:newX, y: (lockAspect && axis!=='x') ? newX : newY } })) }
    }
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
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
        let x, y, drawW, drawH;
        const mulX = editAll?globalMulX:((sizeOverrides[idx]?.x)||1);
        const mulY = editAll?globalMulY:((sizeOverrides[idx]?.y)||1);
        if (!freeLayout){
          const col = i % cols; const row = Math.floor(i / cols);
          const innerX = col*(cellW+gapMM); const innerY = row*(cellH+gapMM);
          drawW = cellW*mulX; drawH = (TWO_D_SET.has(item.bcid)? (cellH*mulY) : (cellH*mulY*ONE_D_HEIGHT_RATIO));
          x = padMM + innerX + (cellW - drawW)/2; y = padMM + innerY + (cellH - drawH)/2;
        } else {
          const col = i % cols; const row = Math.floor(i / cols);
          const defX = col*(cellW+gapMM); const defY = row*(cellH+gapMM);
          const pos = posOverrides[idx] || { x:defX, y:defY };
          drawW = cellW*mulX; drawH = (TWO_D_SET.has(item.bcid)? (cellH*mulY) : (cellH*mulY*ONE_D_HEIGHT_RATIO));
          x = padMM + pos.x; y = padMM + pos.y;
        }

        // Prefer vector SVG when available – keeps edges and text crisp
        let usedVector = false;
        if (hasToSVG() && typeof window.svg2pdf === 'function') {
          try {
            const optsSvg = { bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0 };
            const baseSvg = (Number(item.scale)||3) * (Number(pageScale)||1);
            if (TWO_D_SET.has(item.bcid)) { optsSvg.scaleX=baseSvg; optsSvg.scaleY=baseSvg; }
            else { optsSvg.scaleX=baseSvg; optsSvg.includetext=true; optsSvg.textxalign='center'; optsSvg.textfont=hrtFont; }
            const svgStr = toSvg(optsSvg);
            if (svgStr){
              const svgEl = new DOMParser().parseFromString(svgStr, 'image/svg+xml').documentElement;
              window.svg2pdf(svgEl, pdf, {x, y, width: drawW, height: drawH});
              usedVector = true;
            }
          } catch(_){ usedVector = false; }
        }

        if (!usedVector) {
          // High‑DPI bitmap fallback to keep HRT sharp
          const base = ((Number(item.scale)||3) * (Number(pageScale)||1)) * dpiMul;
          const opts = { bcid: resolveBcid(item.bcid), text:item.text, rotate:pageRotate||0 };
          if (TWO_D_SET.has(item.bcid)) { opts.scaleX=base; opts.scaleY=base; }
          else {
            opts.scaleX = base;
            opts.includetext=true; opts.textxalign='center'; opts.textfont=hrtFont;
          }
          const png = makeBitmap(opts);
          pdf.addImage(png, 'PNG', x, y, drawW, drawH);
        }
      } // end perPage
    } // end pages

    pdf.save('labels.pdf');
  } catch(e) {
    alert('Błąd eksportu PDF: '+(e?.message||e));
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
        <div className="grid-generator">
          <div className="card vstack">
            <Field label={t('generator.dataToEncode')}>
  <textarea className="input textarea"
            placeholder={TWO_D_SET.has(bcid)
              ? t('generator.placeholder2d')
              : t('generator.placeholder1d')}
            value={text}
            onChange={e=>setText(e.target.value)} />
  <div className="small">{t('generator.chars')}: {text.length}</div>
</Field>

            <div className="grid-generator" style={{gridTemplateColumns:'1fr 1fr'}}>
              <Field label={t('generator.codeType')}>
                <select className="select" value={bcid} onChange={e=>setBcid(e.target.value)}>
                  {POPULAR_CODE_IDS.map(id => <option key={id} value={id}>{t(`codes.${id.replace('-','_')}.label`)}</option>)}
                </select>
                <div className="small">{t(`codes.${(typeof bcid==='string'?bcid:'').replace('-','_')}.note`)}</div>
              </Field>
              <div className="grid-generator" style={{gridTemplateColumns:'1fr 1fr'}}>
                <Field label={t('generator.scale')}>
                  <input className="input" type="number" min="1" max="16" value={scale} onChange={e=>setScale(parseInt(e.target.value||'0',10))} />
                  <div className="small">{t("generator.moduleWidth")}</div>
                </Field>
                {!TWO_D_SET.has(bcid) && (
                  <Field label={t('generator.height1d')}>
                    <input className="input" type="number" min="20" max="300" step="5" value={height} onChange={e=>setHeight(parseInt(e.target.value||'0',10))} />
                    <div className="small">{t('generator.heightBars')}</div>
                  </Field>
                )}
              </div>
            </div>

            <Toolbar>
              {!TWO_D_SET.has(bcid) && (
                <label className="hstack small">
                  <input type="checkbox" checked={includeText} onChange={e=>setIncludeText(e.target.checked)} />
                  {t('generator.hrtText')}
                </label>
              )}
              <label className="hstack small">
                {t('generator.rotate')}
                <select className="select" value={rotate} onChange={e=>setRotate(parseInt(e.target.value,10))}>
                  <option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
                </select>
              </label>
              <label className="hstack small">{t('generator.hrtFont')}
                  <select className="select" value={hrtFont} disabled={TWO_D_SET.has(bcid) || !includeText} onChange={e=>setHrtFont(e.target.value)}>
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
            <div className="hstack" style={{justifyContent:'space-between', marginBottom:8}}>
              <div>{/*i18n*/}<strong>{t('generator.preview')}</strong> <span className="badge"> {TWO_D_SET.has(bcid)?'2D':'1D'} • {t(`codes.${(typeof bcid==='string'?bcid:'').replace('-','_')}.label`)}</span></div>
              <div className="hstack" style={{gap:8}}>
                <label className="hstack small">{t('generator.pngTimes')}
                  <input className="input" type="number" min="1" max="10" step="1" value={pngMul} onChange={e=>setPngMul(Math.max(1,Math.min(10,parseInt(e.target.value||'1',10))))} style={{width:100, marginLeft:6}} />
                </label>
                <button className="button" onClick={()=>{ try { const base=(Number(scale)||3)*(Number(pngMul)||1); const opts={ bcid, text, rotate }; if (TWO_D_SET.has(bcid)) { opts.scaleX=base; opts.scaleY=base; } else { opts.scaleX=base; opts.height=(Number(height)||50) * (Number(pngMul)||1); if (includeText){ opts.includetext=true; opts.textxalign='center'; opts.textfont=hrtFont } } const png=makeBitmap(opts); const a=document.createElement('a'); a.href=png; a.download=`${bcid}.png`; a.click(); } catch(e){ alert('Błąd PNG: '+(e?.message||e)) } }}>{t('generator.downloadPng')}</button>
                <button className="button" onClick={()=>{ try{ const base=(Number(scale)||3); const opts={ bcid, text, rotate }; if (TWO_D_SET.has(bcid)) { opts.scaleX=base; opts.scaleY=base; } else { opts.scaleX=base; opts.height=Number(height)||50; if (includeText){ opts.includetext=true; opts.textxalign='center' } } const svg=toSvg(opts); const blob=new Blob([svg],{type:'image/svg+xml'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${bcid}.svg`; a.click(); URL.revokeObjectURL(url) } catch(e){ alert('Błąd SVG: '+(e?.message||e)) } }}>{t('generator.downloadSvg')}</button>
              </div>
            </div>
            <div className="preview">{genPreviewUrl ? <img src={genPreviewUrl} alt="preview" /> : <div className='small'>{t('generator.noPreview')}</div>}</div>
            {error ? <div className="small" style={{color:'#b91c1c', marginTop:8}}>{error}</div> :
              <div className="small" style={{marginTop:8}}>{t('generator.emptyHint')}</div>}

            {gs1Report && (
              <div className="card" style={{marginTop:12}}>
                <div><strong>Weryfikacja GS1 (AI)</strong></div>
                {gs1Report.issues.length ? (
                  <ul>{gs1Report.issues.map((x,i)=><li key={i} className="small">• {x}</li>)}</ul>
                ) : <div className="small" style={{color:'#059669'}}>{t('gs1.ok')}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {tab==='batch' && (
        <div className="grid-generator" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div className="card vstack">
            <div className="hstack" style={{justifyContent:'space-between'}}>
              <strong>{t('batch.title')}</strong>
              <input type="file" accept=".csv" onChange={(e)=>{ const f=e.target.files?.[0]; if(!f) return; parseCsv(f, rows => setBatchRows(rows), err => alert('Błąd CSV: '+err?.message)) }} />
            </div>
            <textarea className="input textarea"
          placeholder={t('batch.helpLinePerRow')}
          value={batchInput}
          onChange={e=>setBatchInput(e.target.value)} />
            <Toolbar>
              <Field label="Typ kodu (dla Batch)">
                <select className="select" value={batchBcid} onChange={e=>setBatchBcid(e.target.value)}>
                  {POPULAR_CODE_IDS.map(id => <option key={id} value={id}>{t(`codes.${id.replace('-','_')}.label`)}</option>)}
                </select>
              </Field>
              <button className="button primary" onClick={()=> setBatchRows(parseLines(batchInput))}>{t('batch.generateList')}</button>
              <button className="button" onClick={()=> setBatchRows([])}>{t('batch.clearList')}</button>
              <button className="button" onClick={()=> addAllFromBatch(batchRows)}>Dodaj WSZYSTKIE do arkusza</button>
            </Toolbar>

            <div className="card vstack">
              <strong>Generator sekwencji (auto-inkrementacja)</strong>
              <div className="hstack">
                <Field label="Wzorzec">
                  <input className="input" style={{width:260}} value={seqPattern} onChange={e=>setSeqPattern(e.target.value)} />
                </Field>
                <Field label="Start">
                  <input className="input" type="number" style={{width:100}} value={seqStart} onChange={e=>setSeqStart(parseInt(e.target.value||'1',10))} />
                </Field>
                <Field label="Pad (szer.)">
                  <input className="input" type="number" style={{width:120}} value={seqPad} onChange={e=>setSeqPad(parseInt(e.target.value||'1',10))} />
                </Field>
                <Field label="Ile">
                  <input className="input" type="number" style={{width:100}} value={seqCount} onChange={e=>setSeqCount(parseInt(e.target.value||'1',10))} />
                </Field>
                <Field label="Krok">
                  <input className="input" type="number" style={{width:100}} value={seqStep} onChange={e=>setSeqStep(parseInt(e.target.value||'1',10))} />
                </Field>
              </div>
              <Toolbar>
                <button className="button" onClick={()=> setBatchRows(generateSequence(seqPattern, { count: seqCount, step: seqStep, start: seqStart, padWidth: seqPad }))}>{t('batch.buildList')}</button>
                <button className="button primary" onClick={()=> addAllFromBatch(generateSequence(seqPattern, { count: seqCount, step: seqStep, start: seqStart, padWidth: seqPad }))}>{t('batch.addSequenceToSheet')}</button>
              </Toolbar>
            </div>
          </div>

          <div className="card vstack">
            <div className="hstack" style={{justifyContent:'space-between'}}>
              <div><strong>Wyniki ({batchRows.length})</strong></div>
              <div className="small">{t('batch.clickToAddOne')}</div>
            </div>
            <div className="vstack">
              {batchRows.map((row, idx)=>(
                <div key={idx} className="hstack" style={{justifyContent:'space-between', border:'1px solid var(--border)', borderRadius:10, padding:8}}>
                  <div className="small" style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{row}</div>
                  <button className="button" onClick={()=> { setLabels(prev=>[...prev, { bcid: batchBcid, text: row, scale, height }]); setTab('labels'); notify('Dodano 1 etykietę'); }}>{t('batch.addLabel')}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==='labels' && (
        <div className="vstack">
          <div className="card hstack no-print" style={{justifyContent:'space-between', alignItems:'flex-end'}}>
            <div className="vstack" style={{minWidth: 'min(640px, 100%)'}}>
              <div className="hstack">
                <Field label="Preset">
                  <select className="select" value={presetKey} onChange={e=>setPresetKey(e.target.value)}>
                    {PRESETS.map(p=>(<option key={p.key} value={p.key}>{p.name}</option>))}
                  </select>
                </Field>
                <Field label="Strona (mm) – szer. × wys.">
                  <div className="hstack">
                    <input className="input" style={{width:90}} type="number" value={pageW} onChange={e=>setPageW(parseFloat(e.target.value||'0'))} />
                    <span>×</span>
                    <input className="input" style={{width:90}} type="number" value={pageH} onChange={e=>setPageH(parseFloat(e.target.value||'0'))} />
                  </div>
                </Field>
                <Field label="Siatka – kol. × wiersze">
                  <div className="hstack">
                    <input className="input" style={{width:80}} type="number" min="1" value={cols} onChange={e=>setCols(parseInt(e.target.value||'1',10))} />
                    <span>×</span>
                    <input className="input" style={{width:80}} type="number" min="1" value={rows} onChange={e=>setRows(parseInt(e.target.value||'1',10))} />
                  </div>
                </Field>
              </div>

              <div className="hstack">
                <Field label={t('labels.margins')}>
                  <input className="input" style={{width:100}} type="number" min="0" value={padMM} onChange={e=>setPadMM(parseFloat(e.target.value||'0'))} />
                </Field>
                <Field label={t('labels.gutter')}>
                  <input className="input" style={{width:100}} type="number" min="0" value={gapMM} onChange={e=>setGapMM(parseFloat(e.target.value||'0'))} />
                </Field>
                <Field label={t('labels.skip')}>
                  <input className="input" style={{width:100}} type="number" min="0" value={skip} onChange={e=>setSkip(parseInt(e.target.value||'0',10))} />
                </Field>
                <Field label={t('labels.scaleX')}>
                  <input className="input" style={{width:120}} type="number" min="0.2" step="0.1" value={pageScale} onChange={e=>setPageScale(parseFloat(e.target.value||'1'))} />
                </Field>
                <Field label="{t('labels.rotateOnSheet')}">
                  <select className="select" value={pageRotate} onChange={e=>setPageRotate(parseInt(e.target.value,10))}>
                    <option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
                  </select>
                </Field>
                <label className="hstack small">
                  <input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} />
                  {t('labels.showGrid')}
                </label>
                <label className="hstack small">
                  <input type="checkbox" checked={editMode} onChange={e=>setEditMode(e.target.checked)} />
                  {t('labels.editMode')}
                </label>
                <label className="hstack small">
                  <input type="checkbox" checked={freeLayout} onChange={e=>setFreeLayout(e.target.checked)} />
                  {t('labels.freeLayout')}
                </label>
                <label className="hstack small">
                  <input type="checkbox" checked={editAll} onChange={e=>onToggleEditAll(e.target.checked)} />
                  {t('labels.editMode')}
                </label>
                {editAll && (
                  <div className="vstack" style={{gap:4}}>
                    <label className="hstack small">
                      <input type="checkbox" checked={lockAspect} onChange={e=>setLockAspect(e.target.checked)} />
                      Zablokuj proporcje
                    </label>
                    <div className="hstack" style={{alignItems:'center'}}>
                      <span className="small">{t('labels.widthShort')} ×</span>
                      <input className="input" type="range" min="0.2" max="5" step="0.05" value={globalMulX} onChange={e=>{ const v=parseFloat(e.target.value); setGlobalMulX(v); if(lockAspect) setGlobalMulY(v); }} style={{width:280}} />
                      <input className="input" type="number" min="0.2" max="5" step="0.1" value={globalMulX} onChange={e=>{ const v=parseFloat(e.target.value||'1'); setGlobalMulX(v); if(lockAspect) setGlobalMulY(v); }} style={{width:100}} />
                    </div>
                    <div className="hstack" style={{alignItems:'center'}}>
                      <span className="small">{t('labels.heightShort')} ×</span>
                      <input className="input" type="range" min="0.2" max="5" step="0.05" value={globalMulY} onChange={e=>{ const v=parseFloat(e.target.value); setGlobalMulY(v); if(lockAspect) setGlobalMulX(v); }} style={{width:280}} />
                      <input className="input" type="number" min="0.2" max="5" step="0.1" value={globalMulY} onChange={e=>{ const v=parseFloat(e.target.value||'1'); setGlobalMulY(v); if(lockAspect) setGlobalMulX(v); }} style={{width:100}} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="hstack" style={{alignItems:'center', gap:12, flexWrap:'wrap'}}>
                <label className="hstack small">
                  {t('labels.snap')}
                  <select className="select" value={snapMM} onChange={e=>setSnapMM(parseInt(e.target.value||'0',10))}>
                    <option value={0}>Off</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={5}>5</option>
                  </select>
                </label>

                <div className="hstack small" style={{border:'1px solid var(--border)', borderRadius:10, padding:'6px 8px'}}>
                  <span>{t('labels.posMM')}:</span>
                  <span>X</span>
                  <input className="input" type="number" style={{width:90}} value={(selectedIdx!=null ? (posOverrides[selectedIdx]?.x ?? defaultPosForIndex(selectedIdx).x) : 0)} onChange={e=>{
                    const idx = selectedIdx ?? 0
                    const v = parseFloat(e.target.value||'0')
                    const pos = clampPos(idx, snapPos({ x: v, y: (posOverrides[idx]?.y ?? defaultPosForIndex(idx).y) }))
                    setPosOverrides(prev=>({ ...prev, [idx]: pos }))
                  }}/>
                  <span>Y</span>
                  <input className="input" type="number" style={{width:90}} value={(selectedIdx!=null ? (posOverrides[selectedIdx]?.y ?? defaultPosForIndex(selectedIdx).y) : 0)} onChange={e=>{
                    const idx = selectedIdx ?? 0
                    const v = parseFloat(e.target.value||'0')
                    const pos = clampPos(idx, snapPos({ x: (posOverrides[idx]?.x ?? defaultPosForIndex(idx).x), y: v }))
                    setPosOverrides(prev=>({ ...prev, [idx]: pos }))
                  }}/>
                </div>

                
                
                



                <div className="hstack small" style={{border:'1px dashed var(--border)', borderRadius:10, padding:'6px 8px'}}>
                  <span>{t('labels.moveAll')}:</span>
                  <span>{t('labels.dX')}</span>
                  <input className="input" type="number" style={{width:90}} value={0} onChange={()=>{}} onBlur={(e)=>{
                    const dx = parseFloat(e.target.value||'0'); e.target.value='0'
                    setPosOverrides(prev=>{ const out={...prev}; for(let i=0;i<labels.length;i++){ const base = out[i] ?? defaultPosForIndex(i); out[i]=clampPos(i, snapPos({ x: base.x + dx, y: base.y })) } return out })
                  }}/>
                  <span>{t('labels.dY')}</span>
                  <input className="input" type="number" style={{width:90}} value={0} onChange={()=>{}} onBlur={(e)=>{
                    const dy = parseFloat(e.target.value||'0'); e.target.value='0'
                    setPosOverrides(prev=>{ const out={...prev}; for(let i=0;i<labels.length;i++){ const base = out[i] ?? defaultPosForIndex(i); out[i]=clampPos(i, snapPos({ x: base.x, y: base.y + dy })) } return out })
                  }}/>
                </div>

              <div className="small">{t('labels.count')}: {labels.length} • {t('labels.perPage')}: {perPage} • {t('labels.pages')}: {pages}</div>
              <div className="hstack">
                <div className="hstack small" title="Ctrl+scroll = zoom">
                  {t('labels.zoom')}: {Math.round(sheetZoom*100)}%
                  <input className="input" type="range" min="50" max="300" step="10" value={Math.round(sheetZoom*100)} onChange={e=>setZoomCentered(parseInt(e.target.value,10)/100)} style={{width:140}} />
                </div>
                <button className="button" onClick={()=>window.print()}>{t('labels.print')}</button>
                <button className="button primary" onClick={exportPdf}>{t('labels.exportPdf')}</button>
                <button className="button" onClick={resetLayoutDefaults}>{t('labels.reset')}</button>
                <button className="button" onClick={clearLabels}>{t('labels.clearLabels')}</button>
 <div className="hstack" style={{marginLeft:16, gap:8}}>
   <button className="button icon-btn" title="{t('labels.alignLeft')}" onClick={()=>{
     if (editAll){ setPosOverrides(prev=>{ const out={...prev}; for(let i=0;i<labels.length;i++){ const p=clampPos(i, snapPos({x:0,y:(out[i]?.y ?? defaultPosForIndex(i).y)})); out[i]=p } return out }) }
     else if (selectedIdx!=null){ setPosOverrides(prev=>({ ...prev, [selectedIdx]: clampPos(selectedIdx, snapPos({ x:0, y:(prev[selectedIdx]?.y ?? defaultPosForIndex(selectedIdx).y) })) })) }
   }}>
     <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
       <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8"/>
       <path d="M6 3v18M6 8h10M6 16h12" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
     </svg>
   </button>
   <button className="button icon-btn" title="Wyśrodkuj poziomo" onClick={()=>{
     if (editAll){ setPosOverrides(prev=>{ const out={...prev}; const { innerW } = metrics(); for(let i=0;i<labels.length;i++){ const { w }=nodeSizeMM(i); const p=clampPos(i, snapPos({x:(innerW - w)/2, y:(out[i]?.y ?? defaultPosForIndex(i).y)})); out[i]=p } return out }) }
     else if (selectedIdx!=null){ const { innerW } = metrics(); const { w } = nodeSizeMM(selectedIdx); setPosOverrides(prev=>({ ...prev, [selectedIdx]: clampPos(selectedIdx, snapPos({ x:(innerW - w)/2, y:(prev[selectedIdx]?.y ?? defaultPosForIndex(selectedIdx).y) })) })) }
   }}>
     <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
       <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8"/>
       <path d="M12 3v18M6 8h12M4 16h16" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
     </svg>
   </button>
   <button className="button icon-btn" title="{t('labels.alignTop')}" onClick={()=>{
     if (editAll){ setPosOverrides(prev=>{ const out={...prev}; for(let i=0;i<labels.length;i++){ const p=clampPos(i, snapPos({x:(out[i]?.x ?? defaultPosForIndex(i).x), y:0})); out[i]=p } return out }) }
     else if (selectedIdx!=null){ setPosOverrides(prev=>({ ...prev, [selectedIdx]: clampPos(selectedIdx, snapPos({ x:(prev[selectedIdx]?.x ?? defaultPosForIndex(selectedIdx).x), y:0 })) })) }
   }}>
     <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
       <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8"/>
       <path d="M3 6h18M8 6v10M16 6v12" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
     </svg>
   </button>
   <button className="button icon-btn" title="{t('labels.centerV')}" onClick={()=>{
     if (editAll){ setPosOverrides(prev=>{ const out={...prev}; const { innerH } = metrics(); for(let i=0;i<labels.length;i++){ const { h }=nodeSizeMM(i); const p=clampPos(i, snapPos({x:(out[i]?.x ?? defaultPosForIndex(i).x), y:(innerH - h)/2})); out[i]=p } return out }) }
     else if (selectedIdx!=null){ const { innerH } = metrics(); const { h } = nodeSizeMM(selectedIdx); setPosOverrides(prev=>({ ...prev, [selectedIdx]: clampPos(selectedIdx, snapPos({ x:(prev[selectedIdx]?.x ?? defaultPosForIndex(selectedIdx).x), y:(innerH - h)/2 })) })) }
   }}>
     <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
       <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8"/>
       <path d="M3 12h18M8 4v16M16 6v12" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
     </svg>
   </button>
   <button className="button icon-btn" title="Wyśrodkuj (H+V)" onClick={()=>{
     if (editAll){ setPosOverrides(prev=>{ const out={...prev}; const { innerW, innerH } = metrics(); for(let i=0;i<labels.length;i++){ const { w,h }=nodeSizeMM(i); out[i]=clampPos(i, snapPos({x:(innerW - w)/2, y:(innerH - h)/2})) } return out }) }
     else if (selectedIdx!=null){ const { innerW, innerH } = metrics(); const { w,h } = nodeSizeMM(selectedIdx); setPosOverrides(prev=>({ ...prev, [selectedIdx]: clampPos(selectedIdx, snapPos({ x:(innerW - w)/2, y:(innerH - h)/2 })) })) }
   }}>
     <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
       <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="#94a3b8"/>
       <path d="M12 4v16M4 12h16M8 8h8M8 16h8" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/>
     </svg>
   </button>
 </div>

              </div>
            </div>
          </div>

          <div className="sheet-viewport" ref={viewportRef} onWheel={(e)=>{ if(e.ctrlKey||e.metaKey){ e.preventDefault(); const d = e.deltaY>0 ? -0.1 : 0.1; const next = Math.max(0.5, Math.min(3, +((sheetZoom+d).toFixed(2)))); setZoomCentered(next); } }}>
            <div ref={contentRef} style={{ transform:`scale(${sheetZoom})`, transformOrigin:'0 0' }}>
              {renderLabelPages()}
            </div>
          </div>
        </div>
      )}

      {!!toast && <div className="toast">{toast}</div>}
    </div>
  )
}
