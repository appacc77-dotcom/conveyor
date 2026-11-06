const ids = ["102:225", "719:306", "719:381", "719:455", "719:529"];
const out = [];
for (const id of ids) {
  const n = await figma.getNodeByIdAsync(id);
  if (!n) { out.push({ id, missing: true }); continue; }
  const f = n.fills.find((x) => x.type === "IMAGE");
  out.push({ id, hash: f && f.imageHash, transform: f && f.imageTransform });
}
return out;
