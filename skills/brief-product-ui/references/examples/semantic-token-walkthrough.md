# Worked example — supplied semantic tokens

**Input:** A portable product flow and a customer-supplied list of semantic token names. The target
platform and resolved token values are not supplied.

1. Preserve every supplied name exactly; do not add prefixes, scales, fonts, values, or house names.
2. Map each screen and component role only to a supplied token. If a required role has no supplied
   token, write `[unresolved: <role>]`.
3. Describe layout relationships and hierarchy without raw dimensions.
4. Specify reachable interaction and system states. Bind only supplied state tokens; unresolved state
   roles remain explicit.
5. Keep contrast, target-size, responsive, and native-platform checks unresolved when their inputs are
   absent.
6. Return a portable brief with open decisions and block implementation until the target platform,
   target engine, resolved values, and authorized owner exist.

The successful output contains only the customer names, source-neutral unresolved markers, product
structure, and acceptance criteria. It contains no recovered house value or invented default.
