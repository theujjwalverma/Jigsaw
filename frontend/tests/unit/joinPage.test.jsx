import { beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { JoinPage } from "../../src/pages/JoinPage";
import { api } from "../../src/services/api";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), setSession: vi.fn(), setName: vi.fn(), setError: vi.fn(), setJoining: vi.fn(),
}));
vi.mock("react", () => ({ useState: vi.fn() }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate, useParams: () => ({ eventId: "event" }),
}));
vi.mock("../../src/services/api", () => ({ api: { post: vi.fn() } }));
vi.mock("../../src/services/gameState", () => ({
  useGameStore: (selector) => selector({ setSession: mocks.setSession }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useState.mockReturnValueOnce(["Alice", mocks.setName])
    .mockReturnValueOnce(["", mocks.setError])
    .mockReturnValueOnce([false, mocks.setJoining]);
});

it("submits the labelled join form and shows pending feedback", async () => {
  api.post.mockResolvedValue({ data: { playerId: "player", name: "Alice" } });
  const page = JoinPage();
  const form = page.props.children.find((child) => child?.type === "form");
  const event = { preventDefault: vi.fn() };
  await form.props.onSubmit(event);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledWith("/events/event/join", { name: "Alice" });
  expect(mocks.setJoining.mock.calls).toEqual([[true], [false]]);
  expect(mocks.setSession).toHaveBeenCalledWith({ eventId: "event", playerId: "player", playerName: "Alice" });
  expect(mocks.navigate).toHaveBeenCalledWith("/lobby/event");
  const input = form.props.children.find((child) => child.type === "input");
  expect(input.props.id).toBe("player-name");
  input.props.onChange({ target: { value: "Bob" } });
  expect(mocks.setName).toHaveBeenCalledWith("Bob");
});

it.each([
  [{ response: { data: { error: "Joining is locked" } } }, "Joining is locked"],
  [new Error("Network error"), "Unable to join"],
])("surfaces errors and clears the pending state", async (error, message) => {
  api.post.mockRejectedValue(error);
  const form = JoinPage().props.children.find((child) => child?.type === "form");
  await form.props.onSubmit({ preventDefault: vi.fn() });
  expect(mocks.setError).toHaveBeenLastCalledWith(message);
  expect(mocks.setJoining).toHaveBeenLastCalledWith(false);
  expect(mocks.navigate).not.toHaveBeenCalled();
});

it("disables the join button while pending and presents failures as an alert", () => {
  useState.mockReset();
  useState.mockReturnValueOnce(["Alice", mocks.setName])
    .mockReturnValueOnce(["Joining is locked", mocks.setError])
    .mockReturnValueOnce([true, mocks.setJoining]);
  const page = JoinPage();
  const form = page.props.children.find((child) => child?.type === "form");
  const button = form.props.children.find((child) => child.type === "button");
  expect(button.props.disabled).toBe(true);
  expect(button.props.children).toBe("Joining...");
  const alert = page.props.children.find((child) => child?.props?.role === "alert");
  expect(alert.props.children).toBe("Joining is locked");
});
