import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import "@testing-library/jest-dom";

import App from "./App";

test("Shows Welcome page on index", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByText("Welcome.")).toBeInTheDocument();
});

test("Navigate to WhatsThis page from Welcome screen", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  await screen.findByText("Welcome.");
  fireEvent.click(screen.getByText("What is this?"));

  expect(await screen.findByText("Quick Pitch")).toBeInTheDocument();
});

test("Start hello world example", async () => {
  const history = createMemoryHistory({ initialEntries: ["/examples"] });
  render(
    <Router history={history}>
      <App />
    </Router>
  );

  fireEvent.click(await screen.findByText("Hello World"));

  expect(await screen.findByText("Timer")).toBeInTheDocument();
  expect(await screen.findByText("Map")).toBeInTheDocument();
  expect(await screen.findByText("Canvas")).toBeInTheDocument();
});
