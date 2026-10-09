import { readFileSync } from "node:fs";

/**
 * The SQL persistence specs run in signed-out web and desktop profiles. Give
 * their seeded court board a fixed member so the specs exercise SQLite without
 * depending on an external Auth0 session. The shipped board remains unchanged.
 */
export function courtBookingForSqlTests() {
  const board = JSON.parse(
    readFileSync("../boards/court-booking-browser-demo-board.json", "utf8"),
  );
  for (const service of board.services.club) {
    if (typeof service.state?.statement === "string") {
      service.state.statement = service.state.statement
        .replaceAll("$caller_email", "'you@club.example'")
        .replaceAll("$caller_name", "'You'");
    }
  }
  return board;
}
