// Read-only: one section subtree + asset candidates. __NODE_ID__ подставляет экспортёр.
const ROOT_ID = "__NODE_ID__";
const MAX_DEPTH = 12;
const ICON_MAX = 64;

await figma.loadAllPagesAsync();

const styleNames = new Map();
for (const s of await figma.getLocalTextStylesAsync()) styleNames.set(s.id, s.name);
for (const s of await figma.getLocalPaintStylesAsync()) styleNames.set(s.id, s.name);

const root = await figma.getNodeByIdAsync(ROOT_ID);
if (!root) return { error: "E_NOT_FOUND", id: ROOT_ID };

const rgba = (c) => {
  if (!c) return null;
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return { hex: `#${h(c.r)}${h(c.g)}${h(c.b)}`, a: +(c.a ?? 1).toFixed(3) };
};

const nodes = [];
const images = [];
const iconCandidates = [];
const seenImage = new Set();

function hasText(n) {
  if (n.type === "TEXT") return true;
  if ("children" in n) return n.children.some(hasText);
  return false;
}

function walk(n, depth) {
  const o = {
    id: n.id,
    name: n.name,
    type: n.type,
    depth,
    visible: n.visible,
    x: Math.round(n.x),
    y: Math.round(n.y),
    w: Math.round(n.width),
    h: Math.round(n.height),
  };

  if (n.type === "TEXT") {
    o.text = n.characters;
    o.styleName = n.textStyleId ? styleNames.get(n.textStyleId) ?? null : null;
    o.fontFamily = n.fontName?.family ?? null;
    o.fontStyle = n.fontName?.style ?? null;
    o.fontSize = n.fontSize;
    o.lineHeight = n.lineHeight;
    o.letterSpacing = n.letterSpacing;
    // Без этого текст расходится с макетом: регистр, выравнивание, подчёркивание.
    if (n.textCase && n.textCase !== "ORIGINAL") o.textCase = n.textCase;
    if (n.textAlignHorizontal && n.textAlignHorizontal !== "LEFT") o.textAlign = n.textAlignHorizontal;
    if (n.textAlignVertical && n.textAlignVertical !== "TOP") o.textAlignV = n.textAlignVertical;
    if (n.textDecoration && n.textDecoration !== "NONE") o.textDecoration = n.textDecoration;
    if (n.paragraphSpacing) o.paragraphSpacing = n.paragraphSpacing;
    if (n.textAutoResize && n.textAutoResize !== "NONE") o.autoResize = n.textAutoResize;
  }

  if ("fills" in n && Array.isArray(n.fills) && n.fills.length) {
    o.fills = [];
    for (const f of n.fills) {
      const rec = { type: f.type, visible: f.visible, opacity: f.opacity };
      if (f.type === "SOLID") rec.color = rgba(f.color);
      if (f.type === "IMAGE") {
        rec.scaleMode = f.scaleMode;
        rec.imageTransform = f.imageTransform;
        rec.imageHash = f.imageHash;
        // Настройки изображения (экспозиция, насыщенность…) — часть заливки.
        // Без них фон уезжает по цвету: у pain exposure +0,35, saturation −0,13.
        rec.filters = f.filters ?? null;
        if (f.imageHash && !seenImage.has(f.imageHash)) {
          seenImage.add(f.imageHash);
          images.push({ hash: f.imageHash, nodeId: n.id, nodeName: n.name, w: o.w, h: o.h });
        }
      }
      if (f.gradientStops) {
        rec.gradientStops = f.gradientStops.map((g) => ({
          position: +g.position.toFixed(3),
          color: rgba(g.color),
        }));
        rec.gradientTransform = f.gradientTransform;
      }
      o.fills.push(rec);
    }
  }

  if ("layoutMode" in n && n.layoutMode && n.layoutMode !== "NONE") {
    o.autoLayout = {
      mode: n.layoutMode,
      gap: n.itemSpacing,
      pad: [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft],
      primary: n.primaryAxisAlignItems,
      counter: n.counterAxisAlignItems,
    };
    if (n.layoutWrap && n.layoutWrap !== "NO_WRAP") o.autoLayout.wrap = n.layoutWrap;
  }

  if ("cornerRadius" in n && n.cornerRadius) o.radius = n.cornerRadius;
  if ("strokes" in n && Array.isArray(n.strokes) && n.strokes.length) {
    o.strokes = n.strokes.map((s) => ({ type: s.type, color: rgba(s.color) }));
    o.strokeWeight = n.strokeWeight;
    if (n.strokeAlign && n.strokeAlign !== "INSIDE") o.strokeAlign = n.strokeAlign;
  }

  // Эффекты: размытие фона (шапка) и тени карточек. Без них вёрстка «плоская».
  if ("effects" in n && Array.isArray(n.effects) && n.effects.length) {
    o.effects = n.effects
      .filter((e) => e.visible !== false)
      .map((e) => ({
        type: e.type,
        radius: e.radius,
        ...(e.offset ? { offset: { x: +e.offset.x.toFixed(1), y: +e.offset.y.toFixed(1) } } : {}),
        ...(e.color ? { color: rgba(e.color) } : {}),
        ...(e.spread ? { spread: e.spread } : {}),
      }));
    if (!o.effects.length) delete o.effects;
  }

  // Как узел ведёт себя в раскладке: FILL — тянется, HUG — по содержимому.
  if ("layoutSizingHorizontal" in n) {
    const sizing = {};
    if (n.layoutSizingHorizontal !== "FIXED") sizing.h = n.layoutSizingHorizontal;
    if (n.layoutSizingVertical !== "FIXED") sizing.v = n.layoutSizingVertical;
    if (Object.keys(sizing).length) o.sizing = sizing;
  }
  if (n.clipsContent === false) o.clips = false;
  // Повёрнутые элементы: в файле их 298, без угла вёрстка их не воспроизводит.
  if (n.rotation) o.rotation = +n.rotation.toFixed(2);
  if (n.isMask) o.mask = true;
  if (n.blendMode && n.blendMode !== "PASS_THROUGH" && n.blendMode !== "NORMAL") o.blend = n.blendMode;
  if (n.strokeDashes?.length) o.strokeDashes = n.strokeDashes;
  if (n.opacity !== 1) o.opacity = +n.opacity.toFixed(3);
  if ("minWidth" in n && (n.maxWidth != null || n.minWidth != null)) {
    o.limits = {};
    if (n.minWidth != null) o.limits.minW = n.minWidth;
    if (n.maxWidth != null) o.limits.maxW = n.maxWidth;
  }

  // Привязки к переменным: чем на самом деле задан отступ или цвет.
  const bound = n.boundVariables;
  if (bound && Object.keys(bound).length) {
    o.bound = Object.fromEntries(
      Object.entries(bound).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => x.id) : v?.id ?? v]),
    );
  }
  if (n.description && n.description.trim()) o.description = n.description.trim();
  try {
    const ann = n.annotations;
    if (ann && ann.length) o.annotations = ann.map((a) => a.label ?? a.labelMarkdown ?? "");
  } catch (e) {
    /* аннотации есть не во всех версиях плагина */
  }

  nodes.push(o);

  // Варианты компонента: из них собирается API компонента (theme × size × caps).
  if (n.type === "INSTANCE" && n.componentProperties && Object.keys(n.componentProperties).length) {
    o.props = Object.fromEntries(
      Object.entries(n.componentProperties).map(([k, v]) => [k, v.value]),
    );
  }

  // Иконка: инстанс без текста внутри и небольшой — его выгодно держать вектором.
  if (n.type === "INSTANCE" && o.w <= ICON_MAX && o.h <= ICON_MAX && !hasText(n)) {
    iconCandidates.push({ node: n, id: n.id, name: n.name, w: o.w, h: o.h, depth });
  }

  if (depth < MAX_DEPTH && "children" in n) {
    for (const c of n.children) walk(c, depth + 1);
  }
}
walk(root, 0);

// Имена главных компонентов для иконок — только асинхронно (dynamic-page).
const icons = [];
for (const c of iconCandidates) {
  let componentId = null;
  let componentName = c.name;
  try {
    const main = await c.node.getMainComponentAsync();
    if (main) {
      componentId = main.parent && main.parent.type === "COMPONENT_SET" ? main.parent.id : main.id;
      componentName = main.parent && main.parent.type === "COMPONENT_SET" ? main.parent.name : main.name;
    }
  } catch (e) {
    /* инстанс без главного компонента — оставим имя узла */
  }
  icons.push({
    id: c.id,
    name: c.name,
    componentId,
    componentName,
    // Варианты одного набора различаются геометрией: у arrow-quiet восемь
    // сочетаний color × direction. Без них все стрелки получают один SVG.
    props: c.node.componentProperties
      ? Object.fromEntries(Object.entries(c.node.componentProperties).map(([k, v]) => [k, v.value]))
      : null,
    w: c.w,
    h: c.h,
    depth: c.depth,
  });
}

// Уникальные иконки по компоненту И варианту: один SVG на сочетание свойств.
const uniqueIcons = [];
const seenIcon = new Set();
for (const i of icons) {
  const variant = i.props ? JSON.stringify(i.props) : "";
  const key = `${i.componentId ?? i.id}|${variant}`;
  if (seenIcon.has(key)) continue;
  seenIcon.add(key);
  uniqueIcons.push(i);
}

return {
  root: { id: root.id, name: root.name, w: Math.round(root.width), h: Math.round(root.height) },
  count: nodes.length,
  nodes,
  images,
  icons: uniqueIcons,
  iconInstances: icons.length,
};
