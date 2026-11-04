<script>
    import * as duckdb from '@duckdb/duckdb-wasm';
    import { onMount } from 'svelte';

    // let page_data = $props();
    //let db_file = page_data.data.file;

    let tmp = $state(10);

    onMount(async () => {
        // Instantiate DuckDB-Wasm from a jsDelivr bundle
        const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());

        // Worker scripts must be same-origin, so wrap the CDN worker in a Blob URL
        const worker_url = URL.createObjectURL(
            new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
        );
        const worker = new Worker(worker_url);
        let db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(worker_url);

        // Open a connection on the locl kal.duckdb base and run a query
        const conn = await db.connect();
        await conn.query('LOAD httpfs; LOAD SPATIAL;');

        // Load the database from the file
        await conn.query(`ATTACH '${window.location.origin}/data/kal.duckdb' AS kal;`);

        let result = await conn.query('SELECT * FROM kal.energy_transition LIMIT 10;');
        const rows = result.toArray().map((row) => row.toJSON());
        console.log(rows);

        // Release resources
        await conn.close();
        await db.terminate();
        await worker.terminate();

    });

</script>

<div class="bg-blue-100 h-full w-full">
    <div class="bg-blue-200">
        Filters
    </div>
    
    <div class="bg-blue-400">
        Content: {tmp}
    </div>
</div>