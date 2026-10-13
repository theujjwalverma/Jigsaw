import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEffect, useRef, useState } from "react";
import { AdminPage } from "../../src/pages/AdminPage";
import { api } from "../../src/services/api";
import { socket } from "../../src/services/socket";
import { findElement } from "../helpers/findElement";

vi.mock("react", () => ({ useEffect: vi.fn(), useRef: vi.fn(), useState: vi.fn() }));
vi.mock("../../src/services/api", () => ({ API_BASE: "", api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("../../src/services/socket", () => ({
  socket: { connect: vi.fn(), emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

let setters, refs, summary;
const times = [60, 120, 180, 240, 300];
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("window", {
    location: { origin: "http://game.test" }, localStorage: { setItem: vi.fn() },
  });
  summary = {
    roundSecondsByRound: times, roundSeconds: 60, leaderboardSeconds: 10,
    status: "lobby", currentRound: 0, uploadedRounds: [1, 2],
  };
  api.get.mockImplementation(async (path) => ({ data: path.endsWith("/players") ? [] : summary }));
  api.patch.mockResolvedValue({ data: summary });
  api.post.mockResolvedValue({ data: { id: "created-event", round: 2 } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function render(overrides = {}) {
  const values = {
    activeEventId: "event", eventIdInput: "event", eventCode: "", password: "", message: "",
    roundSecondsByRound: times, leaderboardSeconds: 10, players: [], eventStatus: "lobby",
    uploadedRounds: [1, 2], activeRound: 0, isAuthed: true, uploadMessages: {}, copiedJoinUrl: false, showResetConfirm: false, isTimersOpen: false,
    roundGrids: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },
    previewUrls: {},
    ...overrides,
  };
  setters = {};
  refs = [];
  useState.mockReset();
  useEffect.mockClear();
  for (const [key, value] of Object.entries(values)) {
    setters[key] = vi.fn((update) => {
      values[key] = typeof update === "function" ? update(values[key]) : update;
    });
    useState.mockReturnValueOnce([value, setters[key]]);
  }
  useRef.mockImplementation((initial) => {
    const ref = { current: initial };
    refs.push(ref);
    return ref;
  });
  return AdminPage();
}

function button(page, label) {
  return findElement(page, (node) => node.type === "button" && node.props.children === label);
}

function input(page, id) {
  return findElement(page, (node) => node.type === "input" && (node.props.id === id || node.props["aria-label"] === id));
}

function select(page, label) {
  return findElement(page, (node) => node.type === "select" && (node.props.id === label || node.props["aria-label"] === label));
}

it("edits one round without altering other durations", () => {
  const page = render();
  input(page, "round-3-seconds").props.onChange({ target: { value: "420" } });
  const update = setters.roundSecondsByRound.mock.calls[0][0];
  expect(update(times)).toEqual([60, 120, "420", 240, 300]);
});

it("creates an event using all five entered durations", async () => {
  const page = render({ roundSecondsByRound: times.map(String), leaderboardSeconds: "10" });
  await button(page, "Create Event").props.onClick();
  expect(api.post).toHaveBeenCalledWith("/events", { roundSecondsByRound: times, leaderboardSeconds: 10 });
  expect(window.localStorage.setItem).toHaveBeenCalledWith("jigsaw-admin-event", "created-event");
});

it("saves the full list and explains that running countdowns are unchanged", async () => {
  const page = render({ roundSecondsByRound: times.map(String) });
  const preventDefault = vi.fn();
  await findElement(page, "form").props.onSubmit({ preventDefault });
  expect(preventDefault).toHaveBeenCalled();
  expect(api.patch).toHaveBeenCalledWith("/events/event/settings", { roundSecondsByRound: times, leaderboardSeconds: 10 });
  expect(setters.roundSecondsByRound).toHaveBeenCalledWith(times);
  expect(setters.message).toHaveBeenCalledWith(expect.stringContaining("running countdown is unchanged"));
});

it("loads saved durations once and preserves unsaved edits during polling", async () => {
  render();
  const cleanup = useEffect.mock.calls[2][0]();
  await flush();
  expect(setters.roundSecondsByRound).toHaveBeenCalledTimes(1);
  expect(setters.roundSecondsByRound).toHaveBeenCalledWith(times);
  summary.roundSecondsByRound = [90, 90, 90, 90, 90];
  await vi.advanceTimersByTimeAsync(10000);
  expect(setters.roundSecondsByRound).toHaveBeenCalledTimes(1);
  cleanup();
  expect(socket.off).toHaveBeenCalledWith("game:round-start", expect.any(Function));
});

it("loads a legacy event's shared duration into every round field", async () => {
  delete summary.roundSecondsByRound;
  summary.roundSeconds = 180;
  const page = render();
  await button(page, "Refresh").props.onClick();
  expect(setters.roundSecondsByRound).toHaveBeenCalledWith([180, 180, 180, 180, 180]);
});

it("does not apply a save response to a newly selected event", async () => {
  const page = render();
  api.patch.mockImplementation(async () => {
    refs[0].current = "different-event";
    return { data: summary };
  });
  await findElement(page, "form").props.onSubmit({ preventDefault: vi.fn() });
  expect(setters.roundSecondsByRound).not.toHaveBeenCalled();
  expect(setters.message).not.toHaveBeenCalled();
});

it("shows validation failures and expired admin sessions explicitly", async () => {
  const page = render();
  api.patch.mockRejectedValue({ response: { status: 401, data: { error: "Session expired" } } });
  await findElement(page, "form").props.onSubmit({ preventDefault: vi.fn() });
  expect(setters.isAuthed).toHaveBeenCalledWith(false);
  expect(setters.message).toHaveBeenCalledWith("Save timer settings failed: Session expired");
});

it.each([
  ["/events", "Create Event", "Create event failed: Invalid duration"],
  ["/events/event/start-game", "Start Round 1", "Start round failed: Invalid duration"],
  ["/events/event/end-round", "End Round Now", "End round failed: Invalid duration"],
  ["/events/event/advance-round", "Advance Round", "Advance round failed: Invalid duration"],
])("preserves explicit errors for %s", async (path, label, message) => {
  const page = render({ eventStatus: "in_round", activeRound: 1 });
  api.post.mockRejectedValue({ response: { data: { error: "Invalid duration" } } });
  await button(page, label).props.onClick();
  expect(api.post.mock.calls[0][0]).toBe(path);
  expect(setters.message).toHaveBeenCalledWith(message);
});

it.each(["Start Round 1", "End Round Now", "Advance Round"])("refreshes state after %s", async (label) => {
  const page = render({ eventStatus: "in_round", activeRound: 1 });
  await button(page, label).props.onClick();
  expect(api.get).toHaveBeenCalledWith("/events/event");
  expect(api.get).toHaveBeenCalledWith("/events/event/players");
});

it("opens another event and loads its saved timers", async () => {
  const page = render({ eventIdInput: "next-event" });
  await button(page, "Open Event").props.onClick();
  expect(setters.activeEventId).toHaveBeenCalledWith("next-event");
  expect(setters.roundSecondsByRound).toHaveBeenCalledWith(times);
});

it("reports missing event IDs and refresh failures", async () => {
  let page = render({ eventIdInput: "" });
  await button(page, "Open Event").props.onClick();
  expect(setters.message).toHaveBeenCalledWith("Enter an event ID to control");
  page = render();
  api.get.mockRejectedValue(new Error("offline"));
  await button(page, "Refresh").props.onClick();
  expect(setters.message).toHaveBeenCalledWith("Refresh failed: offline");
});

it("restores an authenticated admin session and reports session check failures", async () => {
  render();
  useEffect.mock.calls[1][0]();
  await flush();
  expect(setters.isAuthed).toHaveBeenCalledWith(true);
  render();
  api.get.mockRejectedValue(new Error("offline"));
  useEffect.mock.calls[1][0]();
  await flush();
  expect(setters.message).toHaveBeenCalledWith("Session check failed: offline");
});

it("preserves login feedback", async () => {
  let page = render({ password: "test-password" });
  await button(page, "Login").props.onClick();
  expect(setters.isAuthed).toHaveBeenCalledWith(true);
  page = render();
  api.post.mockRejectedValue(new Error("offline"));
  await button(page, "Login").props.onClick();
  expect(setters.message).toHaveBeenCalledWith("Login failed: offline");
});

it("keeps upload feedback and clears the file field for retry", async () => {
  const page = render();
  const target = { files: [new Blob(["image"], { type: "image/png" })], value: "image.png" };
  await input(page, "Round 1 image").props.onChange({ target });
  expect(api.post).toHaveBeenCalledWith("/events/event/upload/1", expect.any(FormData));
  expect(setters.message).toHaveBeenCalledWith("Uploaded image for round 1");
  expect(target.value).toBe("");
});

it("displays upload rejection instead of reporting success", async () => {
  const page = render();
  api.post.mockRejectedValue({ response: { status: 401, data: { error: "Session expired" } } });
  await input(page, "Round 1 image").props.onChange({
    target: { files: [new Blob(["image"])], value: "image.png" },
  });
  expect(setters.isAuthed).toHaveBeenCalledWith(false);
  expect(setters.message).toHaveBeenCalledWith(expect.stringContaining("Upload failed: Admin session expired"));
});

it("preserves player removal and reports removal errors", async () => {
  let page = render({ players: [{ id: "player", name: "Alice", connected: true, status: "waiting" }] });
  await button(page, "Remove").props.onClick();
  expect(api.delete).toHaveBeenCalledWith("/events/event/players/player");
  page = render({ players: [{ id: "player", name: "Alice", connected: false, status: "waiting", roundState: { moves: 2 } }] });
  api.delete.mockRejectedValue(new Error("offline"));
  await button(page, "Remove").props.onClick();
  expect(setters.message).toHaveBeenCalledWith("Remove player failed: offline");
});

it("updates host access, event selection and the leaderboard pause independently", () => {
  const page = render();
  input(page, "Admin password").props.onChange({ target: { value: "test-password" } });
  input(page, "Event ID").props.onChange({ target: { value: "next-event" } });
  input(page, "leaderboard-seconds").props.onChange({ target: { value: "15" } });
  expect(setters.password).toHaveBeenCalledWith("test-password");
  expect(setters.eventIdInput).toHaveBeenCalledWith("next-event");
  expect(setters.leaderboardSeconds).toHaveBeenCalledWith("15");
  expect(setters.roundSecondsByRound).not.toHaveBeenCalled();
});

it("refreshes saved settings on socket reconnect without replacing unsaved fields", async () => {
  render();
  useEffect.mock.calls[0][0]();
  const cleanup = useEffect.mock.calls[2][0]();
  await flush();
  socket.on.mock.calls.find(([event]) => event === "connect")[1]();
  socket.on.mock.calls.find(([event]) => event === "game:round-start")[1]();
  await flush();
  expect(setters.roundSecondsByRound).toHaveBeenCalledTimes(1);
  expect(socket.emit).toHaveBeenCalledWith("event:watch", { eventId: "event" });
  cleanup();
});

it("does not watch or refresh without an event and rejects uploads without login", async () => {
  const page = render({ activeEventId: "", eventIdInput: "", isAuthed: false });
  useEffect.mock.calls[2][0]();
  expect(socket.connect).not.toHaveBeenCalled();
  await button(page, "Refresh").props.onClick();
  expect(api.get).not.toHaveBeenCalled();
  await button(page, "Start Round 1").props.onClick();
  expect(setters.message).toHaveBeenCalledWith("Please create/select an event first");
  await input(page, "Round 1 image").props.onChange({ target: { files: [new Blob(["image"])], value: "image.png" } });
  expect(api.post).not.toHaveBeenCalled();
  expect(setters.message).toHaveBeenCalledWith("Log in and create or open an event before uploading images.");
});

it("ignores cancelled file selection and prevents replacing a pending upload", async () => {
  const page = render({ uploadMessages: { 1: "Uploading..." } });
  expect(input(page, "Round 1 image").props.disabled).toBe(true);
  await input(page, "Round 2 image").props.onChange({ target: { files: [], value: "" } });
  expect(api.post).not.toHaveBeenCalled();
});

it("ignores stale timer save errors after changing events", async () => {
  const page = render();
  api.patch.mockImplementation(async () => {
    refs[0].current = "different-event";
    throw new Error("Old event error");
  });
  await findElement(page, "form").props.onSubmit({ preventDefault: vi.fn() });
  expect(setters.message).not.toHaveBeenCalled();
});

it("reports failed event opening and renders error and final-round states", async () => {
  const page = render({ message: "Open event failed: offline", activeRound: 5, uploadedRounds: [1, 2, 3, 4, 5] });
  expect(findElement(page, (node) => node.props.role === "status").props.className).toBe("error");
  api.get.mockRejectedValue(new Error("offline"));
  await button(page, "Open Event").props.onClick();
  expect(setters.message).toHaveBeenCalledWith("Open event failed: offline");
});

it("allows selecting pieces / grid size for each round and passes grid on upload", async () => {
  const page = render();
  const round1Select = select(page, "Round 1 pieces");
  expect(round1Select.props.value).toBe(2);
  await round1Select.props.onChange({ target: { value: "4" } });
  const update = setters.roundGrids.mock.calls[0][0];
  expect(update({ 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 })).toEqual({ 1: 4, 2: 3, 3: 4, 4: 5, 5: 6 });
  expect(api.patch).toHaveBeenCalledWith("/events/event/rounds/1/grid", { grid: 4 });

  const pageWithGrid4 = render({ roundGrids: { 1: 4, 2: 3, 3: 4, 4: 5, 5: 6 } });
  await input(pageWithGrid4, "Round 1 image").props.onChange({
    target: { files: [new Blob(["image"])], value: "test.png" },
  });
  expect(api.post).toHaveBeenCalledWith(
    "/events/event/upload/1",
    expect.any(FormData),
  );
  const formData = api.post.mock.calls.find(([path]) => path === "/events/event/upload/1")[1];
  expect(formData.get("grid")).toBe("4");
});

it("renders image preview when a round is uploaded", () => {
  const page = render({ uploadedRounds: [1], previewUrls: { 1: "blob:http://localhost/test" } });
  const previewImg = findElement(page, (node) => node.type === "img" && node.props.alt === "Round 1 preview");
  expect(previewImg).toBeDefined();
  expect(previewImg.props.src).toBe("blob:http://localhost/test");
  expect(previewImg.props.className).toBe("round-image-preview");
});
