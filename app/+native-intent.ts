// Widget, Live Activity, invite and studio links all open the one ClassStreak screen,
// which reads the original URL through Linking. Only /account is a route of its own
// (the auth redirect), so send every other link to the root instead of "Unmatched Route".
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  let route = path;
  try {
    const url = new URL(path);
    route = url.protocol === "turf:" ? url.hostname + url.pathname : url.pathname;
  } catch {}
  route = route.replace(/^\/+/, "");
  return route === "" || route.startsWith("account") ? path : "/";
}
