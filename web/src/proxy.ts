import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_HINT_COOKIE = "gp_has_session";
const ROLE_HINT_COOKIE = "gp_user_role";

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_HINT_COOKIE)?.value === "1";
  const role = request.cookies.get(ROLE_HINT_COOKIE)?.value;

  if (pathname.startsWith("/admin")) {
    if (!hasSession) {
      return redirectTo(request, "/");
    }
    if (role && role !== "admin") {
      return redirectTo(request, "/employee");
    }
  }

  if (pathname.startsWith("/employee") && !hasSession) {
    return redirectTo(request, "/");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/employee/:path*"],
};
