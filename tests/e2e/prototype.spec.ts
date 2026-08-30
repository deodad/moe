import { expect, test } from "@playwright/test";
import { WebSocketServer, type WebSocket } from "ws";

let responsesServer: WebSocketServer;
let fixtureScenario: Promise<void> | null = null;

test.beforeAll(async () => {
  responsesServer = new WebSocketServer({ host: "127.0.0.1", port: 43991 });
  await new Promise<void>((resolve, reject) => {
    responsesServer.once("listening", resolve);
    responsesServer.once("error", reject);
  });
  responsesServer.on("connection", (socket) => {
    fixtureScenario = runNanocodexScenario(socket);
  });
});

test.afterAll(async () => {
  for (const socket of responsesServer.clients) socket.terminate();
  await new Promise<void>((resolve, reject) => responsesServer.close((error) => error ? reject(error) : resolve()));
});

test("desktop Things and Maintenance share durable state", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "What are we taking care of?" })).toBeVisible();
  await page.locator("aside").getByRole("button", { name: /Maintenance/ }).click();
  await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();
  await expect(page.getByText("5,000-mile service", { exact: true })).toBeVisible();

  const serviceCard = page.getByText("5,000-mile service").locator("xpath=ancestor::div[.//button[normalize-space()='Done']][1]");
  await serviceCard.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("5,000-mile service", { exact: true })).toHaveCount(0);

  await page.locator("aside").getByRole("button", { name: "Things" }).click();
  await page.getByRole("button", { name: "4Runner Vehicle" }).click();
  await expect(page.getByText(/Keep long term/)).toBeVisible();
  await expect(page.getByText(/5,000-mile service completed/)).toBeVisible();

  await page.reload();
  await page.locator("aside").getByRole("button", { name: "Maintenance" }).click();
  await expect(page.getByText("5,000-mile service", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("phone layout exposes all three surfaces without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What are we taking care of?" })).toBeVisible();
  await page.locator("nav").last().getByRole("button", { name: "Maintenance" }).click();
  await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();
  await page.locator("nav").last().getByRole("button", { name: "Things" }).click();
  await expect(page.getByRole("heading", { name: "Things", exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/phone.png", fullPage: true });
});

test("chat streams a real Nanocodex tool turn into durable state", async ({ page }) => {
  await page.goto("/");
  const composer = page.getByPlaceholder("Tell Moe what happened…");
  await composer.fill("I just bought a 2026 4Runner. I want to keep it forever.");
  await composer.press("Enter");
  await expect(page.getByText("I added your 2026 4Runner.", { exact: true })).toBeVisible();
  await expect(page.getByText("I added your 2026 4Runner and its first service interval.", { exact: true })).toBeVisible();
  await expect(page.getByText("search things", { exact: true })).toBeVisible();
  await expect(page.getByText("create thing", { exact: true })).toBeVisible();
  await expect(page.getByText("create maintenance", { exact: true })).toBeVisible();
  await fixtureScenario;

  const state = await page.evaluate(async () => fetch("/api/state").then((response) => response.json()));
  const thing = state.things.find((item: { attributes: Record<string, string> }) => item.attributes.year === "2026");
  expect(thing.carePreferences).toContain("Keep forever");
  expect(state.maintenance.some((item: { thingId: string; title: string }) => item.thingId === thing.id && item.title === "5,000-mile service")).toBe(true);

  await page.reload();
  await expect(page.getByText("I added your 2026 4Runner and its first service interval.", { exact: true })).toBeVisible();
});

function messageReader(socket: WebSocket) {
  const messages: unknown[] = [];
  const waiters: Array<(value: Record<string, unknown>) => void> = [];
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as Record<string, unknown>;
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else messages.push(message);
  });
  return {
    next() {
      if (messages.length) return Promise.resolve(messages.shift() as Record<string, unknown>);
      return new Promise<Record<string, unknown>>((resolve) => waiters.push(resolve));
    },
  };
}

async function runNanocodexScenario(socket: WebSocket) {
  const reader = messageReader(socket);
  await reader.next();
  sendCompleted(socket, "warmup", []);

  await reader.next();
  sendTool(socket, "search", "call-search", "search_things", { query: "2026 4Runner" });

  await reader.next();
  sendTool(socket, "create", "call-create", "create_thing", {
    name: "4Runner",
    category: "Vehicle",
    attributes: { year: "2026", make: "Toyota", model: "4Runner" },
    care_preferences: "Keep forever. Proactive about worthwhile reliability maintenance.",
  });

  const created = await reader.next();
  const thing = functionOutput(created) as { id: string };
  sendTool(socket, "maintenance", "call-maintenance", "create_maintenance", {
    thing_id: thing.id,
    title: "5,000-mile service",
    timing: "later",
    rationale: "The first practical service interval to track.",
  });

  await reader.next();
  socket.send(JSON.stringify({ type: "response.output_text.delta", delta: "I added your 2026 4Runner." }));
  await new Promise((resolve) => setTimeout(resolve, 300));
  sendFinal(socket, "final", "I added your 2026 4Runner and its first service interval.");
}

function functionOutput(request: Record<string, unknown>) {
  const input = request.input as Array<{ type?: string; output?: string }>;
  const output = input.find((item) => item.type === "function_call_output")?.output;
  if (!output) throw new Error("Nanocodex continuation did not contain a function result");
  return JSON.parse(output) as unknown;
}

function sendTool(socket: WebSocket, responseId: string, callId: string, name: string, args: Record<string, unknown>) {
  sendCompleted(socket, responseId, [{
    type: "function_call",
    call_id: callId,
    name,
    arguments: JSON.stringify(args),
  }]);
}

function sendFinal(socket: WebSocket, responseId: string, text: string) {
  sendCompleted(socket, responseId, [{
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text }],
  }]);
}

function sendCompleted(socket: WebSocket, responseId: string, output: unknown[]) {
  socket.send(JSON.stringify({
    type: "response.completed",
    response: { id: responseId, status: "completed", output, usage: null },
  }));
}
