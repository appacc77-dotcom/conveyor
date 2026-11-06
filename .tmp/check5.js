const n = await figma.getNodeByIdAsync("719:529");
const out = { name: n && n.name, fills: n && n.fills.map(f => ({ type: f.type, hash: f.imageHash })) };
const img = n && n.fills.find(f => f.type === "IMAGE");
if (img) {
  const byHash = figma.getImageByHash(img.imageHash);
  out.resolved = !!byHash;
  out.bytes = byHash ? (await byHash.getBytesAsync()).length : null;
}
return out;
