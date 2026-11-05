---
theme: dashboard
title: KAL Dashboard
toc: false
sql:
    energy_transition: https://media.githubusercontent.com/media/KnowledgeAllianceOnLand/KAL-data/refs/heads/main/parquets/energy_transition.parquet?download=true
---

<!-- iplc: https://media.githubusercontent.com/media/KnowledgeAllianceOnLand/KAL-data/refs/heads/main/parquets/iplc.parquet?download=true -->

# Countries

```js
const countries = await sql`
  SELECT country_area, country_code
  FROM energy_transition
  GROUP BY country_area, country_code
  ORDER BY country_area
`;
```

```js
const selectedCountry = view(Inputs.select(countries, {
  label: "Select a country",
  format: (country) => country.country_area
}));
```

```js
{
  const result = html`<div>↻ Loading data…</div>`;
  display(result);

  // Create dummy SQL data + polygons to centroids
  await sql`
    CREATE OR REPLACE TABLE energy_transition_iplc AS
    SELECT * REPLACE (
      ST_Centroid(geom) AS geom
    ),
    (random() > 0.5) AS iplc_overlap
    FROM energy_transition;
  `;

  // Select country + geometry as geoJSON
  const countryDataIPLC = await sql`
    SELECT 
      * EXCLUDE (geom),
      ST_AsGeoJSON(geom) AS geom_json
    FROM energy_transition_iplc
    WHERE country_code = ${selectedCountry.country_code}
  `;

  // Plot table
  result.replaceChildren(
    Inputs.table(countryDataIPLC, {
      title: "Energy Transition Projects",
      columns: ["ID", "dataset", "country_code", "iplc_overlap"],
      select: false,
    })
  );

  // Prep data for map
  const countryDataGeoJSON = {
    type: "FeatureCollection",
    features: Array.from(countryDataIPLC).map(({ geom_json, ...properties }) => ({
      type: "Feature",
      geometry: JSON.parse(geom_json),
      properties
    }))
  };

  display(
    Plot.plot({
      projection: {
        type: "mercator",
        domain: countryDataGeoJSON,
      },
      height: 400,
      marks: [
        Plot.geo(countryDataGeoJSON, {
          stroke: (d) => d.properties.iplc_overlap ? "crimson" : "steelblue",
          fill: (d) => d.properties.iplc_overlap ? "crimson" : "steelblue",
          r: 3.5,
        })
      ]
    })
  );

  // Prep data for barplot
  const statsOverlapIPLC = await sql`
    SELECT dataset, COUNT(*) as count
    FROM energy_transition_iplc
    WHERE country_code = ${selectedCountry.country_code}
    GROUP BY dataset
  `;

  Inputs.table(statsOverlapIPLC, {
    select: false,
  });

  display(
    Plot.plot({
      marks: [
        Plot.ruleX([0]),
        Plot.barX(countryDataGeoJSON, {
          x: "count", y: "dataset"
        })
      ]
    })
  )

}
```