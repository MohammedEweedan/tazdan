-- Opt-in "near me" discovery for P2P listings. Coordinates are coarse (~1 km)
-- and only ever used server-side to compute a rounded distance.
ALTER TABLE "P2PListing" ADD COLUMN "locationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "P2PListing" ADD COLUMN "geoLat" DOUBLE PRECISION;
ALTER TABLE "P2PListing" ADD COLUMN "geoLng" DOUBLE PRECISION;

CREATE INDEX "P2PListing_locationEnabled_status_idx" ON "P2PListing"("locationEnabled", "status");
