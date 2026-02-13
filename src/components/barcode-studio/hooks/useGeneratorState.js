import { useEffect, useMemo, useState } from 'react'
import { validateGs1 } from '../../../utils/gs1.js'
import { TWO_D_SET } from '../../../utils/barcodeRender.js'

const SUPPORTED_HRT_FONTS = new Set(['OCR-A', 'OCR-B'])

function normalizeHrtFont(value) {
  const v = String(value || '').trim().toUpperCase()
  return SUPPORTED_HRT_FONTS.has(v) ? v : 'OCR-B'
}

function normalizeInput(bcid, value) {
  let v = (value || '').toString().trim()
  if (['ean13', 'ean8', 'itf14'].some((x) => bcid.startsWith(x))) {
    v = v.replace(/[^0-9]/g, '')
  }
  return v
}

function cleanBwipError(err, t) {
  const raw = ((err && (err.message || err)) || '') + ''
  let s = raw
    .replace(/^(?:Błąd|Blad|Error)\s*:\s*/i, '')
    .replace(/(?:bwipp|bwip-js)[.:][\w-]+(?:#\d+)?:\s*/ig, '')
    .replace(/\s+at\s+[\s\S]*$/, '')
    .trim()

  const codeMatch = raw.match(/(?:bwipp|bwip-js)[.:]([\w-]+)(?:#\d+)?:\s*/i)
  const code = codeMatch && codeMatch[1] ? codeMatch[1].toLowerCase() : null

  const dict = {
    ean13badlength: t('errors.ean13badlength'),
    ean8badlength: t('errors.ean8badlength'),
    upcabadlength: t('errors.upcabadlength'),
    upcebadlength: t('errors.upcebadlength'),
    itf14badlength: t('errors.itf14badlength'),
    isbn10badlength: 'ISBN-10 musi mieć 9 lub 10 cyfr (bez myślników)',
    isbn13badlength: 'ISBN-13 musi mieć 12 lub 13 cyfr (bez myślników)',
    code39badcharacter: t('errors.code39badcharacter'),
    code128badcharacter: t('errors.code128badcharacter'),
    itfbadcharacter: 'ITF (Interleaved 2 of 5) akceptuje tylko cyfry',
    postnetbadcharacter: 'POSTNET akceptuje tylko cyfry',
    badcheckdigit: t('errors.badcheckdigit'),
    badchecksum: t('errors.badchecksum'),
    qrcodetoolong: t('errors.toolong'),
    datamatrixtoolong: t('errors.toolong'),
    pdf417toolong: t('errors.toolong'),
  }
  if (code && dict[code]) return dict[code]

  if (/bar code text not specified/i.test(s) || /text not specified/i.test(s)) return t('generator.errorNoText')
  if (!s) s = t('errors.fallback')

  s = s.replace(/\bmust be\b/gi, 'musi mieć')
    .replace(/\bshould be\b/gi, 'powinno mieć')
    .replace(/\bdigits?\b/gi, 'cyfr')
    .replace(/\binvalid\b/gi, 'nieprawidłowy')
    .replace(/\btoo long\b/gi, 'za długi')
    .replace(/\btoo short\b/gi, 'za krótki')
    .replace(/[.:\s]+$/, '')
    .trim()

  return s
}

export default function useGeneratorState({ t, toSvg, makeBitmap }) {
  const [bcid, setBcid] = useState('qrcode')
  const [text, setText] = useState('DOCK.001')
  const [scale, setScale] = useState(4)
  const [height, setHeight] = useState(50)
  const [includeText, setIncludeText] = useState(true)
  const [hrtFont, setHrtFont] = useState('OCR-B')
  const [rotate, setRotate] = useState(0)
  const [error, setError] = useState('')
  const [genPreviewUrl, setGenPreviewUrl] = useState('')
  const [pngMul, setPngMul] = useState(4)
  const [downloadWhiteBg, setDownloadWhiteBg] = useState(true)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('rbs_gen') || 'null')
      if (saved) {
        setBcid(saved.bcid || 'qrcode')
        setText(typeof saved.text === 'string' ? saved.text : '')
        setScale(+saved.scale || 4)
        setHeight(+saved.height || 50)
        setIncludeText(!!saved.includeText)
        setRotate(+saved.rotate || 0)
        if (saved.hrtFont) setHrtFont(normalizeHrtFont(saved.hrtFont))
      }
      const u = localStorage.getItem('rbs_gen_url')
      if (u) setGenPreviewUrl(u)
      const pm = parseInt(localStorage.getItem('rbs_pngmul') || '4', 10)
      if (!Number.isNaN(pm)) setPngMul(pm)
      const bg = localStorage.getItem('rbs_whitebg')
      if (bg != null) setDownloadWhiteBg(bg === '1')
    } catch (_) {
      // ignore invalid localStorage values
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('rbs_gen', JSON.stringify({ bcid, text, scale, height, includeText, rotate, hrtFont }))
    } catch (_) {
      // ignore storage errors
    }
  }, [bcid, text, scale, height, includeText, rotate, hrtFont])

  useEffect(() => {
    try {
      localStorage.setItem('rbs_pngmul', String(pngMul))
    } catch (_) {
      // ignore storage errors
    }
  }, [pngMul])

  useEffect(() => {
    try {
      localStorage.setItem('rbs_whitebg', downloadWhiteBg ? '1' : '0')
    } catch (_) {
      // ignore storage errors
    }
  }, [downloadWhiteBg])

  useEffect(() => {
    try {
      const opts = { bcid, text: normalizeInput(bcid, text || ''), rotate }
      const base = Number(scale) || 3
      if (TWO_D_SET.has(bcid)) {
        opts.scaleX = base
        opts.scaleY = base
      } else {
        opts.scaleX = base
        opts.height = Number(height) || 50
        if (includeText) {
          opts.includetext = true
          opts.textxalign = 'center'
          opts.textfont = hrtFont
        }
      }
      try {
        const svg = toSvg(opts)
        const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
        setGenPreviewUrl(url)
        localStorage.setItem('rbs_gen_url', url)
        setError('')
      } catch (_) {
        const png = makeBitmap(opts)
        setGenPreviewUrl(png)
        localStorage.setItem('rbs_gen_url', png)
        setError('')
      }
    } catch (e) {
      setError(cleanBwipError(e, t))
    }
  }, [bcid, text, scale, height, includeText, hrtFont, rotate, toSvg, makeBitmap, t])

  const gs1Report = useMemo(() => {
    if (bcid !== 'gs1-128' && bcid !== 'qrcode' && bcid !== 'datamatrix') return null
    if (!text.includes('(')) return null
    return validateGs1(text)
  }, [text, bcid])

  return {
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
  }
}
