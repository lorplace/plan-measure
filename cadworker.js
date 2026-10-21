// Reads a DXF/DWG off the main thread and returns compact typed arrays. The worker is terminated after one file, freeing the WebAssembly heap.
self.window = self; importScripts('lib/dxf-parser.js', 'cad.js');
onmessage = async e => {
  try { const M = await CAD.parse(new Uint8Array(e.data.bytes), e.data.kind); const P = CAD.pack(M); delete P.toWorld; postMessage({ ok: true, P }, CAD.transfers(P)); }
  catch (err) { postMessage({ ok: false, error: String((err && err.message) || err) }); }
};
