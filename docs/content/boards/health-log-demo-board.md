# Private Health Log

A personal record of blood glucose, blood pressure and weight, kept in the
board's own SQLite database and shown as both rows and time-series charts. It is
an example of keeping a usable copy of data on infrastructure you choose while
still leaving room for separate analytics and notification boards.

This demo records and displays values. It does not interpret them, recommend
targets, detect emergencies or replace professional care, a meter, a CGM, or an
official device application.

## What it does

The **Log** tab accepts three measurements plus a daily journal:

- blood glucose in mg/dL;
- blood pressure as systolic/diastolic in mmHg;
- weight in kg;
- free text about meals, drinks, sleep, exercise, symptoms or anything else the
  person considers relevant that day.

There is one journal row per calendar day. Saving again on the same day updates
that entry. It is deliberately free text rather than a medical questionnaire:
the board stores what the person chose to say without interpreting it.

Submitting creates an event id and UTC timestamp in the facade action. Those
same values travel to SQL and through the post-entry extension point, so a
downstream board can receive the identity and time of the exact event that was
stored rather than inventing its own on arrival.

The **Trends** tab reads the complete SQL history into three charts. Blood
pressure contains two series; glucose and weight each select their own series.
Hovering a point shows its precise timestamp, value and the journal for that
day. The journal is joined onto the query result, so the reusable chart only
needs its generic `contextField` setting and has no health-specific behavior.
The **Your data** tab shows the underlying records and can delete selected
events. Selecting one blood-pressure event removes both its systolic and
diastolic rows.

## The services

One REST runtime on hkp-node contains:

1. **Record one value** — stores scalar measurements such as glucose and
   weight.
2. **Record blood pressure** — parses one `120/80`-shaped event into two rows
   sharing an event id.
3. **Save daily journal** — inserts or updates the free-text entry for the
   current day.
4. **After a new entry** — a SubService whose **Entry event** Monitor shows the
   event available for downstream work.
5. **Delete selected entries** — removes events selected in the data table.
6. **Read personal history** — joins the daily journal onto each measurement
   and returns the history used by both table and
   charts.

Every mutation uses `emit: "input"` and ends at the same read query. The screen
therefore reflects the database after each action rather than maintaining a
second copy of the history in facade state.

## Analytics and notifications are another board's job

The health log records observations and does not decide what they mean. That
separation is intentional: a board that graphs personal history should not
silently become a clinical rules engine.

`After a new entry` is the composition point. Today its Monitor makes the event
contract visible. An HTTP Client can be placed after it and configured with an
`hkp-mount://<runtime>/<service>` endpoint belonging to a composed analytics
board. That other board can aggregate, notify, export or apply user-chosen
rules without changing data entry or storage here. Journal saves travel through
the same extension point, which makes a later learning or analysis board
possible without coupling that work to this log.

Deleting history starts later in the top-level pipeline, so deletions refresh
the display but do not masquerade as new measurement events.

## Where the data lives

The database belongs to this board on the configured hkp-node runtime. With a
local runtime, the history stays in that runtime's local SQLite storage. If the
runtime URL points at another machine, entries are sent to and stored on that
machine instead. The board does not claim encryption or regulatory compliance;
ownership still depends on where and how its runtime is operated.

Free-text journals may be more identifying and sensitive than the numeric
measurements. The demo never sends them to a model by itself; doing so requires
an explicit downstream board chosen and configured by the person operating it.

Starter rows are synthetic and are seeded once. A marker in the database keeps
deleted samples from returning after a restart.

## A query-backed line chart

The line-chart facade widget accepts either one live point or an array that
replaces its complete history. `seriesField`, `valueField` and `timeField` map a
board's own query columns onto the chart without requiring a market-price
schema. `symbol` or `symbols` selects which series a particular chart draws.
An optional `contextField` adds per-point text to the hover card and
`contextLabel` names it.

This keeps the SQL result useful to the table and the charts at the same time:
neither needs a service devoted only to reshaping the other's data.

## Try it

Run hkp-node on port 8080 and open **Private Health Log** from the demo list.
The initial values are fictional and exist only to make the charts immediately
inspectable.
