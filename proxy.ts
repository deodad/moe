import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function matches(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function authorized(request: NextRequest, username: string, password: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return false;

  try {
    const supplied = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    return matches(supplied, `${username}:${password}`);
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const password = process.env.MOE_ACCESS_PASSWORD?.trim();
  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new Response("MOE_ACCESS_PASSWORD is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const username = process.env.MOE_ACCESS_USERNAME?.trim() || "moe";
  if (authorized(request, username, password)) return NextResponse.next();

  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Maintenance of Everything", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|healthz).*)"],
};
