---
theme: dashboard
title: KAL Dashboard
toc: false
sql:
    energy_transition: data/energy_transition.parquet
    energy_transition_geo: data/energy_transition_geo.parquet
---

# KAL Dashboard

<style>
  #boot-loading { display: flex; align-items: center; justify-content: center; gap: 0.6rem; height: 160px; color: var(--theme-foreground-muted); font-size: 0.9rem; }
  main:has(select) #boot-loading { display: none; }
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
  SELECT country_name, country_code
  FROM energy_transition
  WHERE country_code IS NOT NULL
  GROUP BY country_name, country_code
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
import {map, toFeatureCollection} from "./components/map.js";
import {withLoading} from "./components/loading.js";

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
        precise: {stroke: "#176b87", fill: "#63b3c4"},
        indicative: {stroke: "#b42318", fill: "#ef6a5b"},
        none: {stroke: "#6b7280", fill: "#d1d5db"},
      },
      legendTitle: "Energy Transition Projects",
      ariaLabel: "Interactive map of energy transition projects",
    }),
  {loading: "Loading map…", height: 420},
));
```

```js
import {matrix} from "./components/matrix.js";
import {withLoading} from "./components/loading.js";

// Libellés, ordre des axes et légende sont dérivés des données : aucune liste codée en dur.
// L'emplacement se met en attente tout de suite, mais la requête n'est lancée qu'après la carte :
// DuckDB-wasm est mono-thread, les lancer ensemble doublerait l'attente.
display(withLoading(
  mapQuery.promise.catch(() => null).then(() => sql`
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
     UNNEST(dataset_l)                AS t(dataset),
     UNNEST(implementation_status_l)  AS s(status)
WHERE dataset != 'Mines'                                  -- Renewable Energy uniquement
  AND iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0        -- intersection IPLC
  AND status IN ('Operation', 'Development & Construction', 'Evaluation & Planning')
  AND country_code = ${selectedCountry.country_code}
GROUP BY 1, 2
-- L'ordre des lignes définit l'ordre des catégories affichées par la matrice.
ORDER BY
    min(CASE status
        WHEN 'Operation'                  THEN 1
        WHEN 'Development & Construction' THEN 2
        ELSE 3
    END),
    min(CASE WHEN lower(iplc_indicative) = 'true' THEN 2 ELSE 1 END)
  `),
  (data) =>
    matrix(data, {
      x: "implementation_phase",
      y: "encroachment_type",
      value: "surface_mha",
      legendLabel: "Surface (Mha)",
      emptyMessage: "No IPLC encroachment in this country.",
    }),
  {loading: "Loading matrix…", height: 300},
));
```
