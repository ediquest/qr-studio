import { useEffect, useRef, useState } from 'react'

export default function useLabelsLayoutState({ presets }) {
  const [labels, setLabels] = useState([])
  const [skip, setSkip] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [editMode, setEditMode] = useState(true)
  const [editAll, setEditAll] = useState(false)
  const [globalMulX, setGlobalMulX] = useState(1)
  const [globalMulY, setGlobalMulY] = useState(1)
  const [lockAspect, setLockAspect] = useState(false)
  const [sizeOverrides, setSizeOverrides] = useState({})
  const [posOverrides, setPosOverrides] = useState({})
  const [freeLayout, setFreeLayout] = useState(false)
  const [presetKey, setPresetKey] = useState(presets[0].key)
  const preset = presets.find((p) => p.key === presetKey) || presets[0]
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
  const [snapMM, setSnapMM] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState(null)

  useEffect(() => {
    setCols(preset.cols)
    setRows(preset.rows)
    setPageW(preset.pageW)
    setPageH(preset.pageH)
    setGapMM(preset.gapMM)
    setPadMM(preset.padMM)
    setSheetZoom(presetKey === 'a4-1x1p' || presetKey === 'a4-1x1l' ? 0.5 : 1)
  }, [presetKey, preset.cols, preset.rows, preset.pageW, preset.pageH, preset.gapMM, preset.padMM])

  const perPage = Math.max(1, (cols | 0) * (rows | 0))
  const totalCells = (skip | 0) + labels.length
  const pages = Math.ceil(totalCells / perPage) || 1

  return {
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
    preset,
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
    perPage,
    pages,
  }
}
