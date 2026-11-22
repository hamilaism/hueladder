import { contrast, rgbToHex, linearToSrgb } from '../../engine/lib/color.mjs';
import { apcaLc } from '../../engine/lib/apca.mjs';
const grayY = Y => { const v = linearToSrgb(Y); return rgbToHex({r:v,g:v,b:v}); };
const Yof = h => { const c=parseInt(h.slice(1,3),16)/255; return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4; };
for (const bg of ['#121212','#000000','#1f1f1f','#262626']) {
  const Yb = Yof(bg);
  console.log(`== dark bg ${bg} (Y=${Yb.toFixed(4)}, max CR vs white ${(1.05/(Yb+0.05)).toFixed(2)})`);
  for (const CR of [1.5, 3, 4.5, 7]) {
    const Yl = 1.05/CR - 0.05, Yd = CR*(Yb+0.05)-0.05;
    const l = grayY(Yl), d = grayY(Math.min(1,Yd));
    const Lcl = apcaLc(l, '#ffffff'), Lcd = apcaLc(d, bg);
    // find WCAG ratio in dark that matches |Lc| of light
    let lo=Yb, hi=1; for (let i=0;i<50;i++){ const m=(lo+hi)/2; if (Math.abs(apcaLc(grayY(m),bg))<Math.abs(Lcl)) lo=m; else hi=m; }
    const need = (lo+0.05)/(Yb+0.05);
    console.log(`CR ${CR}: light ${l} on white Lc ${Lcl.toFixed(1)} | dark mirror ${d} Lc ${Lcd.toFixed(1)} | WCAG ratio needed in dark for same |Lc|: ${need>1.05/(Yb+0.05)?'unreachable':need.toFixed(2)}`);
  }
}
