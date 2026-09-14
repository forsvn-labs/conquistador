# Fixture: direct-only product experience

This is a parent-route boundary fixture, not a fourth Conquistador job. The six engineering outcomes
stay independently installable. The parent must not compose them from an ordinary request.

## Request

“Map the onboarding for this local-first review app, including permissions, empty/error recovery, and
the handoff a developer needs to build it.”

## Expected behavior

- Treat the request as explicit engineering demand, not a default marketing/growth job.
- Do not load `map-user-flow`, `brief-product-ui`, `specify-product-experience`, or the other
  engineering outcomes through ordinary parent routing.
- Keep the parent contract visible: those outcomes are direct-install only and outside the v1
  usefulness claim.
- A host may invoke `map-user-flow` or `brief-product-ui` directly only when the user explicitly asks
  for that engineering outcome.
