---
theme: dashboard
title: KAL Dashboard
toc: false
sql:
    energy_transition: data/energy_transition.parquet
    energy_transition_geo: data/energy_transition_geo.parquet
---

# KAL Dashboard

```js
const countries = await sql`
  SELECT country_name, country_code
  FROM energy_transition
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
// Select country + geometry as geoJSON
const countryDataIPLC = await sql`
  SELECT * EXCLUDE (geom),
    ST_AsGeoJSON(geom) AS geom_json
  FROM energy_transition_geo
  WHERE ID IN (
      SELECT unnest(id_l)
      FROM energy_transition
      WHERE country_code = ${selectedCountry.country_code}
  );
`;

// Prep data for map
const countryDataGeoJSON = {
  type: "FeatureCollection",
  features: Array.from(countryDataIPLC).map(({ geom_json, ...properties }) => ({
    type: "Feature",
    geometry: JSON.parse(geom_json),
    properties
  }))
};

const mapContainer = html`<div class="kal-map" aria-label="Interactive map of energy transition projects"></div>`;
display(mapContainer);

const map = L.map(mapContainer, {scrollWheelZoom: false});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

const isIplcIntersecting = (feature) => {
  const value = feature.properties.intersects_iplc;
  return value === true || value === 1 || String(value).trim().toLowerCase() === "true" || String(value).trim() === "1";
};

const geoLayer = L.geoJSON(countryDataGeoJSON, {
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
    radius: 6,
    color: isIplcIntersecting(feature) ? "#b42318" : "#176b87",
    fillColor: isIplcIntersecting(feature) ? "#ef6a5b" : "#63b3c4",
    fillOpacity: 0.8,
    weight: 1.5,
  }),
  style: (feature) => ({
    color: isIplcIntersecting(feature) ? "#b42318" : "#176b87",
    fillColor: isIplcIntersecting(feature) ? "#ef6a5b" : "#63b3c4",
    fillOpacity: 0.55,
    weight: 1.5,
  }),
  onEachFeature: (feature, layer) => {
    const properties = feature.properties;
    layer.bindPopup(`<strong>${properties.ID ?? "Project"}</strong><br>${properties.dataset ?? ""}`);
  },
}).addTo(map);

const legend = L.control({position: "topright"});
legend.onAdd = () => {
  const container = L.DomUtil.create("div", "kal-map-legend");
  container.innerHTML = `
    <strong>Energy Transition Projects</strong>
    <div><span class="kal-map-legend-swatch kal-map-legend-swatch-red"></span>Intersects IPLC</div>
    <div><span class="kal-map-legend-swatch kal-map-legend-swatch-blue"></span>Does not intersect IPLC</div>
  `;
  L.DomEvent.disableClickPropagation(container);
  return container;
};
legend.addTo(map);

if (geoLayer.getBounds().isValid()) {
  map.fitBounds(geoLayer.getBounds(), {padding: [20, 20], maxZoom: 12});
} else {
  map.setView([20, 0], 2);
}

// Prep data for barplot
const statsOverlapIPLC = await sql`
  SELECT dataset_l, COUNT(*) as count
  FROM energy_transition
  WHERE country_code = ${selectedCountry.country_code}
  GROUP BY dataset_l
`;

Inputs.table(statsOverlapIPLC, {
  select: false,
});
```

```sql
SELECT 
    dataset as "Energy type",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0), 0) AS "Total IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND lower(iplc_indicative) = 'false'), 0) AS "Precisely mapped areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND lower(iplc_indicative) = 'true'), 0) AS "Indicative areas (ha)"
FROM energy_transition, UNNEST(dataset_l) AS t(dataset)
WHERE dataset IN ('Mines', 'Wind', 'Solar', 'Hydropower', 'Geothermal')
AND country_code = ${selectedCountry.country_code}
GROUP BY dataset
ORDER BY 2 DESC;
```

```js
// display(
//   Plot.plot({
//     marks: [
//       Plot.ruleX([0]),
//       Plot.barX(countryDataGeoJSON, {
//         x: "count", y: "dataset"
//       })
//     ]
//   })
// )
```

<style>

.kal-map {
  height: 420px;
  margin: 1rem 0 2rem;
  border: 1px solid var(--theme-foreground-faint);
  border-radius: 6px;
  overflow: hidden;
}

.kal-map-legend {
  padding: 8px 10px;
  border: 1px solid #c8c8c8;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.94);
  color: #242424;
  font-size: 0.8rem;
  line-height: 1.7;
}

.kal-map-legend strong {
  display: block;
  margin-bottom: 2px;
}

.kal-map-legend-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border: 1px solid currentColor;
  border-radius: 50%;
  vertical-align: 0;
}

.kal-map-legend-swatch-red {
  background: #ef6a5b;
  color: #b42318;
}

.kal-map-legend-swatch-blue {
  background: #63b3c4;
  color: #176b87;
}

@media (max-width: 640px) {
  .kal-map {
    height: 340px;
  }
}

</style>