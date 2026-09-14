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
