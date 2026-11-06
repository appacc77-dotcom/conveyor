/**
 * Страницы файла и их верхнеуровневые фреймы — для `tools/discover.mjs`.
 * Отдаёт только то, из чего собирается project.json.
 */
const pages = [];

for (const page of figma.root.children) {
  if (page.type !== "PAGE") continue;
  const frames = [];
  for (const child of page.children) {
    if (!["FRAME", "COMPONENT", "SECTION"].includes(child.type)) continue;
    frames.push({
      id: child.id,
      name: child.name,
      type: child.type,
      w: Math.round(child.width),
      h: Math.round(child.height),
      children: "children" in child ? child.children.length : 0,
      // Пустые фреймы и разделители в работу не идут.
      empty: !("children" in child) || child.children.length === 0,
    });
  }
  pages.push({ id: page.id, name: page.name, frames });
}

return { fileKey: figma.fileKey ?? null, name: figma.root.name, pages };
