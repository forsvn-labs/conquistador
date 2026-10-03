# House token bindings

Load this file only when the operator explicitly declares `brand_source: house`. It is not a default,
example, fallback, or source of missing customer tokens.

- Bind house background, surface, text, action, state, spacing, type, radius, and motion roles to the
  current house DESIGN source by name.
- Use names from that source in the application map. Do not repeat raw values.
- Preserve house state-cue, material, and typography constraints recorded in the current DESIGN
  source.
- If the DESIGN source is unavailable or a role is absent, mark it unresolved. Do not reconstruct it
  from memory or from an example.
