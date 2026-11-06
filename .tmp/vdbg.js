const id = "79:105";
try {
  const base = await figma.getNodeByIdAsync(id);
  const out = { name: base.name, type: base.type };
  out.hasPageAsync = typeof base.getPageAsync;
  out.rootChildren = figma.root.children.length;
  const pg = figma.root.children[0];
  out.pageFindAll = typeof pg.findAll;
  const found = pg.findAll((n) => n.name === base.name);
  out.found = found.length;
  return out;
} catch (e) {
  return { error: String(e && e.message), stack: String(e && e.stack).slice(0, 300) };
}
