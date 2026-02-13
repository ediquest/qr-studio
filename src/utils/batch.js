import Papa from 'papaparse';
export function parseLines(text, { splitCaption = false, separator = ';' } = {}){
  const sep = String(separator ?? ';')
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((line) => {
      if (!splitCaption || !sep) return { text: line, caption: '' }
      const idx = line.indexOf(sep)
      if (idx < 0) return { text: line, caption: '' }
      const textPart = line.slice(0, idx).trim()
      const captionPart = line.slice(idx + sep.length).trim()
      return { text: textPart, caption: captionPart }
    })
    .filter((row) => String(row?.text || '').trim().length > 0)
}
export function parseCsv(file,onDone,onError){ Papa.parse(file,{ header:false, skipEmptyLines:true, complete:r=>{ const rows=r.data.map(x=>x.map(String).join(',').trim()).filter(Boolean); onDone(rows); }, error:err=>onError?.(err) }) }
export function detectNumericRun(pattern){ const m=pattern.match(/^(.*?)(\d+)([^\d]*)$/); if(!m) return null; return {prefix:m[1], start:parseInt(m[2],10), width:m[2].length, suffix:m[3]} }
export function generateSequence(pattern,{count=10,step=1,start=null,padWidth=null}={}){ const info=detectNumericRun(pattern); let prefix,s,width,suffix; if(info){ prefix=info.prefix; s=start==null?info.start:start; width=padWidth==null?info.width:padWidth; suffix=info.suffix; } else { prefix=pattern; s=start==null?1:start; width=padWidth==null?String(s).length:padWidth; suffix=''; } const out=[]; for(let i=0;i<count;i++){ const n=s+i*step; const num=String(n).padStart(width,'0'); out.push(prefix+num+suffix); } return out; }
