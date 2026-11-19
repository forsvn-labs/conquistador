# Conquistador identity

`conquistador-icon.png` is a copy of the approved Summit icon from `conquistador-design/imagery/icons/icon-512.png`. The Codex plugin bundles the same square tile for its composer icon and logo. The root `favicon.png` and the docs favicon use the same artwork.

To refresh the artwork, start from `conquistador-design/scripts/build_icons.ts`. Use the generated files for the plugin and docs, and resize the 1024 px tile to 128 px for `favicon.png`. Copy the SVG tile into both docs logo lockups. Then run `node tools/update-completeness.mjs`.
