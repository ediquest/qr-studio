import * as bw from 'bwip-js'

const BCID_ALIASES = {
  rm4scc: 'royalmail',
}

export const TWO_D_SET = new Set(['qrcode', 'datamatrix', 'pdf417', 'azteccode'])

export function resolveBcid(id) {
  return BCID_ALIASES[id] || id
}

function rotCode(deg) {
  const m = { 0: 'N', 90: 'R', 180: 'I', 270: 'L' }
  return m[deg] ?? 'N'
}

export function hasToSVG() {
  try {
    return typeof bw.toSVG === 'function' || typeof bw.toSvg === 'function'
  } catch (_) {
    return false
  }
}

export function toSvg(opts) {
  const fn = bw.toSVG || bw.toSvg
  if (!fn) throw new Error('bwip-js: toSVG not available')
  return fn({ ...opts, rotate: rotCode(opts.rotate || 0) })
}

export function makeBitmap(opts) {
  const {
    canvasSize = 1000,
    canvasWidth = null,
    canvasHeight = null,
    imageFormat = 'png',
    imageQuality = 0.8,
    ...bwipOpts
  } = (opts || {})
  const size = Math.max(220, Math.min(1800, Math.round(canvasSize)))
  const width = canvasWidth != null ? Math.max(220, Math.min(1800, Math.round(canvasWidth))) : size
  const height = canvasHeight != null ? Math.max(220, Math.min(1800, Math.round(canvasHeight))) : size
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const fmt = String(imageFormat).toLowerCase()
  if (fmt === 'jpeg' || fmt === 'jpg') {
    const bg = canvas.getContext('2d')
    if (bg) {
      bg.fillStyle = '#ffffff'
      bg.fillRect(0, 0, width, height)
    }
  }
  const fn = bw.toCanvas
  if (!fn) throw new Error('bwip-js: toCanvas not available')
  const safe = { ...bwipOpts, rotate: rotCode((bwipOpts && bwipOpts.rotate) || 0) }
  fn(canvas, safe)
  if (fmt === 'jpeg' || fmt === 'jpg') {
    return canvas.toDataURL('image/jpeg', Math.max(0.1, Math.min(1, Number(imageQuality) || 0.8)))
  }
  return canvas.toDataURL('image/png')
}

export function getSvgSize(svgStr) {
  if (!svgStr) return null
  const vb = svgStr.match(/viewBox="([\d.\s]+)"/i)
  if (vb && vb[1]) {
    const parts = vb[1].trim().split(/\s+/).map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return { w: parts[2], h: parts[3] }
  }
  const w = svgStr.match(/width="([\d.]+)[^"]*"/i)
  const h = svgStr.match(/height="([\d.]+)[^"]*"/i)
  if (w && h) return { w: parseFloat(w[1]), h: parseFloat(h[1]) }
  return null
}

export function fitRect(x, y, w, h, iw, ih) {
  if (!iw || !ih) return { x, y, w, h }
  const s = Math.min(w / iw, h / ih)
  const fw = iw * s
  const fh = ih * s
  return { x: x + (w - fw) / 2, y: y + (h - fh) / 2, w: fw, h: fh }
}

export function getImageSize(dataUrl) {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => res({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height })
    img.onerror = () => res(null)
    img.src = dataUrl
  })
}
