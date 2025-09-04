
const AI_RULES = {
  '00': { len: 18, numeric: true, fixed: true, name: 'SSCC' },
  '01': { len: 14, numeric: true, fixed: true, name: 'GTIN' },
  '10': { len: 1, max: 20, numeric: false, fixed: false, name: 'Batch/Lot' },
  '11': { len: 6, numeric: true, fixed: true, name: 'Prod. date (YYMMDD)' },
  '15': { len: 6, numeric: true, fixed: true, name: 'Best before (YYMMDD)' },
  '17': { len: 6, numeric: true, fixed: true, name: 'Exp. date (YYMMDD)' },
  '21': { len: 1, max: 20, numeric: false, fixed: false, name: 'Serial' },
  '414': { len: 13, numeric: true, fixed: true, name: 'GS1 GLN of location' }
};
function isDigits(s){return /^[0-9]+$/.test(s)}; function isAlnum(s){return /^[0-9A-Za-z\-\./ %+$]*$/.test(s)}
export function parseGs1(text){ const parts=[]; const re=/\((\d{2,4})\)([^()]*)/g; let m; while((m=re.exec(text))) parts.push({ai:m[1], value:m[2]}); return parts;}
export function validateGs1(text){ const parts=parseGs1(text); if(!parts.length) return {ok:false,issues:['Nie znaleziono AI w nawiasach ().'],parts:[]}; const issues=[]; for(const p of parts){ const rule=AI_RULES[p.ai]; if(!rule){ issues.push(`AI (${p.ai}) nieznany (sprawdz specyfikację GS1).`); continue; } const v=p.value; if(rule.fixed){ if(v.length!==rule.len) issues.push(`AI (${p.ai}) powinno mieć dokładnie ${rule.len} znaków.`);} else { if(v.length<rule.len) issues.push(`AI (${p.ai}) powinno mieć min. ${rule.len} znaków.`); if(rule.max && v.length>rule.max) issues.push(`AI (${p.ai}) może mieć maks. ${rule.max} znaków.`);} if(rule.numeric && !isDigits(v)) issues.push(`AI (${p.ai}) musi być numeryczne.`); if(!rule.numeric && !isAlnum(v)) issues.push(`AI (${p.ai}) dopuszcza znaki alfanumeryczne i kilka znaków specjalnych.`);} return {ok:issues.length===0,issues,parts};}
