import { describe, expect, it } from "vitest";
import { COOKIE_NAME, STANZA_CSRF_COOKIE } from "../shared/const";
import { clientIpFromHeaders, requestFromFetch, responseFromHeaders } from "./_core/http";
import { STANZA_AUTH_MODE_COOKIE, STANZA_SESSION_COOKIE } from "./_core/localAuth";
import { GET, POST } from "../app/api/trpc/[trpc]/route";

const csrf = "b".repeat(64);
const url = (path: string) => `http://localhost/api/trpc/${path}`;
const mutation = (headers: Record<string, string> = {}) =>
  new Request(url("auth.logout"), { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ json: null }) });

describe("fetch cookie adapter", () => {
  it("serializes cookies like Express (ms maxAge, SameSite=None, Secure, HttpOnly)", () => {
    const headers = new Headers();
    responseFromHeaders(headers).cookie("a", "b c", { httpOnly: true, path: "/", sameSite: "none", secure: true, maxAge: 5000 });
    const [line] = headers.getSetCookie();
    expect(line).toContain("a=b%20c");
    for (const attribute of ["Max-Age=5", "Path=/", "HttpOnly", "Secure", "SameSite=None"]) expect(line).toContain(attribute);
  });

  it("expires cleared cookies and keeps their attributes", () => {
    const headers = new Headers();
    responseFromHeaders(headers).clearCookie("a", { httpOnly: true, path: "/", sameSite: "none", secure: true, maxAge: 999 });
    const [line] = headers.getSetCookie();
    expect(line).toContain("a=;");
    expect(line).toContain("Expires=Thu, 01 Jan 1970");
    expect(line).not.toContain("Max-Age");
    for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=None"]) expect(line).toContain(attribute);
  });

  it("uses the proxy-appended X-Forwarded-For entry, not a client-supplied one", () => {
    expect(clientIpFromHeaders({ "x-forwarded-for": "6.6.6.6, 10.0.0.9" })).toBe("10.0.0.9");
    expect(clientIpFromHeaders({ "x-real-ip": "10.0.0.1" })).toBe("10.0.0.1");
    expect(clientIpFromHeaders({})).toBeUndefined();
    const req = requestFromFetch(new Request("http://localhost/x/y?z=1", { headers: { cookie: "a=1", "x-forwarded-for": "1.1.1.1" } }));
    expect(req).toMatchObject({ headers: { cookie: "a=1" }, ip: "1.1.1.1", path: "/x/y" });
  });
});

describe("tRPC fetch route handler", () => {
  it("answers queries without a session as signed out", async () => {
    const response = await GET(new Request(url("auth.me")));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { data: { json: null } } });
  });

  it("rejects mutations without a matching CSRF cookie and header", async () => {
    const missing = await POST(mutation());
    expect(missing.status).toBe(403);
    const mismatch = await POST(mutation({ cookie: `${STANZA_CSRF_COOKIE}=${csrf}`, "x-stanza-csrf": "c".repeat(64) }));
    expect(mismatch.status).toBe(403);
  });

  it("logs out with a valid CSRF pair and emits the expected Set-Cookie headers", async () => {
    const response = await POST(mutation({ cookie: `${STANZA_CSRF_COOKIE}=${csrf}`, "x-stanza-csrf": csrf }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { data: { json: { success: true } } } });
    const cookies = response.headers.getSetCookie();
    expect(cookies.map(line => line.split("=")[0])).toEqual([STANZA_SESSION_COOKIE, COOKIE_NAME, STANZA_AUTH_MODE_COOKIE]);
    expect(cookies[0]).toContain("Expires=Thu, 01 Jan 1970");
    expect(cookies[2]).toContain(`${STANZA_AUTH_MODE_COOKIE}=logged_out`);
    for (const line of cookies) for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=None"]) expect(line).toContain(attribute);
  });
});
