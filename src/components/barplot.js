import * as Plot from "npm:@observablehq/plot";
import {titleElement} from "./title.js";

const FONT_FAMILY = '"Inter", system-ui, sans-serif';

// Palette utilisée quand aucune couleur n'est fournie pour une catégorie.
// Les couleurs déjà prises par l'appelant sont écartées pour éviter les doublons.
const FALLBACK_COLORS = ["#9aa5b1", "#7b4f9d", "#2e7d32", "#b06a2c", "#546e7a", "#8d6e63"];

const accessor = (key) => (typeof key === "function" ? key : (d) => d?.[key]);

// Traduit l'option `sort` en comparateur, ou null si aucun tri n'est demandé.
function sortComparator(sort) {
  if (!sort) return null;
  if (typeof sort === "function") return sort;
  switch (sort) {
    case "value":
      return (a, b) => a.value - b.value;
    case "-value":
      return (a, b) => b.value - a.value;
    case "label":
      return (a, b) => a.label.localeCompare(b.label);
    case "-label":
      return (a, b) => b.label.localeCompare(a.label);
    default:
      throw new Error(`barplot: unsupported sort "${sort}" (use "-value", "value", "label", "-label" or a comparator)`);
  }
}

// Rendu re-calculé à chaque changement de largeur du conteneur.
function resized(render) {
  const container = document.createElement("div");
  container.style.position = "relative";
  let width;
  const observer = new ResizeObserver(([entry]) => {
    const next = Math.floor(entry.contentRect.width);
    if (next === width) return;
    width = next;
    if (next <= 0) return;
    container.replaceChildren(render(next));
  });
  observer.observe(container);
  return container;
}

/**
 * Barplot horizontal (une barre par catégorie), avec valeur en bout de barre et légende.
 *
 * Les catégories de `order` sont toutes représentées, y compris celles absentes de la
 * donnée (barre à 0), et dans cet ordre de haut en bas. Les catégories présentes mais
 * absentes de `order` sont ajoutées à la suite.
 *
 * @param data itérable d'objets
 * @param options {category, value, order, sort, colors, labels, title, legendTitle, unit, digits,
 *                 rowHeight, compactWidth}
 *   `colors` : objet {catégorie: couleur} ou fonction ; `labels` : objet {catégorie: libellé}
 *   `sort` : tri des barres (appliqué après `order`), de haut en bas :
 *     "-value" (décroissant, plus grande en haut), "value" (croissant),
 *     "label" / "-label" (alphabétique), ou comparateur (a, b) => number
 *     où a et b sont {category, label, value, color}.
 */
export function barplot(data, {
  category = "category",
  value = "value",
  order = null,
  sort = null,
  colors = null,
  labels = null,
  title = null,
  legendTitle = null,
  unit = null,
  digits = 3,
  rowHeight = 26,
  compactWidth = 620,
  hideZero = true,
} = {}) {
  const getCategory = accessor(category);
  const getValue = accessor(value);

  const rows = Array.from(data, (d) => ({category: getCategory(d), value: Number(getValue(d)) || 0}));
  const present = [...new Set(rows.map((d) => d.category))];
  // `order` fait foi : les catégories absentes de la donnée restent affichées (barre à 0),
  // comme dans la maquette ; celles présentes mais non listées sont ajoutées à la suite.
  const categories = order ? [...order, ...present.filter((c) => !order.includes(c))] : present;

  const valueOf = (cat) => rows.filter((d) => d.category === cat).reduce((sum, d) => sum + d.value, 0);
  const labelOf = (cat) => labels?.[cat] ?? String(cat);

  const explicitColors = colors && typeof colors === "object" ? Object.values(colors) : [];
  const fallbackColors = FALLBACK_COLORS.filter((c) => !explicitColors.includes(c));
  let fallbackIndex = 0;
  const colorOf = (cat) => {
    if (typeof colors === "function") return colors(cat);
    if (colors?.[cat]) return colors[cat];
    const color = fallbackColors[fallbackIndex % fallbackColors.length];
    fallbackIndex++;
    return color;
  };

  const points = categories.map((cat) => ({
    category: cat,
    label: labelOf(cat),
    value: valueOf(cat),
    color: colorOf(cat),
  }));

  // Tri optionnel des barres (de haut en bas) — `order` sert alors seulement de liste de catégories.
  const compare = sortComparator(sort);
  if (compare) points.sort(compare);

  // Les catégories à 0 exact sont masquées (barre et légende) : `order` ne sert qu'à garantir
  // leur présence quand elles ont des valeurs. `hideZero: false` les réaffiche.
  const visible = hideZero ? points.filter((d) => d.value !== 0) : points;

  const max = Math.max(0, ...visible.map((d) => d.value)) || 1;
  // `digits` est un minimum : on ajoute des décimales pour les très petites valeurs.
  const format = (v) =>
    v === 0 ? "0" : v.toFixed(Math.min(8, Math.max(digits, 2 - Math.floor(Math.log10(Math.abs(v))))));

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.textContent = "No data available";
    empty.style.cssText = "padding:1.5rem;text-align:center;color:var(--theme-foreground-muted)";
    return empty;
  }

  return resized((availableWidth) => {
    const compact = availableWidth < compactWidth;
    const legendWidth = compact ? 0 : Math.min(230, Math.round(availableWidth * 0.3));
    const plotWidth = Math.max(180, availableWidth - (compact ? 0 : legendWidth + 20));

    const plot = Plot.plot({
      width: plotWidth,
      height: visible.length * rowHeight + 26,
      marginTop: 4,
      marginBottom: 22,
      marginLeft: 25,
      marginRight: 64,
      style: {fontFamily: FONT_FAMILY, fontSize: "12px"},
      x: {domain: [0, max], grid: false, label: null, ticks: 4},
      y: {domain: visible.map((d) => d.label), axis: null},
      marks: [
        Plot.barX(visible, {y: "label", x: "value", fill: "color", inset: 0.35}),
        Plot.text(visible, {
          y: "label",
          x: "value",
          text: (d) => format(d.value),
          dx: 6,
          textAnchor: "start",
          fontWeight: 600,
          fill: "currentColor",
        }),
      ],
    });

    const wrapper = document.createElement("div");

    if (title) {
      wrapper.append(titleElement(title));
    }

    const row = document.createElement("div");
    row.style.cssText = `display:flex;gap:20px;align-items:flex-start;flex-direction:${compact ? "column" : "row"}`;
    row.append(plot);

    if (legendTitle && visible.length) {
      const legend = document.createElement("div");
      legend.style.cssText = "font-size:.85rem;line-height:1.7;padding-top:2px";

      const legendHeading = document.createElement("div");
      legendHeading.textContent = legendTitle;
      legendHeading.style.cssText = "font-style:italic;color:var(--theme-foreground-muted);margin-bottom:4px";
      legend.append(legendHeading);

      for (const point of visible) {
        const item = document.createElement("div");
        item.style.cssText = "display:flex;align-items:center;gap:6px;white-space:nowrap";
        const dot = document.createElement("span");
        dot.style.cssText = `width:10px;height:10px;border-radius:50%;flex:0 0 auto;background:${point.color}`;
        item.append(dot, document.createTextNode(point.label));
        legend.append(item);
      }
      row.append(legend);
    }

    wrapper.append(row);

    if (unit) {
      const note = document.createElement("div");
      note.textContent = unit;
      note.style.cssText = "font-size:.75rem;color:var(--theme-foreground-muted);margin-top:2px";
      wrapper.append(note);
    }

    return wrapper;
  });
}
