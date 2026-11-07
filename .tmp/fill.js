const node = await figma.getNodeByIdAsync("148:506");
const out = node.fills.map((f) => ({
  type: f.type,
  scaleMode: f.scaleMode,
  imageTransform: f.imageTransform,
  filters: f.filters,
  imageHash: f.imageHash,
  opacity: f.opacity,
}));
const img = figma.getImageByHash(node.fills[0].imageHash);
const bytes = await img.getBytesAsync();
let head = "";
for (let i = 0; i < Math.min(bytes.length, 4); i++) head += bytes[i].toString(16) + " ";
return { box: { w: Math.round(node.width), h: Math.round(node.height) }, fills: out, bytes: bytes.length, head };
