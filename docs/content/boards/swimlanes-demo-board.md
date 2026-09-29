# Swimlanes

Five ordered card lanes backed by SQLite and composed from five independent
`swimlane` facade widgets. It is a small Trello-shaped board rather than a
workflow engine: people open it, arrange work and change the cards in real
time.

## What it does

- **Backlog** and **Ready** allow cards to be created.
- **In progress**, **Review** and **Done** only accept cards moved into them.
- Every card can be edited or deleted in every lane.
- Cards can be moved between any two lanes and reordered within a lane.

Each lane is a widget in an ordinary facade row. Adding a sixth lane means
adding another widget with another `laneId`; there is no enclosing kanban
widget to change.

## One query, several views

Every lane reads `read-board.rows`, the result of one [SQL](../services/sql.md)
query. A lane selects the rows carrying its own `laneId` and orders them by the
query's `position` field. Empty lanes still exist because the lane itself is
facade composition, not a group inferred from whichever cards happen to exist.

The widgets share only a `dragGroup`. While a card is being dragged, the facade
uses that group to let the destination lane recognise it. Cards and rules never
move into frontend state: the drop sends an operation to SQL, and the query at
the end of the pipeline redraws every lane from the database's answer.

## The services

One REST runtime on hkp-node holds six top-level services:

1. **Move or reorder a card** ranks the destination lane and changes its order
   and the moved card's lane in the same SQL statement.
2. **After a card moves** is a [SubService](../services/sub-service.md) holding
   a **Move event** Monitor.
3. **Create a card** appends a card to a lane.
4. **Edit a card** changes its title and description.
5. **Delete a card** removes it.
6. **Read the board** returns the ordered rows all lanes display.

The changing statements use `emit: "input"`, so the operation survives until
the final query. Each operation enters at the service that owns it: creating a
card starts at **Create a card**, for example, and therefore does not pass
through the move hook that sits earlier in the runtime.

## Following a move with another board

`After a card moves` currently passes the event through a Monitor, so opening
**Move event** inside the SubService shows exactly what a downstream board could
receive. The Monitor is observational: its output is the same value as its
input, so the board still reaches the refresh query afterward.

To add custom behaviour later, follow or replace the Monitor with services in
that SubService. An HTTP Client can call an endpoint on another composed board
by using its `hkp-mount://<runtime>/<service>` reference.

The event already carries:

```json
{
  "operation": "move",
  "cardId": 4,
  "fromLaneId": "doing",
  "toLaneId": "review",
  "fromPosition": 0,
  "toPosition": 1,
  "card": { "cardId": 4, "title": "Build swimlane widget" }
}
```

That keeps the swimlane widget ignorant of the board that reacts to a move.
The extension remains an ordinary nested pipeline; the Monitor makes its
contract visible while the real integration is still absent.

## The swimlane widget

The conventional source fields are `cardId`, `laneId`, `title`, `description`
and `position`. A board can point each field at a different, dotted name using
`cardIdField`, `laneIdField`, `titleField`, `descriptionField` and
`positionField`.

`allowCreate` only controls whether the lane offers the create button. The
actual effects stay explicit as `createActions`, `editActions`,
`deleteActions` and `moveActions`. Their templates are filled from the
operation object before the normal facade action runner processes them.

## Try it

Run hkp-node on port 8080 and open **Swimlanes** from the demo list. The schema
and starter cards are created on first run in the board's `swimlanes-demo`
database.
