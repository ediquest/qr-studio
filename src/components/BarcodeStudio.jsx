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
import MySheetsTab from './barcode-studio/tabs/MySheetsTab.jsx'

const POPULAR_CODE_IDS = ['qrcode','microqrcode','maxicode','code128','code93','code39','code39ext','codabar','interleaved2of5','code11','msi','ean13','ean8','upca','upce','itf14','gs1-128','datamatrix','gs1datamatrix','hibccode39','hibcdatamatrix','azteccode','pdf417'];
const CORE_CODE_IDS = ['qrcode', 'code128', 'ean13', 'datamatrix', 'gs1-128', 'pdf417', 'azteccode']
const CODE_GROUPS = [
  { key: 'popular', ids: CORE_CODE_IDS },
  { key: 'more', ids: POPULAR_CODE_IDS.filter((id) => !CORE_CODE_IDS.includes(id)) },
]
const SAVED_SHEETS_KEY = 'rbs_saved_sheets_v1'

export default function BarcodeStudio() {
  const rootRef = useRef(null)
  const drawerRef = useRef(null)
  const [tab, setTab] = useState('generator')
  const [toast, setToast] = useState('')
  const [pdfQuality, setPdfQuality] = useState('lowest')
  const [selectedIds, setSelectedIds] = useState([])
  const [matchedHighlightIdx, setMatchedHighlightIdx] = useState(null)
  const [marqueeRect, setMarqueeRect] = useState(null)
  const [previewRatios, setPreviewRatios] = useState({})
  const [savedSheets, setSavedSheets] = useState([])
  const [sheetModal, setSheetModal] = useState({ open:false, mode:'create', id:null, name:'' })
  const [deleteSheetModal, setDeleteSheetModal] = useState({ open:false, id:null, name:'' })
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
    hrtSize,
    setHrtSize,
    hrtGap,
    setHrtGap,
    customCaptionEnabled,
    setCustomCaptionEnabled,
    customCaptionText,
    setCustomCaptionText,
    customCaptionFont,
    setCustomCaptionFont,
    customCaptionSize,
    setCustomCaptionSize,
    customCaptionGap,
    setCustomCaptionGap,
    rotate,
    setRotate,
    error,
    genPreviewUrl,
    pngMul,
    setPngMul,
    downloadWhiteBg,
    setDownloadWhiteBg,
    gs1Report,
  } = useGeneratorState({ t, toSvg, makeBitmap, lang })

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
    showCutLines,
    setShowCutLines,
    cutLineWeight,
    setCutLineWeight,
    cutLineStyle,
    setCutLineStyle,
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
  function deepClone(value){
    try { return JSON.parse(JSON.stringify(value)) } catch(_) { return value }
  }
  function defaultSheetName(){
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${t('sheets.defaultName')} ${y}-${m}-${day} ${hh}:${mm}`
  }
  function buildSheetSnapshot(){
    return deepClone({
      labels,
      skip,
      showGrid,
      showCutLines,
      cutLineWeight,
      cutLineStyle,
      freeLayout,
      presetKey,
      cols,
      rows,
      pageW,
      pageH,
      gapMM,
      padMM,
      pageRotate,
      pageScale,
      sizeOverrides,
      posOverrides,
      globalMulX,
      globalMulY,
      lockAspect,
      snapMM,
    })
  }
  function applySheetSnapshot(snapshot){
    if (!snapshot || typeof snapshot !== 'object') return
    setLabels(Array.isArray(snapshot.labels) ? snapshot.labels : [])
    setSkip(Number.isFinite(+snapshot.skip) ? +snapshot.skip : 0)
    setShowGrid(snapshot.showGrid !== false)
    setShowCutLines(!!snapshot.showCutLines)
    setCutLineWeight(['thin','standard','thick'].includes(snapshot.cutLineWeight) ? snapshot.cutLineWeight : 'standard')
    setCutLineStyle(['solid','dashed'].includes(snapshot.cutLineStyle) ? snapshot.cutLineStyle : 'solid')
    setFreeLayout(!!snapshot.freeLayout)
    if (snapshot.presetKey) setPresetKey(snapshot.presetKey)
    setCols(Math.max(1, parseInt(snapshot.cols || String(cols), 10) || cols))
    setRows(Math.max(1, parseInt(snapshot.rows || String(rows), 10) || rows))
    setPageW(Number.isFinite(+snapshot.pageW) ? +snapshot.pageW : pageW)
    setPageH(Number.isFinite(+snapshot.pageH) ? +snapshot.pageH : pageH)
    setGapMM(Number.isFinite(+snapshot.gapMM) ? +snapshot.gapMM : gapMM)
    setPadMM(Number.isFinite(+snapshot.padMM) ? +snapshot.padMM : padMM)
    setPageRotate([0,90,180,270].includes(snapshot.pageRotate) ? snapshot.pageRotate : 0)
    setPageScale(Number.isFinite(+snapshot.pageScale) ? +snapshot.pageScale : 1)
    setSizeOverrides(snapshot.sizeOverrides && typeof snapshot.sizeOverrides === 'object' ? snapshot.sizeOverrides : {})
    setPosOverrides(snapshot.posOverrides && typeof snapshot.posOverrides === 'object' ? snapshot.posOverrides : {})
    setGlobalMulX(Number.isFinite(+snapshot.globalMulX) ? +snapshot.globalMulX : 1)
    setGlobalMulY(Number.isFinite(+snapshot.globalMulY) ? +snapshot.globalMulY : 1)
    setLockAspect(!!snapshot.lockAspect)
    setSnapMM(Number.isFinite(+snapshot.snapMM) ? +snapshot.snapMM : 0)
    setSelectedIds([])
    setSelectedIdx(null)
    setEditAll(false)
  }
  function openSaveSheetModal(){
    if (!labels.length) { notify(t('sheets.nothingToSave')); return }
    setSheetModal({ open:true, mode:'create', id:null, name:defaultSheetName() })
  }
  function openRenameSheetModal(id){
    const item = savedSheets.find((s) => s.id === id)
    if (!item) return
    setSheetModal({ open:true, mode:'rename', id, name:item.name || '' })
  }
  function closeSheetModal(){
    setSheetModal({ open:false, mode:'create', id:null, name:'' })
  }
  function submitSheetModal(){
    const name = String(sheetModal.name || '').trim()
    if (!name) return
    const now = Date.now()
    if (sheetModal.mode === 'rename' && sheetModal.id) {
      setSavedSheets((prev) => prev.map((s) => s.id === sheetModal.id ? { ...s, name, updatedAt: now } : s))
      notify(t('sheets.renamed'))
      closeSheetModal()
      return
    }
    const project = {
      id: String(now) + '-' + Math.random().toString(36).slice(2, 8),
      name,
      createdAt: now,
      updatedAt: now,
      snapshot: buildSheetSnapshot(),
    }
    setSavedSheets((prev) => [project, ...prev].slice(0, 120))
    notify(t('sheets.saved'))
    closeSheetModal()
  }
  function loadSavedSheet(id, opts = {}){
    const item = savedSheets.find((s) => s.id === id)
    if (!item?.snapshot) return
    const hitIdxRaw = opts?.highlightIndex
    const hitIdx = Number.isInteger(hitIdxRaw) ? hitIdxRaw : null
    const labelsCount = Array.isArray(item?.snapshot?.labels) ? item.snapshot.labels.length : 0
    const validHitIdx = hitIdx != null && hitIdx >= 0 && hitIdx < labelsCount ? hitIdx : null
    applySheetSnapshot(item.snapshot)
    setMatchedHighlightIdx(validHitIdx)
    setTab('labels')
    notify(t('sheets.loaded'))
  }
  function deleteSavedSheet(id){
    setSavedSheets((prev) => prev.filter((s) => s.id !== id))
    notify(t('sheets.deleted'))
  }
  function openDeleteSheetModal(id){
    const item = savedSheets.find((s) => s.id === id)
    if (!item) return
    setDeleteSheetModal({ open:true, id, name:item.name || t('sheets.untitled') })
  }
  function closeDeleteSheetModal(){
    setDeleteSheetModal({ open:false, id:null, name:'' })
  }
  function confirmDeleteSheet(){
    if (!deleteSheetModal.id) return
    deleteSavedSheet(deleteSheetModal.id)
    closeDeleteSheetModal()
  }
  function resolvedCustomCaptionText(item){
    if (!item?.customCaptionEnabled) return ''
    const raw = String(item?.customCaptionText || '').trim()
    if (raw) return raw
    return String(item?.text || '').trim()
  }
  function hasCustomCaption(item){
    return resolvedCustomCaptionText(item).length > 0
  }
  function addCurrentToLabels(){
    const customOn = !!customCaptionEnabled
    const hrtOn = customOn ? false : !!includeText
    setLabels(prev => [...prev, { bcid, text, scale, height, includeText: hrtOn, hrtSize, hrtGap, customCaptionEnabled: customOn, customCaptionText, customCaptionFont, customCaptionSize, customCaptionGap }])
    notify('Dodano 1 etykiete')
  }
  function normalizeBatchRow(row){
    if (row && typeof row === 'object') {
      return {
        text: String(row.text || '').trim(),
        caption: String(row.caption || '').trim(),
      }
    }
    return { text: String(row || '').trim(), caption: '' }
  }
  function addAllFromBatch(rows, opts = {}){
    const single = !!opts?.single
    const toAdd = rows.map(normalizeBatchRow).filter((row) => row.text).map((row) => ({
      bcid: batchBcid,
      text: row.text,
      scale,
      height,
      includeText: row.caption ? false : true,
      hrtSize,
      hrtGap,
      customCaptionEnabled: !!row.caption,
      customCaptionText: row.caption || '',
      customCaptionFont,
      customCaptionSize: 10,
      customCaptionGap,
    }))
    if (!toAdd.length) return
    setLabels(prev => [...prev, ...toAdd]); setTab('labels')
    notify(single ? t('batch.addedOne') : t('batch.addedMany', { count: toAdd.length }))
  }
  function clearLabels(){ setLabels([]); setSizeOverrides({}); setPosOverrides({}); setSelectedIds([]); setSelectedIdx(null); notify('Wyczyszczono arkusze') }

  function effMul(idx, axis){ const o = sizeOverrides[idx] || {x:1,y:1}; if (editAll) return axis==='x'?globalMulX:globalMulY; return axis==='x'?o.x:o.y }
  function hasTextEnabled(item){ return item?.includeText !== false }
  function remapIndexedObject(prev, removedIdx){
    const out = {}
    Object.entries(prev || {}).forEach(([k, v]) => {
      const i = parseInt(k, 10)
      if (!(i >= 0)) return
      if (i < removedIdx) out[i] = v
      else if (i > removedIdx) out[i - 1] = v
    })
    return out
  }
  function remapIndexedObjectAfterBulk(prev, removedSet){
    const out = {}
    const removedSorted = Array.from(removedSet).sort((a, b) => a - b)
    const shiftFor = (idx) => {
      let s = 0
      for (let i = 0; i < removedSorted.length; i++) {
        if (removedSorted[i] < idx) s++
        else break
      }
      return s
    }
    Object.entries(prev || {}).forEach(([k, v]) => {
      const i = parseInt(k, 10)
      if (!(i >= 0) || removedSet.has(i)) return
      out[i - shiftFor(i)] = v
    })
    return out
  }
  function removeLabelAt(idx){
    if (!(idx >= 0 && idx < labels.length)) return
    setLabels((prev) => prev.filter((_, i) => i !== idx))
    setSizeOverrides((prev) => remapIndexedObject(prev, idx))
    setPosOverrides((prev) => remapIndexedObject(prev, idx))
    setPreviewRatios((prev) => remapIndexedObject(prev, idx))
    setSelectedIds((prev) => prev.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)).sort((a,b)=>a-b))
    notify(t('labels.deletedOne'))
  }
  function removeSelectedLabels(ids = selectedIds){
    const valid = Array.from(new Set((ids || []).filter((i) => i >= 0 && i < labels.length))).sort((a, b) => a - b)
    if (!valid.length) return
    const removedSet = new Set(valid)
    setLabels((prev) => prev.filter((_, i) => !removedSet.has(i)))
    setSizeOverrides((prev) => remapIndexedObjectAfterBulk(prev, removedSet))
    setPosOverrides((prev) => remapIndexedObjectAfterBulk(prev, removedSet))
    setPreviewRatios((prev) => remapIndexedObjectAfterBulk(prev, removedSet))
    setSelectedIds([])
    setSelectedIdx(null)
    notify(t('labels.deletedMany', { count: valid.length }))
  }
  function cellCoordsForLabel(idx){
    const global = skip + idx
    const page = Math.floor(global / perPage)
    const local = ((global % perPage) + perPage) % perPage
    const col = local % cols
    const row = Math.floor(local / cols)
    return { page, local, col, row }
  }
  function rememberPreviewRatio(idx, ev){
    const img = ev?.currentTarget
    const w = img?.naturalWidth || img?.width || 0
    const h = img?.naturalHeight || img?.height || 0
    if (!(idx >= 0) || !(w > 0) || !(h > 0)) return
    const ratio = w / h
    setPreviewRatios((prev) => {
      const cur = prev[idx]
      if (cur && Math.abs(cur - ratio) < 0.01) return prev
      return { ...prev, [idx]: ratio }
    })
  }
  function oneDWidthMM(idx, h){
    const { cellW } = metrics()
    const ratio = previewRatios[idx]
    const mulX = effMul(idx, 'x')
    const safeRatio = ratio > 0 ? ratio : 1
    const w = h * safeRatio * mulX
    return Math.max(2, Math.min(cellW, w))
  }
  function captionCfg(item){
    const enabled = hasCustomCaption(item)
    const text = resolvedCustomCaptionText(item)
    const size = enabled
      ? Math.max(8, Math.min(72, Number(item?.customCaptionSize ?? customCaptionSize) || 12))
      : Math.max(6, Math.min(24, Number(item?.hrtSize ?? hrtSize) || 10))
    const gap = enabled
      ? Math.max(-20, Math.min(80, Number(item?.customCaptionGap ?? customCaptionGap) || 0))
      : Math.max(-20, Math.min(80, Number(item?.hrtGap ?? hrtGap) || 0))
    const font = item?.customCaptionFont || customCaptionFont || 'Arial'
    return { enabled, text, size, gap, font }
  }
  function captionReservePx(cfg){
    if (!cfg?.enabled || !cfg?.text) return 0
    return Math.max(10, cfg.size * 1.4 + Math.max(0, cfg.gap))
  }
  function captionFontCss(font){
    const f = String(font || '').toLowerCase()
    if (f.includes('courier') || f.includes('mono')) return '"Courier New", Courier, monospace'
    if (f.includes('times')) return '"Times New Roman", Times, serif'
    if (f.includes('georgia')) return 'Georgia, serif'
    if (f.includes('verdana')) return 'Verdana, sans-serif'
    return 'Arial, Helvetica, sans-serif'
  }
  function pdfFontName(font){
    const f = String(font || '').toLowerCase()
    if (f.includes('courier') || f.includes('mono')) return 'courier'
    if (f.includes('times') || f.includes('georgia')) return 'times'
    return 'helvetica'
  }
  function makeCaptionBitmap(text, fontCss, maxWidthPx, heightPx){
    const maxW = Math.max(48, Math.round(maxWidthPx))
    const baseH = Math.max(16, Math.round(heightPx))
    const probe = document.createElement('canvas')
    const pctx = probe.getContext('2d')
    if (!pctx) return null

    let fontPx = Math.max(8, Math.floor(baseH * 0.72))
    for (let i = 0; i < 14; i++) {
      pctx.font = `${fontPx}px ${fontCss}`
      const mw = pctx.measureText(text).width
      if (mw <= maxW - 8 || fontPx <= 8) break
      fontPx -= 1
    }
    pctx.font = `${fontPx}px ${fontCss}`
    const measured = pctx.measureText(text).width
    const textW = Math.max(24, Math.min(maxW, Math.ceil(measured) + 10))

    const ss = 3
    const canvas = document.createElement('canvas')
    canvas.width = textW * ss
    canvas.height = baseH * ss
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.scale(ss, ss)
    ctx.clearRect(0, 0, textW, baseH)
    ctx.fillStyle = '#111827'
    ctx.font = `${fontPx}px ${fontCss}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, textW / 2, baseH / 2)
    return { dataUrl: canvas.toDataURL('image/png'), textW, textH: baseH }
  }
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
    const nativeTextOn = (hasTextEnabled(item) && !hasCustomCaption(item)) ? 1 : 0
    const itemHrtSize = Math.max(6, Math.min(24, Number(item.hrtSize ?? hrtSize) || 10))
    const itemHrtGap = Math.max(-20, Math.min(80, Number(item.hrtGap ?? hrtGap) || 0))
    const key = is2d
      ? `2d|${item.bcid}|${item.text}|${pageRotate||0}|${baseScale}`
      : `1d|${item.bcid}|${item.text}|${pageRotate||0}|${baseScale}|${Math.round(((Number(item.height)||50)*(Number(pageScale)||1)*mulY))}|${nativeTextOn}|${hrtFont}|${itemHrtSize}|${itemHrtGap}`
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
        if (hasTextEnabled(item) && !hasCustomCaption(item)) {
          opts.includetext = true
          opts.textxalign = 'center'
          opts.textfont = hrtFont
          opts.textsize = itemHrtSize
          opts.textyoffset = itemHrtGap
        }
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
        ...(hasTextEnabled(item) && !hasCustomCaption(item)
          ? { includetext:true, textxalign:'center', textfont:hrtFont, textsize:itemHrtSize, textyoffset:itemHrtGap }
          : {}),
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
    try {
      const raw = localStorage.getItem(SAVED_SHEETS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setSavedSheets(parsed.filter((x) => x && typeof x === 'object' && x.id && x.snapshot))
    } catch (_) {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(SAVED_SHEETS_KEY, JSON.stringify(savedSheets)) } catch (_) {}
  }, [savedSheets])
  useEffect(() => {
    if (!sheetModal.open && !deleteSheetModal.open) return
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        if (sheetModal.open) closeSheetModal()
        if (deleteSheetModal.open) closeDeleteSheetModal()
      }
      if (ev.key === 'Enter') {
        if (sheetModal.open) submitSheetModal()
        if (deleteSheetModal.open) confirmDeleteSheet()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetModal.open, sheetModal.name, sheetModal.mode, sheetModal.id, deleteSheetModal.open, deleteSheetModal.id, savedSheets])

  useEffect(() => {
    setLabels((prev) => {
      let changed = false
      const next = prev.map((item) => {
        const include = item?.includeText !== false
        const custom = !!item?.customCaptionEnabled
        // Legacy cleanup: if both flags are on, keep native HRT as default.
        if (include && custom) {
          changed = true
          return { ...item, customCaptionEnabled: false }
        }
        return item
      })
      return changed ? next : prev
    })
  }, [labels, setLabels])

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
      const { col, row } = cellCoordsForLabel(i)
      const { w, h } = nodeSizeMM(i)
      const defX = col*(cellW+gapMM) + (cellW - w) / 2
      const defY = row*(cellH+gapMM) + (cellH - h) / 2
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
    const { cellW, cellH } = metrics()
    const { col, row } = cellCoordsForLabel(i)
    const { w, h } = nodeSizeMM(i)
    return {
      x: col*(cellW+gapMM) + (cellW - w) / 2,
      y: row*(cellH+gapMM) + (cellH - h) / 2,
    }
  }
  function nodeSizeMM(i){
    const { cellW, cellH } = metrics()
    const mulX = effMul(i,'x'); const mulY = effMul(i,'y')
    const is2d = TWO_D_SET.has(labels[i]?.bcid||'')
    const h = cellH * mulY
    return { w: is2d ? (cellW*mulX) : oneDWidthMM(i, h), h }
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

  function cutLineCenters(size, gap, count){
    if (count <= 1) return []
    const out = []
    for (let k = 1; k < count; k++) {
      const v = k * (size + gap) - gap / 2
      out.push(Number(v.toFixed(3)))
    }
    return out
  }

  function renderCutLinesOverlay(innerW, innerH, cellW, cellH){
    if (!showCutLines) return null
    const xs = cutLineCenters(cellW, gapMM, cols)
    const ys = cutLineCenters(cellH, gapMM, rows)
    const lineWidthMM = cutLineWeight === 'thin' ? 0.12 : (cutLineWeight === 'thick' ? 0.28 : 0.2)
    const dash = cutLineStyle === 'dashed' ? '1.2 0.9' : undefined
    return (
      <svg
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }}
        viewBox={`0 0 ${innerW} ${innerH}`}
        preserveAspectRatio="none"
      >
        {xs.map((x) => (
          <line
            key={`vx-${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={innerH}
            stroke="#94a3b8"
            strokeWidth={lineWidthMM}
            strokeDasharray={dash}
            shapeRendering="geometricPrecision"
          />
        ))}
        {ys.map((y) => (
          <line
            key={`hy-${y}`}
            x1={0}
            y1={y}
            x2={innerW}
            y2={y}
            stroke="#94a3b8"
            strokeWidth={lineWidthMM}
            strokeDasharray={dash}
            shapeRendering="geometricPrecision"
          />
        ))}
      </svg>
    )
  }

  function drawPdfCutLines(pdf, innerW, innerH, cellW, cellH){
    if (!showCutLines) return
    const xs = cutLineCenters(cellW, gapMM, cols)
    const ys = cutLineCenters(cellH, gapMM, rows)
    const lineWidthMM = cutLineWeight === 'thin' ? 0.08 : (cutLineWeight === 'thick' ? 0.18 : 0.12)
    pdf.setDrawColor(148, 163, 184)
    pdf.setLineWidth(lineWidthMM)
    if (cutLineStyle === 'dashed') pdf.setLineDashPattern([1.2, 0.9], 0)
    else pdf.setLineDashPattern([], 0)
    xs.forEach((x) => pdf.line(padMM + x, padMM, padMM + x, padMM + innerH))
    ys.forEach((y) => pdf.line(padMM, padMM + y, padMM + innerW, padMM + y))
    pdf.setLineDashPattern([], 0)
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
    const isPl = lang === 'pl'
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
      'isbn10badlength': isPl ? 'ISBN-10 musi miec 9 lub 10 cyfr (bez myslnikow)' : 'ISBN-10 must be 9 or 10 digits (without hyphens)',
      'isbn13badlength': isPl ? 'ISBN-13 musi miec 12 lub 13 cyfr (bez myslnikow)' : 'ISBN-13 must be 12 or 13 digits (without hyphens)',
      'code39badcharacter': t('errors.code39badcharacter'),
      'code128badcharacter': t('errors.code128badcharacter'),
      'code11badcharacter': t('errors.code11badcharacter'),
      'msibadcharacter': t('errors.msibadcharacter'),
      'itfbadcharacter':    isPl ? 'ITF (Interleaved 2 of 5) akceptuje tylko cyfry' : 'ITF (Interleaved 2 of 5) accepts digits only',
      'postnetbadcharacter': isPl ? 'POSTNET akceptuje tylko cyfry' : 'POSTNET accepts digits only',
      'badcheckdigit': t('errors.badcheckdigit'),
      'badchecksum':   t('errors.badchecksum'),
      'qrcodetoolong': t('errors.toolong'),
      'datamatrixtoolong': t('errors.toolong'),
      'gs1datamatrixtoolong': t('errors.toolong'),
      'pdf417toolong': t('errors.toolong'),
    };
    if (code && dict[code]) return dict[code];

    // common generic messages
    if (/bar code text not specified/i.test(s) || /text not specified/i.test(s)) return t('generator.errorNoText');
    if (isPl && /(?:the message is )?too long/i.test(s)) return t('errors.toolong');

    if (!s) s = t('errors.fallback');

    // Heuristic translation of common phrases (PL only).
    if (isPl) {
      s = s.replace(/\bmust be\b/gi,'musi miec')
           .replace(/\bshould be\b/gi,'powinno miec')
           .replace(/\bdigits?\b/gi,'cyfr')
           .replace(/\binvalid\b/gi,'nieprawidlowy')
           .replace(/\btoo long\b/gi,'za dlugi')
           .replace(/\btoo short\b/gi,'za krotki')
           .replace(/[.:\s]+$/,'')
           .trim();
    } else {
      s = s.replace(/[.:\s]+$/, '').trim();
    }
    return s;
  }

  function renderLabelPages(){
    const out = []; const perPageLocal = perPage; const { innerW, innerH, cellW, cellH } = metrics()
    const largeDeleteBtn = cols === 1 && rows === 1
    const deleteBtnStyle = largeDeleteBtn
      ? { transform: `scale(${Math.min(2.6, Math.max(1, 1 / Math.max(0.5, sheetZoom || 1)))})`, transformOrigin: 'top right' }
      : undefined
    const useFreeLayout = freeLayout
    for (let p=0; p<pages; p++) {
      const cutOverlay = renderCutLinesOverlay(innerW, innerH, cellW, cellH)
      if (!useFreeLayout){
        out.push(
          <div key={p} data-page-idx={p} className="print-page print-sheet page-outline" style={{ width: pageW+'mm', height: pageH+'mm', padding: padMM+'mm', position:'relative' }}>
            {cutOverlay ? (
              <div style={{ position:'absolute', left:padMM+'mm', top:padMM+'mm', width:innerW+'mm', height:innerH+'mm' }}>
                {cutOverlay}
              </div>
            ) : null}
            <div className="label-grid" style={{ position:'relative', zIndex:1, gridTemplateColumns:`repeat(${cols},1fr)`, gridTemplateRows:`repeat(${rows},1fr)`, gap: gapMM+'mm' }}>
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
                  <div key={i} className={"label-cell "+((editAll || selectedIds.includes(idx))?"cell-highlight ":"")+((item && idx === matchedHighlightIdx)?"cell-match-highlight":"")} data-cell-index={globalCellIndex} data-label-idx={item ? idx : undefined}
                       onPointerDown={(e)=>onGridPointerDown(e, globalCellIndex)}
                       style={{position:'relative', borderStyle: showGrid?'dashed':'none', overflow:'hidden', touchAction:'none', userSelect:'none'}}>
                    {editMode && selectedIds.includes(idx) ? (
                      <button
                        type="button"
                        className={"label-delete-btn no-print" + (largeDeleteBtn ? " label-delete-btn-large" : "")}
                        aria-label={t('labels.deleteLabel')}
                        title={t('labels.deleteLabel')}
                        style={deleteBtnStyle}
                        onPointerDown={(e)=>{ e.preventDefault(); e.stopPropagation() }}
                        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); removeLabelAt(idx) }}
                      >
                        x
                      </button>
                    ) : null}
                    {(() => {
                      if (imgSrc && imgSrc!=='ERROR') {
                        const c = captionCfg(item)
                        const capPx = captionReservePx(c)
                        const wrapW = is2d ? ((mulX*100)+'%') : '100%'; const wrapH = (mulY*100)+'%';
                        return (
                          <div className="barcode-wrap" style={{position:'relative', width:wrapW, height:wrapH, display:'flex', alignItems:'center', justifyContent:'center'}}>
                            <img src={imgSrc} alt="barcode" draggable={false} style={is2d ? {maxWidth:'100%',maxHeight:`calc(100% - ${capPx}px)`, pointerEvents:'none'} : {maxHeight:`calc(100% - ${capPx}px)`,maxWidth:'none',width:'auto', transform:`scaleX(${mulX})`, transformOrigin:'center center', pointerEvents:'none'}} />
                            {c.enabled && c.text ? (
                              <div style={{ position:'absolute', left:'50%', bottom:0, transform:'translateX(-50%)', fontSize:c.size+'px', lineHeight:1.1, fontFamily:captionFontCss(c.font), color:'#111827', whiteSpace:'nowrap', pointerEvents:'none' }}>
                                {c.text}
                              </div>
                            ) : null}
                          </div>
                        )
                      }
                      return (imgSrc==='ERROR' ? <span className="small" style={{color:'#b91c1c'}}>blad</span> : (showGrid ? <span className="small slot-empty">pusta</span> : null))
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
              {cutOverlay}
              {showGrid ? (
              <div className="no-print" style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:1 }}>
                {Array.from({length: perPageLocal}).map((_,i)=>{
                  const g=p*perPageLocal+i
                  const idx=g - skip
                  const item = idx>=0 && idx<labels.length ? labels[idx] : null
                  const col = i % cols
                  const row = Math.floor(i / cols)
                  return (
                    <div
                      key={`bg-${i}`}
                      className="label-cell"
                      style={{
                        position:'absolute',
                        left:(col*(cellW+gapMM))+'mm',
                        top:(row*(cellH+gapMM))+'mm',
                        width:cellW+'mm',
                        height:cellH+'mm',
                        borderStyle: showGrid?'dashed':'none',
                      }}
                    >
                      {!item ? <span className="small slot-empty">pusta</span> : null}
                    </div>
                  )
                })}
              </div>
              ) : null}
              {Array.from({length: perPageLocal}).map((_,i)=>{
                const g=p*perPageLocal+i; const idx=g - skip; const item = idx>=0 && idx<labels.length ? labels[idx] : null
                if (!item) return <div key={i}></div>
                const col = i % cols; const row = Math.floor(i / cols)
                const { cellW, cellH } = metrics()
                let imgSrc=null
                try {
                  imgSrc = getPreviewImage(item, idx)
                } catch(e){ console.error('Label render error', e); imgSrc='ERROR'; lastError=cleanBwipError(e) }
                const mulX = editAll?globalMulX:((sizeOverrides[idx]?.x)||1); const mulY = editAll?globalMulY:((sizeOverrides[idx]?.y)||1)
                const is2d = TWO_D_SET.has(item.bcid)
                const drawH = cellH * mulY
                const drawW = is2d ? (cellW*mulX) : oneDWidthMM(idx, drawH)
                const defX = col*(cellW+gapMM) + (cellW - drawW) / 2
                const defY = row*(cellH+gapMM) + (cellH - drawH) / 2
                const pos = posOverrides[idx] || { x: defX, y: defY }
                return (
                  <div key={i} className={"free-node" + ((editAll || selectedIds.includes(idx))?" cell-highlight":"") + ((idx === matchedHighlightIdx) ? " cell-match-highlight" : "")} data-label-idx={idx} style={{position:'absolute', zIndex:2, left: pos.x+'mm', top: pos.y+'mm', width: drawW+'mm', height: drawH+'mm', padding:'3mm', boxSizing:'border-box', touchAction:'none', userSelect:'none'}}
                       onPointerDown={(e)=>onLabelPointerDown(e, idx, p)}>
                    {editMode && selectedIds.includes(idx) ? (
                      <button
                        type="button"
                        className={"label-delete-btn no-print" + (largeDeleteBtn ? " label-delete-btn-large" : "")}
                        aria-label={t('labels.deleteLabel')}
                        title={t('labels.deleteLabel')}
                        style={deleteBtnStyle}
                        onPointerDown={(e)=>{ e.preventDefault(); e.stopPropagation() }}
                        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); removeLabelAt(idx) }}
                      >
                        x
                      </button>
                    ) : null}
                    {imgSrc && imgSrc!=='ERROR' ? (
                      <div className="barcode-wrap" style={{position:'relative', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        {(() => {
                          const c = captionCfg(item)
                          const capPx = captionReservePx(c)
                          return (
                            <>
                              <img src={imgSrc} alt="barcode" draggable={false} onLoad={(ev)=>rememberPreviewRatio(idx, ev)} style={is2d ? {maxWidth:'100%',maxHeight:`calc(100% - ${capPx}px)`, pointerEvents:'none'} : {maxHeight:`calc(100% - ${capPx}px)`,maxWidth:'none',width:'auto', pointerEvents:'none'}} />
                              {c.enabled && c.text ? (
                                <div style={{ position:'absolute', left:'50%', bottom:0, transform:'translateX(-50%)', fontSize:c.size+'px', lineHeight:1.1, fontFamily:captionFontCss(c.font), color:'#111827', whiteSpace:'nowrap', pointerEvents:'none' }}>
                                  {c.text}
                                </div>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                    ) : (imgSrc==='ERROR' ? <span className="small" style={{color:'#b91c1c'}}>blad</span> : <span className="small slot-empty">pusta</span>)}
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
    setShowCutLines(false);
    setCutLineWeight('standard');
    setCutLineStyle('solid');
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
    const captionImageCache = new Map();
    let processed = 0;

    for (let p=0; p<pages; p++) {
      if (p>0) pdf.addPage([pageW,pageH], orientation);
      drawPdfCutLines(pdf, innerW, innerH, cellW, cellH)

      for (let i=0;i<perPage;i++) {
        const g=p*perPage+i; const idx=g - skip; const item = idx>=0 && idx<labels.length ? labels[idx] : null;
        if (!item) continue;
        const is2d = TWO_D_SET.has(item.bcid);
        let x, y, drawW, drawH;
        const c = captionCfg(item)
        // Calibrated for closer match with on-screen preview for custom captions.
        const capGapMm = c.enabled && c.text ? Math.max(0, c.gap) * 0.16 : 0
        const capTextMm = c.enabled && c.text ? Math.max(3.0, (c.size * 1.8) * 0.264583) : 0
        const captionMm = capGapMm + capTextMm
        const mulX = editAll?globalMulX:((sizeOverrides[idx]?.x)||1);
        const mulY = editAll?globalMulY:((sizeOverrides[idx]?.y)||1);
        if (!freeLayout){
          const col = i % cols; const row = Math.floor(i / cols);
          const innerX = col*(cellW+gapMM); const innerY = row*(cellH+gapMM);
          drawW = is2d ? (cellW*mulX) : cellW; drawH = (TWO_D_SET.has(item.bcid)? (cellH*mulY) : (cellH*mulY));
          x = padMM + innerX + (cellW - drawW)/2; y = padMM + innerY + (cellH - drawH)/2;
        } else {
          const col = i % cols; const row = Math.floor(i / cols);
          drawH = cellH * mulY;
          drawW = is2d ? (cellW*mulX) : oneDWidthMM(idx, drawH);
          const defX = col*(cellW+gapMM) + (cellW - drawW) / 2;
          const defY = row*(cellH+gapMM) + (cellH - drawH) / 2;
          const pos = posOverrides[idx] || { x:defX, y:defY };
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
          if (!q.forceNoText && hasTextEnabled(item) && !hasCustomCaption(item)) {
            opts.includetext = true
            opts.textxalign = 'center'
            opts.textfont = hrtFont
            opts.textsize = Math.max(6, Math.min(24, Number(item.hrtSize ?? hrtSize) || 10))
            opts.textyoffset = Math.max(-20, Math.min(80, Number(item.hrtGap ?? hrtGap) || 0))
          }
        }
        const exportKey = [
          opts.bcid, opts.text, opts.rotate, opts.scaleX, opts.scaleY || '', opts.height || '',
          opts.includetext ? 1 : 0, opts.textfont || '', opts.textsize || '', opts.textyoffset || '',
          canvasSize, canvasWidth, canvasHeight, q.imageType, q.imageQuality
        ].join('|');
        let cached = exportImageCache.get(exportKey);
        if (!cached) {
          const dataUrl = makeBitmap({ ...opts, canvasSize, canvasWidth, canvasHeight, imageFormat: q.imageType, imageQuality: q.imageQuality });
          const size = await getImageSize(dataUrl);
          cached = { dataUrl, size };
          exportImageCache.set(exportKey, cached);
        }
        const { dataUrl, size } = cached;
        const imageBoxH = Math.max(1, drawH - captionMm)
        let fit = { x, y, w: drawW, h: imageBoxH };
        if (size && is2d) {
          fit = fitRect(x, y, drawW, imageBoxH, size.w, size.h);
        } else if (size && !is2d) {
          const ratio = size.w / Math.max(1, size.h);
          const baseWAtH = imageBoxH * ratio;
          const scaledW = Math.max(1, baseWAtH * mulX);
          const finalW = Math.min(drawW, scaledW);
          fit = { x: x + (drawW - finalW)/2, y, w: finalW, h: imageBoxH };
        }
        pdf.addImage(dataUrl, q.imageType, fit.x, fit.y, fit.w, fit.h);
        if (capTextMm > 0) {
          const capWpx = Math.max(64, Math.round(drawW * q.pxPerMm))
          const capHpx = Math.max(20, Math.round(capTextMm * q.pxPerMm))
          const capKey = `${c.text}|${c.font}|${c.size}|${capWpx}|${capHpx}`
          let capImg = captionImageCache.get(capKey)
          if (!capImg) {
            capImg = makeCaptionBitmap(c.text, captionFontCss(c.font), capWpx, capHpx)
            if (capImg) captionImageCache.set(capKey, capImg)
          }
          if (capImg?.dataUrl) {
            const textY = y + imageBoxH + capGapMm
            const ratio = (capImg.textW > 0 && capImg.textH > 0) ? (capImg.textW / capImg.textH) : 1
            const capWmm = Math.max(6, Math.min(drawW, capTextMm * ratio))
            const capX = x + (drawW - capWmm) / 2
            pdf.addImage(capImg.dataUrl, 'PNG', capX, textY, capWmm, capTextMm)
          } else {
            // Fallback path if canvas creation fails.
            pdf.setFont(pdfFontName(c.font), 'normal')
            pdf.setFontSize(Math.max(6, Math.min(72, c.size)) * 0.75)
            const textY = y + imageBoxH + capGapMm
            pdf.text(c.text, x + drawW / 2, textY, { align:'center', baseline:'top' })
          }
        }

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
  const panelHrtSize = selectedPrimary != null ? Math.max(6, Math.min(24, Number(labels[selectedPrimary]?.hrtSize ?? hrtSize) || 10)) : Math.max(6, Math.min(24, Number(hrtSize) || 10))
  const panelHrtGap = selectedPrimary != null ? Math.max(-20, Math.min(80, Number(labels[selectedPrimary]?.hrtGap ?? hrtGap) || 0)) : Math.max(-20, Math.min(80, Number(hrtGap) || 0))
  const panelCustomCaptionEnabled = selectedPrimary != null ? !!labels[selectedPrimary]?.customCaptionEnabled : !!customCaptionEnabled
  const panelCustomCaptionText = selectedPrimary != null ? (labels[selectedPrimary]?.customCaptionText ?? '') : (customCaptionText ?? '')
  const panelCustomCaptionFont = selectedPrimary != null ? (labels[selectedPrimary]?.customCaptionFont || 'Arial') : (customCaptionFont || 'Arial')
  const panelCustomCaptionSize = selectedPrimary != null ? Math.max(8, Math.min(72, Number(labels[selectedPrimary]?.customCaptionSize ?? customCaptionSize) || 12)) : Math.max(8, Math.min(72, Number(customCaptionSize) || 12))
  const panelCustomCaptionGap = selectedPrimary != null ? Math.max(-20, Math.min(80, Number(labels[selectedPrimary]?.customCaptionGap ?? customCaptionGap) || 0)) : Math.max(-20, Math.min(80, Number(customCaptionGap) || 0))

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
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, includeText: !!enabled, ...(enabled ? { customCaptionEnabled: false } : {}) }) : l))
  }

  function setSelectionText(next){
    if (!targetIds.length) return
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, text: next }) : l))
  }

  function setSelectionHrtSize(next){
    if (!targetIds.length) return
    const v = Math.max(6, Math.min(24, Number(next) || 10))
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, hrtSize: v }) : l))
  }

  function setSelectionHrtGap(next){
    if (!targetIds.length) return
    const v = Math.max(-20, Math.min(80, Number(next) || 0))
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, hrtGap: v }) : l))
  }

  function setSelectionCustomCaptionEnabled(enabled){
    if (!targetIds.length) return
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, customCaptionEnabled: !!enabled, ...(enabled ? { includeText: false } : {}) }) : l))
  }

  function setSelectionCustomCaptionText(next){
    if (!targetIds.length) return
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, customCaptionText: next }) : l))
  }

  function setSelectionCustomCaptionFont(next){
    if (!targetIds.length) return
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, customCaptionFont: next }) : l))
  }

  function setSelectionCustomCaptionSize(next){
    if (!targetIds.length) return
    const v = Math.max(8, Math.min(72, Number(next) || 12))
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, customCaptionSize: v }) : l))
  }
  function setSelectionCustomCaptionGap(next){
    if (!targetIds.length) return
    const v = Math.max(-20, Math.min(80, Number(next) || 0))
    const picked = new Set(targetIds)
    setLabels((prev) => prev.map((l, i) => picked.has(i) ? ({ ...l, customCaptionGap: v }) : l))
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

  useEffect(() => {
    if (tab !== 'labels' || matchedHighlightIdx == null) return
    const clear = () => setMatchedHighlightIdx(null)
    window.addEventListener('pointerdown', clear, { capture: true, once: true })
    return () => window.removeEventListener('pointerdown', clear, { capture: true })
  }, [tab, matchedHighlightIdx])

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
  useEffect(() => {
    const isEditable = (el) => {
      if (!(el instanceof HTMLElement)) return false
      return !!el.closest('input, textarea, select, [contenteditable="true"]')
    }
    const onKeyDown = (ev) => {
      if (ev.key !== 'Delete') return
      if (tab !== 'labels' || !editMode) return
      if (!selectedIds.length) return
      if (isEditable(ev.target)) return
      ev.preventDefault()
      ev.stopPropagation()
      removeSelectedLabels(selectedIds)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [tab, editMode, selectedIds, labels.length])

  return (
    <div ref={rootRef} className="container" onWheelCapture={onNumberWheelCapture}>
      <style>{`@media print { @page { size: ${pageW}mm ${pageH}mm; margin: 0; } }`}</style>
      <div className="tabs no-print tabs-main">
        {['generator','batch','labels'].map(tabKey => (
          <div key={tabKey} className={'tab '+(tab===tabKey?'active':'')} onClick={()=>setTab(tabKey)}>
            {tabKey==='generator'?t('app.tabs.generator'):tabKey==='batch'?t('app.tabs.batch'):t('app.tabs.labels')}
          </div>
        ))}
        <div className="tabs-spacer"></div>
        <div className={'tab '+(tab==='mySheets'?'active':'')} onClick={()=>setTab('mySheets')}>
          {t('app.tabs.mySheets')}
        </div>
      </div>

      {tab==='generator' && (
        <GeneratorTab
          t={t}
          popularCodeIds={POPULAR_CODE_IDS}
          codeGroups={CODE_GROUPS}
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
          hrtSize={hrtSize}
          setHrtSize={setHrtSize}
          hrtGap={hrtGap}
          setHrtGap={setHrtGap}
          customCaptionEnabled={customCaptionEnabled}
          setCustomCaptionEnabled={setCustomCaptionEnabled}
          customCaptionText={customCaptionText}
          setCustomCaptionText={setCustomCaptionText}
          customCaptionFont={customCaptionFont}
          setCustomCaptionFont={setCustomCaptionFont}
          customCaptionSize={customCaptionSize}
          setCustomCaptionSize={setCustomCaptionSize}
          customCaptionGap={customCaptionGap}
          setCustomCaptionGap={setCustomCaptionGap}
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
          codeGroups={CODE_GROUPS}
          parseCsv={parseCsv}
          parseLines={parseLines}
          batchInput={batchInput}
          setBatchInput={setBatchInput}
          batchRows={batchRows}
          setBatchRows={setBatchRows}
          batchBcid={batchBcid}
          setBatchBcid={setBatchBcid}
          addAllFromBatch={addAllFromBatch}
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
              showGrid, setShowGrid, showCutLines, setShowCutLines, cutLineWeight, setCutLineWeight, cutLineStyle, setCutLineStyle,
              editMode, setEditMode, freeLayout, setFreeLayout, editAll, lockAspect,
              setLockAspect, globalMulX, setGlobalMulX, globalMulY, setGlobalMulY, snapMM, setSnapMM,
              posOverrides, labels, perPage, pages, sheetZoom, viewportRef, contentRef, pdfQuality, setPdfQuality,
            }}
            actions={{
              setLabels, notify, onToggleEditAll, defaultPosForIndex, clampPos, snapPos, setPosOverrides,
              clampPosToCell, setZoomCentered, exportPdf, resetLayoutDefaults, clearLabels, metrics,
              nodeSizeMM, renderLabelPages, onSheetPointerDownCapture, marqueeRect, openSaveSheetModal,
            }}
          />
          <div className={'selection-drawer no-print ' + ((selectedCount>0 || editAll) ? 'open' : '')}>
            <div ref={drawerRef} className="selection-drawer-inner">
              <div className="selection-row selection-row-top">
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
                  {CODE_GROUPS.map((group) => (
                    <optgroup key={group.key} label={t(`codesGroup.${group.key}`)}>
                      {group.ids.map((id) => (
                        <option key={id} value={id}>{t(`codes.${id.replace('-', '_')}.label`)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input className="input selection-content-input" type="text" value={panelText} disabled={editAll} onChange={(e)=>setSelectionText(e.target.value)} placeholder={editAll ? t('labels.textDisabledInEditAll') : t('labels.codeContent')} style={{ opacity: editAll ? 0.55 : 1 }} />
              </div>
              <div className="selection-row selection-row-bottom">
                <label className="hstack small">
                  <input type="checkbox" checked={panelIncludeText} onChange={(e)=>setSelectionIncludeText(e.target.checked)} />
                  {t('labels.includeText')}
                </label>
                <label className="hstack small">
                  {t('generator.hrtSize')}
                  <input className="input" type="number" min="6" max="24" step="1" value={panelHrtSize} onChange={(e)=>setSelectionHrtSize(parseInt(e.target.value||'10',10))} style={{ width: 80 }} />
                </label>
                <label className="hstack small">
                  {t('generator.hrtGap')}
                  <input className="input" type="number" min="-20" max="80" step="1" value={panelHrtGap} onChange={(e)=>setSelectionHrtGap(parseInt(e.target.value||'0',10))} style={{ width: 80 }} />
                </label>
                <span className="selection-separator" aria-hidden="true"></span>
                <label className="hstack small">
                  <input type="checkbox" checked={panelCustomCaptionEnabled} onChange={(e)=>setSelectionCustomCaptionEnabled(e.target.checked)} />
                  {t('generator.customCaption')}
                </label>
                {panelCustomCaptionEnabled ? (
                  <>
                    <input className="input" type="text" value={panelCustomCaptionText} onChange={(e)=>setSelectionCustomCaptionText(e.target.value)} placeholder={t('generator.customCaptionText')} style={{ minWidth: 170 }} />
                    <select className="select" value={panelCustomCaptionFont} onChange={(e)=>setSelectionCustomCaptionFont(e.target.value)} style={{ minWidth: 150 }}>
                      <option value="Arial">Arial</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                    <label className="hstack small">
                      {t('generator.customCaptionSize')}
                      <input className="input" type="number" min="8" max="72" step="1" value={panelCustomCaptionSize} onChange={(e)=>setSelectionCustomCaptionSize(parseInt(e.target.value||'12',10))} style={{ width: 80 }} />
                    </label>
                    <label className="hstack small">
                      {t('generator.customCaptionGap')}
                      <input className="input" type="number" min="-20" max="80" step="1" value={panelCustomCaptionGap} onChange={(e)=>setSelectionCustomCaptionGap(parseInt(e.target.value||'0',10))} style={{ width: 80 }} />
                    </label>
                  </>
                ) : null}
                <button className="button" onClick={resetSelectionChanges}>{t('labels.resetChanges')}</button>
                <button className="button" onClick={closeSelectionPanel}>{t('labels.clearSelection')}</button>
              </div>
            </div>
          </div>
        </>
      )}
      {tab==='mySheets' && (
        <MySheetsTab
          t={t}
          sheets={savedSheets}
          onOpen={loadSavedSheet}
          onRename={openRenameSheetModal}
          onDelete={openDeleteSheetModal}
        />
      )}
      {sheetModal.open ? (
        <div className="modal-backdrop no-print" onClick={closeSheetModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="vstack" style={{ gap: 10 }}>
              <strong>{sheetModal.mode === 'rename' ? t('sheets.renameTitle') : t('sheets.saveTitle')}</strong>
              <input
                className="input"
                type="text"
                value={sheetModal.name}
                onChange={(e) => setSheetModal((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('sheets.namePlaceholder')}
                autoFocus
              />
              <div className="hstack" style={{ justifyContent: 'flex-end' }}>
                <button className="button" onClick={closeSheetModal}>{t('sheets.cancel')}</button>
                <button className="button primary" onClick={submitSheetModal} disabled={!String(sheetModal.name || '').trim()}>{t('sheets.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {deleteSheetModal.open ? (
        <div className="modal-backdrop no-print" onClick={closeDeleteSheetModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="vstack" style={{ gap: 10 }}>
              <strong>{t('sheets.deleteTitle')}</strong>
              <div className="small">{t('sheets.deleteQuestion', { name: deleteSheetModal.name })}</div>
              <div className="hstack" style={{ justifyContent: 'flex-end' }}>
                <button className="button" onClick={closeDeleteSheetModal}>{t('sheets.cancel')}</button>
                <button className="button primary" onClick={confirmDeleteSheet}>{t('sheets.deleteConfirm')}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!!toast && <div className="toast">{toast}</div>}
    </div>
  )
}
