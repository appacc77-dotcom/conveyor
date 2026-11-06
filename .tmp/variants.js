const id = "__ID__";
const base = await figma.getNodeByIdAsync(id);
if (!base) return { error: "not found" };
const page = base.getPageAsync ? await base.getPageAsync() : null;

function collect(node, acc) {
  const walk = (n) => {
    if (n.type === "TEXT") acc.texts.push({ name: n.name, text: n.characters });
    const f = (n.fills || []).find((x) => x.type === "IMAGE");
    if (f) acc.images.push({ name: n.name, hash: f.imageHash });
    if (n.type === "INSTANCE" && n.componentProperties) {
      const props = {};
      for (const [k, v] of Object.entries(n.componentProperties)) props[k] = v.value;
      acc.props.push({ name: n.name, props });
    }
    for (const c of n.children || []) walk(c);
  };
  walk(node);
  return acc;
}

// все узлы с тем же именем и типом по всему файлу
const twins = [];
for (const pg of figma.root.children) {
  for (const n of pg.findAll((x) => x.name === base.name && x.type === base.type && x.id !== base.id)) twins.push(n);
}
const states = [{ id: base.id, acc: collect(base, { texts: [], images: [], props: [] }) }];
for (const t of twins) states.push({ id: t.id, acc: collect(t, { texts: [], images: [], props: [] }) });

const diffs = states.map((s) => {
  const b = states[0].acc;
  return {
    id: s.id,
    texts: s.acc.texts.map((t, i) => (b.texts[i] && b.texts[i].text !== t.text ? { name: t.name, from: (b.texts[i].text || "").slice(0, 40), to: (t.text || "").slice(0, 40) } : null)).filter(Boolean),
    images: s.acc.images.map((im, i) => (b.images[i] && b.images[i].hash !== im.hash ? { name: im.name, from: (b.images[i].hash || "").slice(0, 8), to: (im.hash || "").slice(0, 8) } : null)).filter(Boolean),
    props: s.acc.props.map((p, i) => {
      const other = b.props[i];
      if (!other) return null;
      const changed = {};
      for (const k of Object.keys(p.props)) if (other.props[k] !== p.props[k]) changed[k] = { from: other.props[k], to: p.props[k] };
      return Object.keys(changed).length ? { name: p.name, changed } : null;
    }).filter(Boolean),
  };
});
return { name: base.name, total: states.length, diffs };
