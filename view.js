// Full-screen choice and print fit. No drawing and no measurement math.
// iPhone Safari has no element Fullscreen API, so it uses a page-level immersive mode.
(function (g) {
  const LETTER = { short: 612, long: 792 };

  function isIphone(ua) {
    const u = String(ua || '');
    return /iPhone|iPod/.test(u);
  }

  // 'api' uses element.requestFullscreen. 'immersive' hides the chrome in the page.
  function fullscreenStrategy(support) {
    if (!support || support.iphone) return 'immersive';
    if (support.requestFullscreen || support.webkitRequestFullscreen) return 'api';
    return 'immersive';
  }

  function fitSheet(sheetW, sheetH, opts) {
    if (!(sheetW > 0) || !(sheetH > 0)) throw new Error('sheet size');
    const margin = opts && opts.margin != null ? opts.margin : 36;
    const landscape = sheetW >= sheetH;
    const pageW = landscape ? LETTER.long : LETTER.short;
    const pageH = landscape ? LETTER.short : LETTER.long;
    const innerW = pageW - margin * 2;
    const innerH = pageH - margin * 2;
    if (!(innerW > 0) || !(innerH > 0)) throw new Error('margin');
    const scale = Math.min(innerW / sheetW, innerH / sheetH);
    const drawW = sheetW * scale;
    const drawH = sheetH * scale;
    return {
      orientation: landscape ? 'landscape' : 'portrait',
      pageW, pageH, margin, scale,
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      drawW, drawH
    };
  }

  function rasterSize(drawWpt, drawHpt, opts) {
    if (!(drawWpt > 0) || !(drawHpt > 0)) throw new Error('draw size');
    const dpi = opts && opts.dpi != null ? opts.dpi : 192;
    const maxPx = opts && opts.maxPixels != null ? opts.maxPixels : 12e6;
    const maxEdge = opts && opts.maxEdge != null ? opts.maxEdge : 4096;
    let w = drawWpt * dpi / 72;
    let h = drawHpt * dpi / 72;
    let s = 1;
    if (w * h > maxPx) s = Math.min(s, Math.sqrt(maxPx / (w * h)));
    if (w * s > maxEdge) s = Math.min(s, maxEdge / w);
    if (h * s > maxEdge) s = Math.min(s, maxEdge / h);
    return { w: Math.max(1, Math.floor(w * s)), h: Math.max(1, Math.floor(h * s)) };
  }

  function printPlan(sheetW, sheetH, opts) {
    const fit = fitSheet(sheetW, sheetH, opts);
    return { orientation: fit.orientation, fit, pixels: rasterSize(fit.drawW, fit.drawH, opts), quantities: !!(opts && opts.quantities) };
  }

  const api = { LETTER, isIphone, fullscreenStrategy, fitSheet, rasterSize, printPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.View = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
