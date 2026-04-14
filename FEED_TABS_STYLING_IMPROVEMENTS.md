# Feed Tabs - Improved Styling Guide

## Current Issues Identified

1. **Low Contrast:** `bgSoft` + `textColorSoft` inactive state lacks visual prominence
2. **Large Font:** 20px is oversized for tab buttons
3. **Spacing:** 50px gap is excessive and not mobile-friendly
4. **Visual Indicator:** No clear active state indicator besides color change
5. **Missing Accessibility:** No focus states for keyboard navigation
6. **Container:** No background defined, blends into page

---

## Improved Styling Approach

### Key Improvements

1. **Better Contrast for Inactive State:**
   - Inactive tabs: `bg` background (same as content) with `textColorSoft` text
   - This creates clear separation from the container

2. **Modern Active Indicator:**
   - Bottom border (3-4px) in primary color for active tab
   - Cleaner, more professional look
   - No background color change needed

3. **Adjusted Typography:**
   - Font size: 14-16px (not 20px)
   - Weight: 500 (medium) for inactive, 600 (semi-bold) for active

4. **Responsive Spacing:**
   - Gap: 24-32px (reasonable, scales on mobile)
   - Padding: 12-16px (comfortable click target)

5. **Accessibility:**
   - Focus states with outline
   - Proper hover/active states
   - Semantic ARIA attributes

6. **Container Enhancement:**
   - Background color from theme
   - Subtle border for definition
   - Consistent with other sections

---

## Improved SCSS Code

```scss
.feed-tabs-container {
  background-color: themed("bg");
  border: 1px solid themed("border");
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  
  .feed-tabs {
    display: flex;
    gap: 24px;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: wrap;
    
    @include mobile {
      gap: 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding: 0 4px;
      justify-content: flex-start;
    }
    
    .tab-button {
      padding: 12px 16px;
      border: none;
      border-bottom: 3px solid transparent;
      background-color: transparent;
      color: themed("textColorSoft");
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.25s ease;
      white-space: nowrap;
      position: relative;
      user-select: none;
      
      // Hover state: slight background + text color shift
      &:hover {
        color: themed("textColor");
        background-color: themed("bgSoft");
        border-bottom-color: themed("primary");
      }
      
      // Active state: bottom border indicator
      &.active {
        color: themed("textColor");
        font-weight: 600;
        border-bottom-color: themed("primary");
        background-color: themed("bgSoft");
      }
      
      // Focus state: accessibility
      &:focus-visible {
        outline: 2px solid themed("primary");
        outline-offset: 4px;
        border-radius: 4px;
      }
      
      // Mobile optimization
      @include mobile {
        padding: 10px 14px;
        font-size: 14px;
      }
    }
  }
}
```

---

## Color Palette Reference

### Light Theme
- **Inactive:** `bg` background, `textColorSoft` text
- **Hover:** `bgSoft` background, `textColor` text, `primary` bottom border
- **Active:** `bgSoft` background, `textColor` text, `primary` bottom border (3px)

### Dark Theme
- **Inactive:** Dark `bg`, lighter but muted text
- **Hover:** Slightly lighter `bgSoft`, brighter text, primary accent
- **Active:** Same as hover with heavier weight

---

## Visual Hierarchy

```
[Inactive Tab]     [Hover Tab]        [Active Tab]
├─ bgSoft bg       ├─ bgSoft bg       ├─ bgSoft bg
├─ textColorSoft   ├─ textColor       ├─ textColor (600wt)
├─ No border       ├─ Primary border  ├─ Primary border (active)
└─ 500wt           └─ 500wt           └─ 600wt (bolder)
```

---

## Alternative: Underline Style (Even More Modern)

If you prefer an underline-only approach without background changes:

```scss
.tab-button {
  padding: 12px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  background-color: transparent;
  color: themed("textColorSoft");
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  
  &:hover {
    color: themed("textColor");
    border-bottom-color: themed("primary");
  }
  
  &.active {
    color: themed("primary");
    font-weight: 600;
    border-bottom-color: themed("primary");
  }
  
  &:focus-visible {
    outline: 2px solid themed("primary");
    outline-offset: 4px;
  }
}
```

---

## Contrast Ratio Verification

Ensure your theme colors meet WCAG AA standards:

| State | Background | Text | Ratio Goal |
|-------|-----------|------|-----------|
| Inactive | `bg` | `textColorSoft` | 4.5:1 (AA minimum) |
| Active | `bg`/`bgSoft` | `textColor` | 7:1 (AAA ideal) |
| Hover | `bgSoft` | `textColor` | 7:1 (AAA ideal) |

---

## Animation Improvements

```scss
// Smooth transition for all state changes
transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

// Optional: Add ripple effect on click (modern UX)
&:active {
  transform: scale(0.98);
}
```

---

## Responsive Considerations

| Breakpoint | Font Size | Padding | Gap |
|-----------|-----------|---------|-----|
| Desktop   | 15px      | 12×16px | 24px |
| Tablet    | 14px      | 11×15px | 18px |
| Mobile    | 14px      | 10×14px | 12px |

---

## Accessibility Checklist

- ✅ Focus-visible state for keyboard users
- ✅ Outline offset prevents overlap
- ✅ Border-bottom indicator aids color-blind users
- ✅ Sufficient padding (44px minimum recommended)
- ✅ Font size 14-15px readable
- ✅ Color contrast meets WCAG AA
- ✅ ARIA labels on buttons (in JSX)

---

## Comparison: Before vs After

### Before
- Font: 20px (oversized)
- Gap: 50px (excessive)
- Contrast: Low (bgSoft + textColorSoft)
- Active indicator: Background fill only
- No focus state
- Container: No background definition

### After
- Font: 15px (readable, proportional)
- Gap: 24px (balanced, responsive)
- Contrast: High (bg + textColorSoft)
- Active indicator: Bottom border + subtle background
- Focus state: Outline for keyboard nav
- Container: Themed with border
- Modern, clean aesthetic
