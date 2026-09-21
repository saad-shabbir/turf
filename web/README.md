# Invite landing

Serve this directory as a static site. `vercel.json` routes `/j/<code>` to the landing page; hosts without rewrites can use `index.html?code=<code>`. No accounts, analytics or secrets are involved. A valid code is copied and can open `turf://j/<code>` on an installed phone.

`classstreak.app` is the design's domain, not a claimed deployed domain. Set `EXPO_PUBLIC_INVITE_BASE_URL` to the actual hosted origin before distributing live links. QR and typed codes work without the website. The landing truthfully explains private installation while no App Store/TestFlight listing exists. Associated-domain entitlements are not added to the free SideStore build.
