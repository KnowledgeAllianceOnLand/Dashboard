---
theme: dashboard
title: KAL Dashboard
toc: false
---

# Rocket launches 🚀

```js
import * as duckdb from "npm:@duckdb/duckdb-wasm";
import {DuckDBClient} from "npm:@observablehq/duckdb";
```

```js
//const db = await DuckDBClient.of()
const sql = DuckDBClient.sql();
```

```sql
LOAD httpfs; LOAD spatial;
```

```sql
ATTACH 'https://github.com/KnowledgeAllianceOnLand/Dashboard/releases/download/data/kal.duckdb';
```

```sql
SELECT * FROM energy_transition LIMIT 50;
```
