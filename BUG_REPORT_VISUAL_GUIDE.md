# Bug Report Feature - Visual Guide

## User Flow

```
Settings Page
    ↓
Bug Reports Section
    ↓
[Report a Bug] Button
    ↓
Modal Opens (Centered, Dimmed Background)
    ↓
User Fills Form:
  - Category (Dropdown)
  - Severity (Badge Selector)
  - Title (Text Input)
  - Description (Textarea)
    ↓
User Clicks Submit
    ↓
Loading State (Button shows "Submitting...")
    ↓
Success/Error Message
    ↓
Modal Closes (on success after 2s)
    ↓
Report Appears in History
```

## Modal Layout

```
┌─────────────────────────────────────────────────────────┐
│ Submit Bug Report                                    [X] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Category              Severity                         │
│ [Bug ▼]              [🟢 Low] [🟡 Med] [🟠 High] [🔴 Crit] │
│                                                         │
│ Title *                                                 │
│ [Brief description of the issue...................]     │
│ 0 / 200                                                 │
│ ▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                                         │
│ Description *                                           │
│ [Please describe the issue in detail...                │
│  Include steps to reproduce if applicable.             │
│  ................................................]     │
│ 0 / 5000                                                │
│ ▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                                         │
│ ✅ Bug report submitted successfully!                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [Cancel]                    [📤 Submit Report]          │
└─────────────────────────────────────────────────────────┘
```

## Severity Badge Selector

### Inactive State
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   🟢     │ │   🟡     │ │   🟠     │ │   🔴     │
│   Low    │ │ Medium   │ │   High   │ │ Critical │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Active State (Medium Selected)
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   🟢     │ │   🟡     │ │   🟠     │ │   🔴     │
│   Low    │ │ Medium   │ │   High   │ │ Critical │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
              ▲ (filled with color)
```

## Character Counter & Progress Bar

### Title Input
```
Title *
[Brief description of the issue...................]
45 / 200
▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

### Description Textarea
```
Description *
[Please describe the issue in detail...
 Include steps to reproduce if applicable.
 ................................................]
1250 / 5000
▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

## Report History - Card Layout

### Single Report Card
```
┌─────────────────────────────────────────────────────┐
│ Page not loading                    [✅ Resolved]   │
│ 🐛 Bug                                              │
├─────────────────────────────────────────────────────┤
│ The login page fails to load when using Safari      │
│ on iOS devices. Works fine on Chrome.               │
├─────────────────────────────────────────────────────┤
│ [🟠 High]                    May 2, 2026            │
└─────────────────────────────────────────────────────┘
```

### Multiple Reports with Filters
```
Your Report History                    [3 of 5]

Status: [All Statuses ▼]  Severity: [All Severities ▼]  Sort: [Newest First ▼]

┌─────────────────────────────────────────────────────┐
│ Page not loading                    [✅ Resolved]   │
│ 🐛 Bug                                              │
├─────────────────────────────────────────────────────┤
│ The login page fails to load when using Safari...   │
├─────────────────────────────────────────────────────┤
│ [🟠 High]                    May 2, 2026            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Slow feed loading                   [🔍 In Review]  │
│ ⚡ Performance                                       │
├─────────────────────────────────────────────────────┤
│ Feed takes 5+ seconds to load on first visit...     │
├─────────────────────────────────────────────────────┤
│ [🟡 Medium]                  May 1, 2026            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Add dark mode toggle                [⏳ Pending]    │
│ ✨ Feature Request                                  │
├─────────────────────────────────────────────────────┤
│ Would love to have a dark mode option for...        │
├─────────────────────────────────────────────────────┤
│ [🟢 Low]                     Apr 30, 2026           │
└─────────────────────────────────────────────────────┘
```

## Status Badge Colors

| Status | Icon | Color | Hex |
|--------|------|-------|-----|
| Pending | ⏳ | Yellow | #f59e0b |
| In Review | 🔍 | Blue | #3b82f6 |
| Resolved | ✅ | Green | #10b981 |
| Closed | 🔒 | Gray | #6b7280 |

## Severity Badge Colors

| Severity | Icon | Color | Hex |
|----------|------|-------|-----|
| Low | 🟢 | Green | #10b981 |
| Medium | 🟡 | Yellow | #f59e0b |
| High | 🟠 | Orange | #f97316 |
| Critical | 🔴 | Red | #ef4444 |

## Category Icons

| Category | Icon | Label |
|----------|------|-------|
| Bug | 🐛 | Bug |
| UI/UX | 🎨 | UI/UX Issue |
| Performance | ⚡ | Performance |
| Security | 🔒 | Security |
| Feature | ✨ | Feature Request |
| Other | 📋 | Other |

## Mobile Responsive Breakpoints

### Desktop (>600px)
- Modal: 600px max-width
- Filters: 3-column grid
- Cards: Full layout with all info visible

### Tablet (480px - 600px)
- Modal: 90% width
- Filters: 2-column grid
- Cards: Adjusted spacing

### Mobile (<480px)
- Modal: 95% width
- Filters: 1-column stack
- Cards: Simplified layout
- Font sizes: Reduced for readability

## Animation Timings

| Animation | Duration | Easing |
|-----------|----------|--------|
| Modal Entry | 300ms | ease-out |
| Backdrop Fade | 200ms | ease-out |
| Message Slide | 300ms | ease-out |
| Hover Effects | 200ms | ease |
| Progress Bar | 200ms | ease |

## Accessibility Features

### Keyboard Navigation
- `Tab` - Move between form fields
- `Shift+Tab` - Move to previous field
- `Enter` - Submit form (when focused on submit button)
- `Escape` - Close modal
- `Space` - Toggle severity badge selection

### Screen Reader Announcements
- Modal title announced on open
- Form labels associated with inputs
- Error messages announced
- Success messages announced
- Status badges described
- Character counters announced

### Focus Indicators
- Blue outline on focused elements
- Visible focus ring on all interactive elements
- High contrast focus states

## Error States

### Validation Errors
```
Title *
[Brief description of the issue...................]
❌ Title must be at least 5 characters
45 / 200
```

### Network Error
```
❌ Network error: Failed to fetch
```

### Server Error
```
❌ Failed to submit bug report
```

## Success States

### Submission Success
```
✅ Bug report submitted successfully!
```

### Auto-close
Modal closes automatically 2 seconds after success

## Empty States

### No Reports Yet
```
┌─────────────────────────────────────────────────────┐
│                      📋                              │
│                                                     │
│              No Bug Reports Yet                     │
│                                                     │
│  Your submitted bug reports will appear here.       │
│  Help us improve by reporting issues!               │
└─────────────────────────────────────────────────────┘
```

### No Filter Results
```
No reports match your filters. Try adjusting your selection.
```

## Dark Mode Appearance

### Modal in Dark Mode
- Background: Dark gray (#1a1a1a)
- Text: Light gray (#f0f0f0)
- Borders: Subtle gray (#333333)
- Inputs: Dark background with light text
- Buttons: Same color scheme, adjusted for contrast

### Cards in Dark Mode
- Background: Dark gray (#222222)
- Text: Light gray (#e0e0e0)
- Borders: Subtle gray (#333333)
- Badges: Same colors, adjusted opacity

## Interaction Patterns

### Button States
```
Normal:     [📤 Submit Report]
Hover:      [📤 Submit Report] (slightly raised, enhanced shadow)
Active:     [📤 Submit Report] (pressed down)
Disabled:   [📤 Submit Report] (faded, not clickable)
Loading:    [Submitting...]
```

### Input States
```
Normal:     [Input field with border]
Focused:    [Input field with blue border and glow]
Error:      [Input field with red border and glow]
Filled:     [Input field with content]
```

### Badge States
```
Inactive:   [🟢 Low] (transparent, colored border)
Hover:      [🟢 Low] (slightly raised)
Active:     [🟢 Low] (filled with color, white text)
```
