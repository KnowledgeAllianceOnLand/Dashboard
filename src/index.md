---
theme: air
title: Renewable Energy
toc: false
sql:
    energy_transition: data/energy_transition.parquet
    energy_transition_geo: data/energy_transition_geo.parquet
---

# Renewable Energy

<style>
  #boot-loading { display: flex; align-items: center; justify-content: center; gap: 0.6rem; height: 160px; color: var(--theme-foreground-muted); font-size: 0.9rem; }
  main:has(select) #boot-loading { display: none; }
  /* Inputs pose `table-layout: fixed` (en style inline) et `white-space: nowrap` : les en-têtes
     longs sont tronqués. On repasse en `auto` pour que les colonnes s'adaptent (et débordent
     horizontalement sur petit écran, le conteneur défile), et on autorise les retours à la ligne. */
  main .inputs-3a86ea-table table { table-layout: auto !important; }
  main .inputs-3a86ea-table thead th { white-space: pre-line; }
  /* Cellule volontairement vide (graphique non affiché) : le bloc entier disparaît. */
  main .observablehq--block:has(.kal-empty) { display: none; }
</style>
<div id="boot-loading" role="status" aria-live="polite">
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.8s" repeatCount="indefinite" />
    </circle>
  </svg>
  <span>Loading dashboard…</span>
</div>

```js
const countries = await sql`
  SELECT DISTINCT country_name, country_code
  FROM energy_transition
  WHERE country_code IS NOT NULL
  AND list_has_any(dataset_l, ['Wind', 'Solar', 'Hydropower', 'Geothermal'])
  ORDER BY country_name
`;
```

```js
const selectedCountry = view(Inputs.select(countries, {
  label: "Select a country",
  format: (country) => country.country_name
}));
```

```js
// Empiètement IPLC pour le pays courant, exposé sous forme d'objet-porteur : la valeur est
// disponible immédiatement (non attendue par le runtime), ce qui permet aux cellules
// dépendantes d'afficher un spinner au lieu de garder le résultat du pays précédent.
const encroachment = {
  promise: sql`
    SELECT bool_or(iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0) AS encroaching
    FROM energy_transition
    WHERE country_code = ${selectedCountry.country_code}
    AND list_has_any(dataset_l, ['Wind', 'Solar', 'Hydropower', 'Geothermal'])
  `.then((rows) => Boolean(Array.from(rows)[0]?.encroaching)),
};
```

```js
// Message affiché à la place des graphiques quand aucun projet n'empiète sur une aire IPLC.
// Fonction : chaque cellule doit recevoir son propre nœud DOM (un nœud ne peut être qu'à un endroit).
const noEncroachment = () =>
  html`<div style="padding:1.5rem;text-align:center;color:var(--theme-foreground-muted)">No IPLC encroachment in this country.</div>`;

// Cellule volontairement vide : son bloc est masqué en CSS (voir le style en haut de page),
// ce qui permet de faire disparaître complètement un graphique sans laisser d'espace.
const blank = () => html`<div class="kal-empty"></div>`;
```

```js
// Imports centralisés : un import dans plusieurs cellules définirait plusieurs fois la même
// variable de page (« withLoading is defined more than once »).
import {map, toFeatureCollection} from "./components/map.js";
import {matrix} from "./components/matrix.js";
import {barplot} from "./components/barplot.js";
import {withLoading} from "./components/loading.js";
```

```js
// La requête démarre à l'appel de `sql` ; withLoading affiche le spinner puis la carte.
// La promesse est transmise dans un objet (non attendu par le runtime) pour que la matrice
// sache quand la carte a terminé sans être bloquée en attendant.
const mapQuery = {
  promise: sql`
    WITH country AS (
      SELECT
        t.ID,
        bool_or(lower(iplc_indicative) = 'true') AS indicative
      FROM energy_transition, UNNEST(id_l) AS t(ID)
      WHERE country_code = ${selectedCountry.country_code}
      GROUP BY t.ID
    )
    SELECT
      g.ID,
      CASE
        WHEN NOT g.intersects_iplc          THEN 'none'
        WHEN coalesce(c.indicative, false)  THEN 'indicative'
        ELSE 'precise'
      END AS category,
      ST_AsGeoJSON(g.geom) AS geom_json
    FROM energy_transition_geo g
    JOIN country c USING (ID)
    WHERE SUBSTR(g.ID, 1, 2) != 'SP' -- Exclude mines
  `.then(toFeatureCollection),
};

display(withLoading(
  mapQuery.promise,
  (geojson) =>
    map(geojson, {
      category: "category",
      label: {
        precise: "Precisely mapped IPLC areas",
        indicative: "Indicative IPLC areas",
        none: "No intersection with IPLC areas",
      },
      colorOf: {
        precise: {stroke: "#071d44", fill: "#1C3A6C"},
        indicative: {stroke: "#4d9dbb", fill: "#85CFEB"},
        none: {stroke: "#777777", fill: "#BBBBBB"},
      },
      // Ordre de dessin et de légende, du dessous vers le dessus.
      order: ["none", "indicative", "precise"],
      // Taille, opacité et épaisseur du contour des points.
      pointRadius: 2,
      pointOpacity: 1,
      weight: 1.5,
      //popup: true,
      legendTitle: "Renewable Energy Projects",
      ariaLabel: "Interactive map of renewable energy projects",
    }),
  {loading: "Loading map…", height: 420},
));
```

```js
// Message unique, juste sous la carte, quand aucun projet n'empiète sur une aire IPLC.
// Pendant la vérification (changement de pays), un spinner remplace l'ancien contenu.
display(withLoading(
  encroachment.promise,
  (hasEncroachment) => (hasEncroachment ? blank() : noEncroachment()),
  {loading: "Checking IPLC encroachment…", height: 40},
));
```

## By Energy Type

```js
// En-têtes de tableau sur plusieurs lignes (`\n` = retour à la ligne, via `white-space: pre-line`).
// Libellés en texte : un élément DOM serait enveloppé dans le `<span>` du tri, large de 0.5em.
// Les colonnes absentes de l'objet gardent leur nom ; le libellé complet reste en infobulle (`title`).
const tableHeaders = {
  "Energy type": "Energy\ntype",
  "Total areas (ha)": "Total areas\n(ha)",
  "Areas not encroaching (ha)": "Areas not\nencroaching (ha)",
  "Total IPLC areas (ha)": "Total IPLC\nareas (ha)",
  "Precisely mapped areas (ha)": "Precisely mapped\nareas (ha)",
  "Indicative areas (ha)": "Indicative\nareas (ha)",
};
```

```js
// display SQL result as data table
// Les requêtes sont chaînées (chacune attend la précédente) pour afficher les résultats
// au fur et à mesure au lieu de tout faire arriver à la fin. `energyTable` sert de relais.
const energyTable = {
  promise: mapQuery.promise.catch(() => null).then(() => sql`
    SELECT 
    dataset as "Energy type",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0), 0) AS "Encroaching IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND lower(iplc_indicative) = 'false'), 0) AS "Encroaching precisely mapped IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND lower(iplc_indicative) = 'true'), 0) AS "Encroaching indicative IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NULL), 0) AS "Not encroaching IPLC areas (ha)",
    COALESCE(SUM(area_ha), 0) AS "Total (ha)",
    FROM energy_transition, UNNEST(dataset_l) AS t(dataset)
    WHERE dataset IN ('Wind', 'Solar', 'Hydropower', 'Geothermal')
    AND country_code = ${selectedCountry.country_code}
    GROUP BY dataset
    ORDER BY 2 DESC;
  `),
};

display(withLoading(
  energyTable.promise,
  (data) => Inputs.table(data, {select: false, header: tableHeaders}),
  {loading: "Loading energy type table…", height: 40},
));
```

```js
// Surfaces par type d'énergie (Mha), même périmètre que la table ci-dessus.
// La requête ne part qu'après la table et si le pays a un empiètement IPLC.
const fetchEnergyTypes = () => sql`
  SELECT
    t.dataset,
    COALESCE(SUM(area_ha), 0) / 1e6 AS surface_mha
  FROM energy_transition, UNNEST(dataset_l) AS t(dataset)
  WHERE t.dataset IN ('Wind', 'Solar', 'Hydropower', 'Geothermal')
    AND iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0
    AND country_code = ${selectedCountry.country_code}
  GROUP BY t.dataset
`;

// `energyChart` sert de relais pour la suite (table « By Implementation Status »).
const energyChart = {
  promise: encroachment.promise.then((hasEncroachment) =>
    hasEncroachment ? energyTable.promise.catch(() => null).then(fetchEnergyTypes) : null,
  ),
};

display(withLoading(
  energyChart.promise,
  (data) => (data ? barplot(data, {
    category: "dataset",
    value: "surface_mha",
    order: ["Wind", "Solar", "Hydropower", "Geothermal"],
    sort: "-value",
    colors: {
      Wind: "#85CFEB",
      Solar: "#E5A83B",
      Hydropower: "#1C3A6C",
      Geothermal: "#B4432F",
    },
    title: "Renewable energy projects intersecting IPLC areas by energy type",
    legendTitle: "Energy type",
    unit: "Surface (Mha)",
  }) : blank()),
  {loading: "Loading energy type chart…", height: 170},
));
```

## By Implementation Status

```js
// display SQL result as data table
// Relais : cette requête ne démarre qu'une fois le graphique précédent terminé.
const statusTable = {
  promise: energyChart.promise.catch(() => null).then(() => sql`
    SELECT 
    implementation_status as "Implementation status",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0), 0) AS "Encroaching IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND lower(iplc_indicative) = 'false'), 0) AS "Encroaching precisely mapped IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND lower(iplc_indicative) = 'true'), 0) AS "Encroaching indicative IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NULL), 0) AS "Not encroaching IPLC areas (ha)",
    COALESCE(SUM(area_ha), 0) AS "Total (ha)",
    FROM energy_transition, UNNEST(implementation_status_l) AS t(implementation_status)
    WHERE list_has_any(dataset_l, ['Wind', 'Solar', 'Hydropower', 'Geothermal'])
    AND country_code = ${selectedCountry.country_code}
    GROUP BY implementation_status
    ORDER BY 2 DESC;
  `),
};

display(withLoading(
  statusTable.promise,
  (data) => Inputs.table(data, {select: false, header: tableHeaders}),
  {loading: "Loading implementation status table…", height: 40},
));
```

```js
// Surfaces par statut d'implémentation (Mha). Toutes les catégories de référence sont
// affichées, même à 0 ; les statuts supplémentaires présents dans la donnée suivent.
// La requête n'est construite (et lancée) que si le pays a un empiètement IPLC.
const fetchStatuses = () => sql`
  SELECT
    t.status,
    COALESCE(SUM(area_ha), 0) / 1e6 AS surface_mha
  FROM energy_transition, UNNEST(implementation_status_l) AS t(status)
  WHERE list_has_any(dataset_l, ['Wind', 'Solar', 'Hydropower', 'Geothermal'])
    AND iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0
    AND country_code = ${selectedCountry.country_code}
    AND t.status IN ('Operation', 'Development & Construction', 'Evaluation & Planning', 'Inactive (never built)', 'Inactive (with physical footprint)')
  GROUP BY t.status
`;

// Le spinner s'affiche dès le changement de pays (dépendance à `encroachment`, disponible
// immédiatement) ; la requête ne part qu'après les tableaux et si l'empiètement existe.
// `statusChart` sert de relais pour la matrice.
const statusChart = {
  promise: encroachment.promise.then((hasEncroachment) =>
    hasEncroachment ? statusTable.promise.catch(() => null).then(fetchStatuses) : null,
  ),
};

display(withLoading(
  statusChart.promise,
  (data) => (data ? barplot(data, {
    category: "status",
    value: "surface_mha",
    order: [
      "Development & Construction",
      "Evaluation & Planning",
      "Inactive (never built)",
      "Inactive (with physical footprint)",
      "Operation",
    ],
    // Tri des barres, de haut en bas : "-value" (décroissant), "value", "label", "-label"
    // ou comparateur (a, b) => number. `order` fixe alors seulement la liste des catégories.
    sort: "-value",
    labels: {
      "Development & Construction": "Development & construction",
      "Evaluation & Planning": "Evaluation & planning",
      "Operation": "Operational",
    },
    colors: {
      "Development & Construction": "#c8c8c8",
      "Evaluation & Planning": "#d9c8b2",
      "Inactive (never built)": "#a8ddf5",
      "Inactive (with physical footprint)": "#0b2a4a",
      "Operation": "#3b1a10",
    },
    title: "Renewable energy projects intersecting IPLC areas by implementation status",
    legendTitle: "Implementation status",
    unit: "Surface (Mha)",
  }) : blank()),
  {loading: "Loading implementation status chart…", height: 220},
));
```

```js
// Libellés, ordre des axes et légende sont dérivés des données : aucune liste codée en dur.
// La requête ne démarre qu'une fois le barplot terminé (exécution séquentielle), et seulement
// s'il y avait un empiètement (sinon le relais vaut null).
const fetchMatrix = () => sql`
SELECT 
    -- Axe X : phase d'implémentation (le libellé affiché vient de la donnée)
    CASE status
        WHEN 'Operation'                   THEN 'Operational - 2026'
        WHEN 'Development & Construction'  THEN 'Development & construction - 2028'
        WHEN 'Evaluation & Planning'       THEN 'Evaluation & planning - 2034'
    END AS implementation_phase,
    -- Axe Y : type d'empiètement
    CASE 
      WHEN lower(iplc_indicative) = 'true'  THEN 'Indicative IPLC areas'
      WHEN lower(iplc_indicative) = 'false' THEN 'Precisely mapped IPLC areas'
    END AS encroachment_type,
    COALESCE(SUM(area_ha), 0) / 1e6 AS surface_mha
FROM energy_transition,
     UNNEST(implementation_status_l)  AS s(status)
WHERE list_has_any(dataset_l, ['Wind', 'Solar', 'Hydropower', 'Geothermal'])                              -- Renewable Energy uniquement
  AND iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0        -- intersection IPLC
  AND status IN ('Operation', 'Development & Construction', 'Evaluation & Planning')
  AND country_code = ${selectedCountry.country_code}
GROUP BY 1, 2
-- L'ordre des lignes définit l'ordre des catégories affichées par la matrice.
ORDER BY 
  CASE implementation_phase
    WHEN 'Operational - 2026'                  THEN 1
    WHEN 'Development & construction - 2028'   THEN 2
    WHEN 'Evaluation & planning - 2034'   THEN 3
  END
`;

display(withLoading(
  statusChart.promise.catch(() => null).then((hasData) => (hasData ? fetchMatrix() : null)),
  (data) =>
    data
      ? matrix(data, {
          x: "implementation_phase",
          y: "encroachment_type",
          value: "surface_mha",
          title: "Development phases of renewable energy projects intersecting IPLC areas",
          legendLabel: "Surface (Mha)",
          emptyMessage: "No IPLC encroachment in this country.",
        })
      : blank(),
  {loading: "Loading matrix…", height: 300},
));
```
