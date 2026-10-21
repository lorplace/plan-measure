// Unit helpers. All real-world lengths are stored in metres.
(function(g){
const IN=0.0254, FT=0.3048;
function frac(s){s=s.trim();if(!s)return 0;let t=0;for(const p of s.split(/[\s-]+/)){if(!p)continue;if(p.includes('/')){const[a,b]=p.split('/');t+=parseFloat(a)/parseFloat(b);}else t+=parseFloat(p);}return t;}
// Parse "12'6\"", "12' 6 1/2\"", "12'-6", "20ft", "3.5m", "3500mm", "35cm", "18in". Returns metres or NaN.
function parseLength(str, defUnit){
  let s=String(str).trim().toLowerCase().replace(/[’′]/g,"'").replace(/[”″]/g,'"').replace(/,/g,'.');
  if(!s) return NaN;
  let m;
  if((m=s.match(/^([\d.]+)\s*(mm|cm|m)$/))){return parseFloat(m[1])*{mm:.001,cm:.01,m:1}[m[2]];}
  if((m=s.match(/^([\d.\s\/]+)\s*(ft|feet|foot|')\s*-?\s*([\d.\s\/]*)\s*(in|inch|inches|")?$/))){
    return parseFloat(m[1])*FT + (m[3]?frac(m[3])*IN:0);
  }
  if((m=s.match(/^([\d.\s\/]+)\s*(in|inch|inches|")$/))) return frac(m[1])*IN;
  if(/^[\d.]+$/.test(s)) return parseFloat(s)*(defUnit==='mm'?0.001:defUnit==='met'?1:FT);
  return NaN;
}
// 'mm' (default), 'met' (m) and 'imp' (feet-inches). Areas in metric modes are m².
const DEFAULT_UNITS='mm';
function isMet(u){return u==='met'||u==='mm';}
function gcd(a,b){return b?gcd(b,a%b):a}
function fmtLen(m, units){
  if(!isFinite(m)) return '-';
  if(units==='mm') return Math.round(m*1000)+' mm';
  if(units==='met') return (m<1? (m*1000).toFixed(0)+' mm' : m.toFixed(2)+' m');
  let ti=Math.round(m/IN*4)/4, neg=ti<0; ti=Math.abs(ti);
  let ft=Math.floor(ti/12), inch=ti-ft*12, whole=Math.floor(inch), q=Math.round((inch-whole)*4);
  let fs=''; if(q){const d=gcd(q,4); fs=' '+(q/d)+'/'+(4/d);}
  return (neg?'-':'')+ft+"'-"+whole+fs+'"';
}
function fmtArea(m2, units){
  if(isMet(units)) return m2.toFixed(2)+' m²';
  return (m2/(FT*FT)).toFixed(1)+' sq ft';
}
// Standard scales: metres of real world per PDF point (1/72 inch of paper).
const PT=IN/72;
const STD=[
 ['1/16" = 1\'-0"',192],['3/32" = 1\'-0"',128],['1/8" = 1\'-0"',96],['3/16" = 1\'-0"',64],['1/4" = 1\'-0"',48],
 ['3/8" = 1\'-0"',32],['1/2" = 1\'-0"',24],['3/4" = 1\'-0"',16],['1" = 1\'-0"',12],['1 1/2" = 1\'-0"',8],['3" = 1\'-0"',4],
 ['1" = 10\' (eng)',120],['1" = 20\' (eng)',240],['1" = 30\' (eng)',360],['1" = 40\' (eng)',480],['1" = 50\' (eng)',600],['1" = 100\' (eng)',1200],
 ['1:1',1],['1:5',5],['1:10',10],['1:20',20],['1:25',25],['1:50',50],['1:75',75],['1:100',100],['1:200',200],['1:250',250],['1:500',500],['1:1000',1000]
].map(([n,r])=>({name:n,ratio:r,mPerPt:PT*r}));
const U={DEFAULT_UNITS,isMet,IN,FT,PT,parseLength,fmtLen,fmtArea,STD};
if(typeof module!=='undefined') module.exports=U; else g.Units=U;
})(this);
