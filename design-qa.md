# Activities workspace design QA

Source visual truth: `C:\Users\INOCENT\.codex\generated_images\01a08f2e-921c-7471-bacf-d45a221b6317\exec-36949b17-45d0-45b6-8347-52d41f54e2b4.png`

Implementation evidence: Codex in-app Browser captures of `http://localhost:3000/dashboard/activities/team` and `http://localhost:3000/dashboard/me/activities/today`, captured inline on 14 September 2026.

Source pixels: 1488 × 1056. Implementation viewports: 1030 × 912 desktop and 390 × 844 responsive. Browser density: 1×. Comparison used the same dashboard content region rather than browser chrome; the responsive pass was judged separately because the source provides only the desktop state.

State reviewed: manager team-work and assign-task states, personal activities empty state, Activities section switcher open, Leave section switcher open, and mobile assignment form.

Latest implementation checks: activity reports resolve names from both camel-case and snake-case employee snapshots; both manager assignment entry points use the same reporting-scope employee endpoint; manager task creation no longer exposes a category field; and My Performance now includes assigned-work totals and status data.

## Full-view comparison evidence

- Information architecture: the source's separate Additional Access rail was intentionally superseded by the user's latest annotation. Personal and team views now share the main module entry and are selected through the top section switcher.
- Layout and spacing: the blue hero, local tabs, filter/task region, cards, borders, radii, and density retain the HRMS visual system. Desktop uses a balanced two-column assignment form; mobile collapses it to one column without horizontal form overflow.
- Fonts and typography: the implementation retains the app's existing family, optical weights, size hierarchy, line heights, and compact uppercase metadata. Labels wrap cleanly at 390 px.
- Colors and tokens: the existing primary blue, muted surfaces, borders, active underlines, semantic priority colors, and status chips are preserved.
- Image and icon quality: the existing HRMS hero artwork and installed icon library are retained. No reference imagery was replaced with placeholder, CSS-drawn, or text-glyph assets.
- Copy and content: labels are short and task-focused. “Checklist (optional)” plus “Add a checklist item” makes the progressive-add interaction clear.

## Focused region comparison evidence

- Checklist creation: the fixed multiline textarea was replaced with one compact input and an Add button. Pressing Enter or Add creates a removable checklist row; no blank checklist height is reserved before an item exists.
- Module switcher: Activities exposes “My activities” and “Team activities”; Leave exposes “My leave” and “Leave management”. The sidebar keeps one active module label and no longer renders Additional Access.
- Accessibility and interaction: the checklist input has an accessible name, the disabled Add state prevents empty items, remove controls name the item being removed, active tabs remain visually distinct, and browser console error inspection returned no errors.
- Runtime routing: after a clean production build and development-server restart, `/dashboard/activities`, `/dashboard/activities/reports`, and `/dashboard/me/performance/overview` returned successfully. The previously missing Webpack chunk at `/_next/static/chunks/app/dashboard/activities/page.js` now returns successfully as well.

## Comparison history

- Initial P2: at the mobile breakpoint, the floating help control partially covered the right-aligned Assign task action.
- Fix: added a safe right inset to the assignment action row.
- Post-fix evidence: the 390 × 844 browser capture shows the Assign task button fully visible and separated from both floating controls.

No actionable P0, P1, or P2 findings remain. The live task list remains empty until the new backend activity endpoints are deployed; that is environment state, not a visual mismatch.

final result: passed

---

# Android employee sign-in design QA

Source visual truth: live web employee sign-in at `http://localhost:3000/login`, captured in the Codex in-app Browser on 16 September 2026. The user-provided 369 × 451 browser-comment screenshot was also used as the before-state evidence.

Implementation evidence: live Expo web rendering at `http://localhost:8081/login`, captured in the Codex in-app Browser on 16 September 2026.

Source pixels and CSS viewport: 731 × 411 at 1× density. Implementation pixels and CSS viewport: 369 × 451 at 1× density. The responsive comparison normalized the central authentication column rather than the full desktop frame because the web reference places the same form inside a wider card at this breakpoint.

State reviewed: signed-out, empty form, light theme and dark theme. Password visibility was tested with temporary non-sensitive text and the field was cleared afterward. Browser console inspection returned no errors.

## Full-view comparison evidence

- Fonts and typography: the Android heading now uses the compact visual weight and scale of the web sign-in rather than the oversized before-state heading. Labels, inputs, and action text follow the same hierarchy without wrapping or truncation.
- Spacing and layout rhythm: both implementations use a centered single-column form with a small brand mark, restrained vertical gaps, 8 px control radii, and one full-width primary action. The former decorative orbs and oversized form card were removed.
- Colors and visual tokens: the implementation uses the shared `#303194` primary, neutral white/light surfaces, dark neutral surfaces, and the same semantic foreground hierarchy as the web portal.
- Image quality and asset fidelity: Android uses the supplied Alliance Insurance logo asset from the repository, displayed with its original aspect ratio and without a recreated or placeholder mark.
- Copy and content: “Welcome back”, Email, Password, Sign in, and the corporate footer match the web experience. OTP-specific copy remains available only in the OTP state.

## Focused region comparison evidence

- Form controls: input heights, 8 px corners, border contrast, password affordance, and button proportions were legible in the 369 px mobile capture.
- Theme control: toggling light/dark mode updated the screen and accessible label correctly, then the preview was restored to light mode.
- Password control: the accessible label changed from “Show password” to “Hide password” and back; no test value remained in the field.

## Findings

No actionable P0, P1, or P2 visual or interaction findings remain for the sign-in state.

## Comparison history

- Initial P2: the first Android pass still used a larger logo and heading than the web sign-in and added a subtitle absent from the reference.
- Fix: reduced the logo and heading scale, removed the normal-state subtitle, and tightened the vertical rhythm.
- Post-fix evidence: the final 369 × 451 capture shows the logo, heading, fields, action, and footer within one balanced mobile composition.

## Follow-up polish

- P3: a future authentication-parity pass can add the web portal’s forgot-password journey as a native route; it is not represented by an existing Android screen today.

final result: passed
