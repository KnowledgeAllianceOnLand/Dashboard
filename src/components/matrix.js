import * as Plot from "npm:@observablehq/plot";
import {titleElement} from "./title.js";

const FONT_FAMILY = '"Inter", system-ui, sans-serif';

// 3 chiffres significatifs (2 décimales minimum) : une petite valeur ne s'affiche pas comme « 0 ».
function formatNumber(v) {
  if (v === 0) return "0";
  const decimals = Math.min(8, Math.max(2, 2 - Math.floor(Math.log10(Math.abs(v)))));
  return v.toFixed(decimals);
}

const accessor = (key) => (typeof key === "function" ? key : (d) => d[key]);

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
 * Matrice (heatmap) générique.
 *
 * Les textes — catégories des deux axes, ordre de lecture, libellé de légende — sont dérivés
 * de la donnée passée : aucune liste n'est codée en dur. Les catégories suivent l'ordre
 * d'apparition dans `data` (donc l'ordre du `ORDER BY` de la requête), ou `xDomain` / `yDomain`
 * si un ordre explicite est fourni. Les combinaisons absentes de la donnée sont affichées à 0.
 *
 * @param data itérable d'objets
 * @param options {x, y, value, xDomain, yDomain, legendLabel, title, format, scheme, compactWidth, emptyMessage}
 *   `title` : titre affiché au-dessus (même format que le barplot)
 */
export function matrix(data, {
  x = "x",
  y = "y",
  value = "value",
  xDomain,
  yDomain,
  legendLabel = typeof value === "string" ? value : null,
  title = null,
  format = formatNumber,
  scheme = "Reds",
  compactWidth = 620,
  emptyMessage = "No data available",
} = {}) {
  const getX = accessor(x);
  const getY = accessor(y);
  const getValue = accessor(value);

  const points = Array.from(data, (d) => ({ x: getX(d), y: getY(d), value: Number(getValue(d)) || 0 }));

  const order = (present, explicit) => {
    const unique = [...new Set(present)];
    return explicit ? explicit.filter((v) => unique.includes(v)) : unique;
  };
  const xValues = order(points.map((d) => d.x), xDomain);
  const yValues = order(points.map((d) => d.y), yDomain);

  // `emptyMessage` peut être un texte ou un élément (lien, encart…) fourni par l'appelant.
  if (!xValues.length || !yValues.length) {
    const empty = document.createElement("div");
    empty.style.cssText = "padding:1.5rem;text-align:center;color:var(--theme-foreground-muted)";
    if (emptyMessage instanceof Node) empty.append(emptyMessage);
    else empty.textContent = emptyMessage;
    if (!title) return empty;
    const container = document.createElement("div");
    container.append(titleElement(title), empty);
    return container;
  }

  // Grille complète : les combinaisons sans donnée apparaissent à 0.
  const cells = xValues.flatMap((xv) =>
    yValues.map((yv) => points.find((d) => d.x === xv && d.y === yv) ?? { x: xv, y: yv, value: 0 }),
  );
  const max = Math.max(0, ...cells.map((d) => d.value));

  // Mesure des libellés pour ne couper que là où il faut.
  const context = document.createElement("canvas").getContext("2d");
  const measure = (text, fontSize) => {
    context.font = `400 ${fontSize}px ${FONT_FAMILY}`;
    return context.measureText(text).width;
  };
  const wrap = (label, fontSize, maxWidth) => {
    const lines = [];
    let line = "";
    for (const word of String(label).split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || measure(candidate, fontSize) <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.join("\n");
  };

  const chart = resized((availableWidth) => {
    const compact = availableWidth < compactWidth;
    const xFontSize = compact ? 10 : 12;
    const yFontSize = compact ? 10 : 12;
    const marginRight = compact ? 12 : 24;
    const marginTop = 10;
    const marginBottom = compact ? 78 : 92;
    const cols = xValues.length;
    const lines = yValues.length;

    // La marge de gauche suit la longueur réelle des libellés, sans dépasser ~30 % de la largeur.
    const labelWidth = Math.max(...yValues.map((v) => measure(String(v), yFontSize)));
    const marginLeft = Math.round(Math.min(labelWidth + 18, availableWidth * (compact ? 0.3 : 0.32)));
    const innerWidth = Math.max(96, availableWidth - marginLeft - marginRight);

    // Cellules carrées : la taille découle de la largeur utile, la hauteur suit.
    const cellSize = Math.max(56, Math.min(compact ? 120 : 220, Math.floor(innerWidth / cols)));
    // L'espace restant est réparti de part et d'autre pour rester centré sans étirer les cellules.
    const pad = Math.max(0, availableWidth - marginLeft - marginRight - cols * cellSize) / 2;
    const plotHeight = marginTop + lines * cellSize + marginBottom;

    // Le chiffre rétrécit si son libellé est long (très petites surfaces, forte précision).
    const valueFontSize = (d, base) => {
      const fit = (cellSize - 12) / (format(d.value).length * 0.6);
      return Math.max(9, Math.min(base, fit));
    };

    const plot = Plot.plot({
      width: availableWidth,
      height: plotHeight,
      marginLeft: marginLeft + pad,
      marginRight: marginRight + pad,
      marginTop,
      marginBottom,
      style: { fontFamily: FONT_FAMILY },
      grid: true,
      x: {
        domain: xValues,
        axis: "bottom",
        label: null,
        tickRotate: compact ? 0 : -20,
        fontSize: xFontSize,
        tickFormat: (d) => wrap(d, xFontSize, cellSize - 8),
      },
      y: {
        domain: yValues,
        axis: "left",
        label: null,
        tickSize: 0,
        fontSize: yFontSize,
        tickFormat: (d) => wrap(d, yFontSize, marginLeft - 16),
      },
      color: { type: "linear", domain: [0, max || 1], scheme },
      marks: [
        Plot.rect(cells, { x: "x", y: "y", fill: "value", inset: 1.5 }),
        Plot.text(cells, {
          x: "x",
          y: "y",
          text: (d) => format(d.value),
          fill: (d) => (max > 0 && d.value / max > 0.45 ? "#fff" : "#222"),
          fontSize: (d) => valueFontSize(d, compact ? 13 : 14),
          fontWeight: 600,
        }),
        Plot.frame({ stroke: "#d0d5dd" }),
      ],
    });

    if (!legendLabel || max === 0) return plot;

    const legend = Plot.legend({
      color: { type: "linear", domain: [0, max], scheme, label: legendLabel },
      width: availableWidth,
      marginLeft: marginLeft + pad,
      marginRight: marginRight + pad,
    });
    legend.style.margin = "0 0 8px 0";

    const wrapper = document.createElement("div");
    wrapper.append(legend, plot);
    return wrapper;
  });

  if (!title) return chart;

  const container = document.createElement("div");
  container.append(titleElement(title), chart);
  return container;
}
