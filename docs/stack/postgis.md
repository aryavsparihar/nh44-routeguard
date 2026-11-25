# PostGIS

**In one line:** PostGIS lets the database store map points and measure real distances in metres.

## What it is

PostGIS is an extension that adds geography to PostgreSQL: point and line types, and functions like "distance between two points" or "is this point within 300 m of that one".

## Why we use it

- Reports, zone centres, incidents and truck locations are points on the map.
- Finding a duplicate report means "another report of the same hazard nearby": a distance question.
- The database does it with an index, faster and more accurately than our own maths.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `supabase/migrations/20261110173410_enable_postgis.sql` | Turns PostGIS on |
| `supabase/migrations/20261110173415_create_tables.sql` | Columns of type `geography(Point, 4326)` |
| `supabase/migrations/20261125160000_reports_write.sql` | Duplicate check with `st_dwithin` and `st_distance` |

## How it works in RouteGuard

- Every location is `geography(Point, 4326)`: longitude and latitude on the WGS84 globe (the same as GPS), with distances in metres.
- A point is made with `st_setsrid(st_makepoint(lng, lat), 4326)`. Note: **longitude first**.
- When you send a report, the database looks for a report of the same hazard within a set distance (`st_dwithin`). If one exists, yours becomes a confirmation of it instead of a second report.

## Learn more

- https://postgis.net/documentation/

## Questions you may be asked

**Q: What does 4326 mean?**
A: It's the code for WGS84, the coordinate system GPS uses: latitude and longitude in degrees.

**Q: Why `geography` and not `geometry`?**
A: `geography` measures on the round Earth and gives metres directly. `geometry` works on a flat plane and would need a conversion.

**Q: How do you stop duplicate reports?**
A: When a report comes in, PostGIS checks for a recent report of the same hazard nearby. If there is one, the new one counts as a confirmation.

**Q: Why longitude first?**
A: PostGIS follows the x, y order of maths: x is longitude (east–west), y is latitude (north–south).
