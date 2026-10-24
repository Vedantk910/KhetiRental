-- Telematics time series (showcase/contracts/events/telemetry.events.json).
-- On TimescaleDB this becomes a hypertable with a 5-minute continuous
-- aggregate feeding TTF/EUR analytics; on plain Postgres it stays a table.
CREATE TABLE IF NOT EXISTS telemetry_points (
    machine_id        TEXT NOT NULL,
    observed_at       TIMESTAMPTZ NOT NULL,
    lat               DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng               DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    ecu_hours         DOUBLE PRECISION NOT NULL CHECK (ecu_hours >= 0),
    gps_travel_hours  DOUBLE PRECISION CHECK (gps_travel_hours >= 0),
    fuel_level_pct    DOUBLE PRECISION CHECK (fuel_level_pct BETWEEN 0 AND 100),
    anomaly_flags     TEXT[] NOT NULL DEFAULT '{}'
                      CHECK (anomaly_flags <@ ARRAY['GEOFENCE_BREACH', 'HOUR_TAMPER', 'FUEL_MISMATCH']),
    -- CRDT replays after a 2G drop resend the same sample; the key dedups it.
    PRIMARY KEY (machine_id, observed_at)
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
        CREATE EXTENSION IF NOT EXISTS timescaledb;
        PERFORM create_hypertable('telemetry_points', 'observed_at',
                                  chunk_time_interval => interval '1 day',
                                  if_not_exists => TRUE);
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'telemetry_5m') THEN
            EXECUTE $cagg$
                CREATE MATERIALIZED VIEW telemetry_5m WITH (timescaledb.continuous) AS
                SELECT machine_id,
                       time_bucket(interval '5 minutes', observed_at) AS bucket,
                       max(ecu_hours) - min(ecu_hours) AS engine_hours_delta,
                       last(lat, observed_at) AS lat,
                       last(lng, observed_at) AS lng
                  FROM telemetry_points
                 GROUP BY machine_id, bucket
                WITH NO DATA
            $cagg$;
        END IF;
    ELSE
        RAISE NOTICE 'timescaledb not available: telemetry_points left as a plain table';
    END IF;
END
$$;
