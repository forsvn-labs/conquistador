# Fixture: requested product experience

This checks parent routing. It does not establish model quality or executable playbook support.

## Request

"Map the onboarding user flow for this local-first review app, including permissions and empty/error
recovery. Use the accepted UI specification."

## Expected behavior

- Load `map-user-flow` through the parent. Reuse the accepted UI specification.
- Do not add UI design, architecture, implementation, or deployment to this request.
- Load further references only as needed. Return the requested flow and its verification limits.

## Multi-outcome request

"Map the onboarding user flow and specify the product UI, including error recovery."

The parent may compose `map-user-flow` and `brief-product-ui` using `specify-product-experience`.
The composition remains prose. It does not establish that a runner executed a playbook.

## Near miss

"Write launch copy for our tool that helps teams build a web app."

Select the copy outcome. Do not load an engineering outcome or start a build.
