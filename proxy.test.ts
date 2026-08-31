import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deployment access gate", () => {
  it("stays out of the way during local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = proxy(new NextRequest("http://localhost:3000"));
    expect(response.status).toBe(200);
  });

  it("fails closed when production has no password", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOE_ACCESS_PASSWORD", "");
    const response = proxy(new NextRequest("https://moe.example.com"));
    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toBe("MOE_ACCESS_PASSWORD is not configured.");
  });

  it("challenges invalid credentials and accepts the configured pair", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOE_ACCESS_USERNAME", "tony");
    vi.stubEnv("MOE_ACCESS_PASSWORD", "secret phrase");

    const rejected = proxy(new NextRequest("https://moe.example.com", {
      headers: { authorization: `Basic ${Buffer.from("tony:wrong").toString("base64")}` },
    }));
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("www-authenticate")).toContain("Maintenance of Everything");

    const accepted = proxy(new NextRequest("https://moe.example.com", {
      headers: { authorization: `Basic ${Buffer.from("tony:secret phrase").toString("base64")}` },
    }));
    expect(accepted.status).toBe(200);
  });
});
