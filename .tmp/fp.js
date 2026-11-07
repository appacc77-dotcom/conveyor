const node = await figma.getNodeByIdAsync("334:992");
let err = null;
try {
  const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 } });
  err = "ok " + bytes.length;
} catch (e) { err = String(e && e.message).slice(0, 140); }
return { export: err, w: Math.round(node.width), h: Math.round(node.height), kids: node.children.length };
