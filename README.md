# Empire of Clouds — World Anchor Test 01

An isolated 6DoF AR tracking test with the 8th Wall Distributed Engine Binary and Three.js. It deliberately renders **one** glyph, not the full glyph matrix. Its purpose is to verify real world tracking.

## Deployment

Upload **all four runtime files** (`index.html`, `app.js`, `style.css`, `netlify.toml`) to a NEW GitHub repository and import that repository into Netlify. No build command; publish directory `.`. Keep the old camera-overlay site unchanged until this test succeeds.

Mobile test: open HTTPS URL directly in Safari on iPhone or Chrome on Android; allow camera; scan the room; wait for `TRACKING NORMAL`; press **PLACE GLYPH IN SPACE**; walk sideways. The glyph is created in world coordinates and **not** parented to the camera. If tracking is lost, it may drift or jump.

## Dependencies and caveats

The page loads `three@0.146.0` and `@8thwall/engine-binary@1` via jsDelivr. These external assets may be blocked by some networks, notably in China. For a reliable exhibition install, vendor the packages and serve them from Netlify. The SLAM module is distributed under a binary-only license: review https://8thwall.org/docs/engine/license and required attribution before publication. The project has not been hardware-tested; interoperability with the chosen Three.js build needs testing on actual phones.

This is a temporary verification tool, not a stable spatial anchor persisted between browser sessions, not a surface-aware anchor, and not persistent VPS mapping. The placement is relative to the camera pose estimated in the current tracking session.
