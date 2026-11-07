/**
 * Сверяет цвета в спеке со значениями переменных в файле.
 *
 * Зачем: заливка и штрих могут быть привязаны к переменной, и тогда действует
 * её значение, а не цвет краски. Один раз это уже стоило 164 непрозрачных узлов:
 * карточка отзыва должна была просвечивать (0.35), а рисовалась белой.
 *
 * На вход — список узлов, у которых в спеке есть привязка. Возвращает только
 * расхождения: где ожидаемый цвет не совпал с тем, что даёт переменная.
 */
const items = __PAYLOAD__;
const out = [];
// Переменная одна и та же у десятков узлов: без кэша каждый узел делает
// отдельный запрос к плагину и пачка не укладывается в бюджет вызова.
const variableCache = new Map();

for (const item of items) {
  const node = await figma.getNodeByIdAsync(item.id);
  if (!node) {
    out.push({ id: item.id, kind: item.kind, index: item.index, error: "узел не найден" });
    continue;
  }
  const bound = (node.boundVariables && node.boundVariables[item.kind]) || [];
  const alias = bound[item.index];
  if (!alias) continue;

  try {
    let variable = variableCache.get(alias.id);
    if (variable === undefined) {
      variable = await figma.variables.getVariableByIdAsync(alias.id);
      variableCache.set(alias.id, variable);
    }
    const modes = variable && variable.valuesByMode;
    const value = modes && modes[Object.keys(modes)[0]];
    if (!value || typeof value !== "object" || !("r" in value)) continue;

    const h = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
    const actual = { hex: `#${h(value.r)}${h(value.g)}${h(value.b)}`, a: +(value.a ?? 1).toFixed(3) };
    const same = actual.hex.toLowerCase() === String(item.expected.hex).toLowerCase()
      && Math.abs(actual.a - item.expected.a) < 0.01;
    if (!same) {
      out.push({
        id: item.id,
        kind: item.kind,
        index: item.index,
        variable: variable.name,
        expected: item.expected,
        actual,
      });
    }
  } catch (error) {
    out.push({ id: item.id, kind: item.kind, index: item.index, error: String(error && error.message).slice(0, 80) });
  }
}

return { checked: items.length, mismatches: out };
