# IP Lookup

Where an IP address is and whose it is, answered from tables the runtime holds.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `ip-lookup` |

---

## What it does

IP Lookup takes an address — `203.0.113.7`, `2001:db8::1` — and answers with the
place it is registered to, the network it belongs to and the organisation that
runs that network. The answer comes from tables the runtime holds. Looking an
address up makes no connection of any kind, so the address is told to nobody: the addresses a
board sees are usually its visitors', and a lookup at a web service hands each
one to that service.

### Two kinds of table

**Published tables** are what know that an address is in Lisbon. They come as
MMDB files — the format MaxMind's GeoLite2, DB-IP's Lite and IPinfo's free
tables are all published in — and are named as [assets](../concepts/assets.md).
Place and organisation are published separately (a *City* table and an *ASN*
table), so `databases` is a list and the answers are merged into one. The first
table to say a thing is the one believed.

**The board's own rows** are what no publisher knows: that `10.20.0.0/16` is the
Berlin office, that one address is the build server. A row is a network and
whatever the board wants said about it:

```json
"table": [
  { "network": "10.20.0.0/16", "organisation": "Example GmbH", "city": "Berlin", "site": "HQ" },
  { "network": "198.51.100.77", "organisation": "The build server" }
]
```

A row wins over the published tables, and the most specific row wins over the
others. Its fields are added to what the tables said rather than replacing the
whole answer, so the build server above still has the city its published table
gave it. A board that needs nothing else can run on rows alone, with no table
named at all.

### One vocabulary

Each publisher names its fields differently and nests them differently. They are
narrowed here to one set of names, so a board reads `city` whoever's table it
came from. A field no table had is left out rather than sent empty.

### Not knowing is an answer

An address in no table produces `found: false`, not an error and not a stopped
pipeline. `addressType` says why a lookup of `192.168.1.4` was never going to
find a place: it is `private`. A board that wants only the hits puts a
[Filter](./filter.md) behind this.

---

## Getting a table

The tables are their publishers' and are not shipped with Readymade, and they
are not part of a board either. A board holds **where a table is published and
how it is packed**:

```json
"assets": [
  { "id": "geo-city", "name": "DB-IP City Lite", "mediaType": "application/octet-stream",
    "url": "https://download.db-ip.com/free/dbip-city-lite-2026-11.mmdb.gz",
    "encoding": "gzip", "runtimes": ["node"] },
  { "id": "geo-asn", "name": "DB-IP ASN Lite", "mediaType": "application/octet-stream",
    "url": "https://download.db-ip.com/free/dbip-asn-lite-2026-11.mmdb.gz",
    "encoding": "gzip", "runtimes": ["node"] }
]
```

and the service names them:

```json
"databases": ["hkp-asset://geo-city", "hkp-asset://geo-asn"]
```

The runtime fetches each table the first time it is needed, unpacks it, and
keeps the download on its own disk. From then on a restart asks the publisher
only whether the file changed, and a runtime with no network answers from the
copy it has. `"runtimes": ["node"]` keeps the descriptor to the runtime that
uses it.

**Updating.** `{ "reload": true }` — *Update* on the panel — asks each source
again and takes a newer table where there is one. A publisher that puts the
release in the address, as DB-IP does with the month, is moved on by editing the
asset's URL; the service hears the edit and reads the new table without being
reconfigured. A table that cannot be fetched or read leaves the one already
held answering, and says so in `error`.

**How large.** A country table is 5–10 MB unpacked, an ASN table about 10 MB,
a city table 60–130 MB. A table is held in memory by each service using it, and
hkp-node takes an asset of up to 256 MB (`HKP_MAX_ASSET_BYTES`).

**A table that needs an account.** An asset carries no credentials, so a
publisher that wants a licence key — MaxMind, for GeoLite2 — is not a `url`
asset. Fetch it with a service that says where the key goes, write it to a
volume, and name the file:

```
HTTP Client (the download URL, key from {{secret.…}}) → Filesystem (volume: "geo", operation: "write", path: "city.mmdb")
```

```json
{ "id": "geo-city", "mediaType": "application/octet-stream", "url": "file:///geo/city.mmdb" }
```

A download that arrives as an archive (`.tar.gz`) has to be unpacked to the
`.mmdb` first; `"encoding": "gzip"` undoes compression, not an archive.

**Licences.** Each publisher has its own terms, and most ask to be named. DB-IP's
Lite tables are CC BY 4.0.

A table is a snapshot. City-level placement drifts as providers move address
pools around, enough to notice within a year; country and organisation hardly
move in that time. Even a
current table places an address at city level at best — it is where a network
is registered, not where a person is sitting.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `databases` | `array` | `[]` | The tables, as asset references (`hkp-asset://<id>`), in the order they are believed. A comma-separated string is accepted |
| `table` | `array` | `[]` | The board's own rows: `{ network, …fields }`. `network` is a CIDR or a single address |
| `field` | `string` | `"ip"` | Where an object input keeps its address |
| `target` | `string` | `"geo"` | Where an object input is given its answer |
| `language` | `string` | `"en"` | Which language place names are read in, where a table has several; English otherwise |
| `raw` | `boolean` | `false` | Also carry each table's record as published, under `records` |
| `tables` | `array` | — | Read-only: each table named — its type, build date and size, and why it did not load or update |
| `loading` | `boolean` | — | Read-only: whether tables are being fetched or read |
| `error` | `string` | — | Read-only: what is wrong with a table or a row, if anything |

### Commands

| Key | What it does |
|---|---|
| `reload` | Asks each table's source again, and reads what is newer |
| `lookup` | Looks one address up and notifies the answer as `lastResult`, without a pass through the pipeline — what the panel's *Try an address* uses |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | An address as text; an object carrying one in `field`; or an array of either |
| **Output** | The answer; the object with the answer added under `target`; an array of the same length |

Text may come the way addresses travel: in brackets (`[2001:db8::1]`), with a
zone (`fe80::1%en0`), or as the first entry of an `X-Forwarded-For` list. An
IPv4-mapped IPv6 address is read as the IPv4 address it carries.

### The answer

```json
{
  "ip": "198.51.100.77",
  "version": 4,
  "addressType": "public",
  "found": true,
  "network": "198.51.100.0/24",
  "continent": "Europe",
  "continentCode": "EU",
  "country": "Portugal",
  "countryCode": "PT",
  "region": "Lisbon District",
  "regionCode": "11",
  "city": "Lisbon",
  "postalCode": "1000",
  "latitude": 38.7167,
  "longitude": -9.1333,
  "accuracyRadius": 20,
  "timeZone": "Europe/Lisbon",
  "asn": 64500,
  "organisation": "Example Net",
  "sources": ["geo-city", "geo-asn"]
}
```

| Field | What it is |
|---|---|
| `found` | Whether any table knew the address |
| `addressType` | `public`, or why it is not: `private`, `loopback`, `link-local`, `shared`, `documentation`, `multicast`, `reserved`, `unspecified` |
| `network` | The range the answer holds for — the most specific one any source matched |
| `accuracyRadius` | Kilometres around the coordinates the publisher stands behind |
| `asn`, `organisation` | The autonomous system announcing the network, and who runs it |
| `isp`, `domain` | Present when a table has them |
| `sources` | Which tables contributed, by asset id — `"table"` being the board's own rows |
| `error` | Present instead of everything else when the input was not an address |

The last answer is notified so a panel can show it, and is deliberately **not**
part of the state a board is saved with: it is about somebody's address.

---

## Typical uses

### Say where a request came from

```
HTTP Endpoint → Map (take the caller's address) → IP Lookup → Map (greet by country)
```

### Enrich a log before storing it

```
Queue → IP Lookup (field: "remote", target: "where") → SQL (insert)
```

### Tell colleagues from strangers

```
IP Lookup (table: the office ranges) → Filter (geo.site exists) → …
```
