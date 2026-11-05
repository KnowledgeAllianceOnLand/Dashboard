import L from "npm:leaflet";

// Palette utilisée quand aucune couleur n'est fournie : attribuée dans l'ordre d'apparition.
const DEFAULT_COLORS = [
  {stroke: "#176b87", fill: "#63b3c4"},
  {stroke: "#b42318", fill: "#ef6a5b"},
  {stroke: "#4a7c24", fill: "#8cbf52"},
  {stroke: "#7a4fb5", fill: "#a98ee0"},
];

const accessor = (key) => (typeof key === "function" ? key : (d) => d?.[key]);

/**
 * Convertit des lignes (`geom_json` + autres colonnes en propriétés) en FeatureCollection.
 * Accepte un tableau de lignes ou une table Arrow (`sql`).
 */
export function toFeatureCollection(rows) {
  const list = Array.isArray(rows) ? rows : Array.from(rows);
  return {
    type: "FeatureCollection",
    features: list.map(({geom_json, ...properties}) => ({
      type: "Feature",
      geometry: typeof geom_json === "string" ? JSON.parse(geom_json) : geom_json,
      properties,
    })),
  };
}

// Exécute `callback` dès que le nœud est inséré dans le document.
function whenConnected(node, callback) {
  if (node.isConnected) return callback();
  const frame = () => (node.isConnected ? callback() : requestAnimationFrame(frame));
  requestAnimationFrame(frame);
}

function defaultPopup(properties) {
  const wrapper = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = properties.ID ?? properties.id ?? properties.name ?? "Feature";
  wrapper.append(title);
  const subtitle = properties.dataset ?? properties.type;
  if (subtitle) wrapper.append(document.createElement("br"), document.createTextNode(subtitle));
  return wrapper;
}

/**
 * Carte Leaflet générique.
 *
 * Les catégories de la légende sont dérivées de la donnée (`category`), dans l'ordre
 * d'apparition ; leurs libellés et couleurs sont fournis par l'appelant (`label`, `colorOf`).
 *
 * @param geojson FeatureCollection à afficher
 * @param options {category, label, colorOf, legendTitle, popup, height, tiles,
 *                 attribution, tileMaxZoom, fitPadding, fitMaxZoom, center, zoom,
 *                 ariaLabel, emptyMessage}
 *   `label` : fonction (valeur) → texte, ou objet {valeur: texte}
 */
export function map(geojson, {
  category = null,
  label = (value) => String(value),
  colorOf = null,
  legendTitle = null,
  popup = defaultPopup,
  height = 420,
  tiles = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  tileMaxZoom = 19,
  fitPadding = [20, 20],
  fitMaxZoom = 12,
  center = [20, 0],
  zoom = 2,
  ariaLabel = "Interactive map",
  emptyMessage = "No data available",
} = {}) {
  const features = (geojson?.features ?? []).filter(Boolean);

  const container = document.createElement("div");
  container.style.cssText = `height:${height}px;margin:1rem 0 2rem;border:1px solid var(--theme-foreground-faint);border-radius:6px;overflow:hidden`;
  container.setAttribute("aria-label", ariaLabel);

  if (!features.length) {
    container.style.cssText = "padding:1.5rem;text-align:center;color:var(--theme-foreground-muted);border:1px solid var(--theme-foreground-faint);border-radius:6px";
    container.textContent = emptyMessage;
    return container;
  }

  const rawCategory = category ? accessor(category) : null;
  // `category` peut être une clé ou un accesseur, ce qui suffit pour normaliser une valeur.
  const getCategory = rawCategory ? (feature) => rawCategory(feature.properties ?? {}, feature) : null;
  // Ordre de la légende : celui de `colorOf` si fourni, sinon l'ordre d'apparition dans la donnée.
  const categories = (() => {
    if (!getCategory) return [];
    const present = [...new Set(features.map((f) => getCategory(f)))];
    if (!colorOf || typeof colorOf !== "object") return present;
    const ordered = Object.keys(colorOf)
      .map((key) => present.find((value) => String(value) === key))
      .filter((value) => value !== undefined);
    return [...ordered, ...present.filter((value) => !ordered.includes(value))];
  })();

  const colorFor = (value) => {
    if (typeof colorOf === "function") return colorOf(value);
    if (colorOf && typeof colorOf === "object") return colorOf[value] ?? colorOf[String(value)] ?? DEFAULT_COLORS[0];
    const index = categories.indexOf(value);
    return DEFAULT_COLORS[(index < 0 ? 0 : index) % DEFAULT_COLORS.length];
  };

  // `label` accepte une fonction ou un objet {valeur: texte}.
  const labelFor = (value) => {
    if (typeof label === "function") return label(value);
    if (label && typeof label === "object") return label[value] ?? label[String(value)] ?? String(value);
    return String(value);
  };

  const style = (feature) => {
    const color = colorFor(getCategory ? getCategory(feature) : undefined);
    return {color: color.stroke, fillColor: color.fill, fillOpacity: 0.55, weight: 1.5};
  };

  // Leaflet doit être initialisé alors que le conteneur est dans le DOM et dimensionné,
  // sinon la vue et les tuiles sont calculées sur une taille nulle.
  whenConnected(container, () => {
    // preferCanvas : des milliers de marqueurs coûtent bien moins cher sur un canvas que dans le DOM SVG.
    const instance = L.map(container, {scrollWheelZoom: false, preferCanvas: true});
    L.tileLayer(tiles, {attribution, maxZoom: tileMaxZoom}).addTo(instance);

    const layer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const {color: stroke, fillColor} = style(feature);
        return L.circleMarker(latlng, {radius: 6, color: stroke, fillColor, fillOpacity: 0.8, weight: 1.5});
      },
      style,
      onEachFeature: (feature, featureLayer) => {
        const content = popup(feature.properties ?? {}, feature);
        if (content) featureLayer.bindPopup(content);
      },
    }).addTo(instance);

    if (legendTitle || categories.length) {
      const control = L.control({position: "topright"});
      control.onAdd = () => {
        const box = L.DomUtil.create("div");
        box.style.cssText = "padding:8px 10px;border:1px solid #c8c8c8;border-radius:4px;background:rgba(255,255,255,.94);color:#242424;font-size:.8rem;line-height:1.7";
        if (legendTitle) {
          const title = document.createElement("strong");
          title.style.cssText = "display:block;margin-bottom:2px";
          title.textContent = legendTitle;
          box.append(title);
        }
        for (const value of categories) {
          const color = colorFor(value);
          const row = document.createElement("div");
          const dot = document.createElement("span");
          dot.style.cssText = `display:inline-block;width:10px;height:10px;margin-right:6px;border:1px solid ${color.stroke};border-radius:50%;background:${color.fill};vertical-align:0`;
          row.append(dot, document.createTextNode(labelFor(value)));
          box.append(row);
        }
        L.DomEvent.disableClickPropagation(box);
        return box;
      };
      control.addTo(instance);
    }

    const bounds = layer.getBounds();
    if (bounds.isValid()) instance.fitBounds(bounds, {padding: fitPadding, maxZoom: fitMaxZoom});
    else instance.setView(center, zoom);

    // La carte suit la largeur du conteneur (fenêtre redimensionnée, colonne qui change).
    const observer = new ResizeObserver(() => {
      if (!container.isConnected) return observer.disconnect();
      instance.invalidateSize();
    });
    observer.observe(container);
  });

  return container;
}
