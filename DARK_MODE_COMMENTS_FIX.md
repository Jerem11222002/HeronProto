# Dark Mode Fix for Comments Component

## Problem
The dark mode theme was not working on the comments component. The component was using CSS variables that didn't have proper fallbacks and the CSS variables weren't being set correctly in the root stylesheet.

## Root Causes
1. **Incorrect CSS variable naming**: The comments.scss was using variables like `var(--text)`, `var(--card-border)`, `var(--muted-bg)`, etc., which didn't match the actual theme variable names defined in style.scss
2. **CSS variable scope issue**: In style.scss, the variables were being set inside `:root { .theme-light { ... } }` which created improper nesting
3. **Missing fallbacks**: CSS variables didn't have proper fallback values for when the theme class wasn't applied

## Solution Applied

### 1. Fixed style.scss
Changed from:
```scss
:root {
  @each $theme-name, $theme in $themes {
    .theme-#{$theme-name} {
      @each $key, $value in $theme {
        --#{$key}: #{$value};
      }
    }
  }
}
```

To:
```scss
@each $theme-name, $theme in $themes {
  .theme-#{$theme-name} {
    @each $key, $value in $theme {
      --#{$key}: #{$value};
    }
  }
}
```

This ensures the theme class properly applies the CSS variables.

### 2. Updated comments.scss
Updated all CSS variable references to use the correct variable names and added fallbacks:

#### Variable Mapping
- `var(--text)` → `var(--textColor, #000)`
- `var(--muted-text)` → `var(--textColorMuted, #444)`
- `var(--card-border)` → `var(--border, #e0e0e0)`
- `var(--ui-bg)` → `var(--cardBg, #ffffff)`
- `var(--muted-bg)` → `var(--bgSoft, #f6f3f3)`
- `var(--accent)` → `var(--primary, #5271ff)`
- `var(--radius)` → `8px` (explicit value)
- `var(--gap)` → `0.75rem` (explicit value)

#### Dark Mode Support
Each CSS variable now includes a light mode fallback:
```scss
color: var(--textColor, #000);  // Falls back to black if variable not set
background: var(--bgSoft, #f6f3f3);  // Falls back to light gray if variable not set
```

## How It Works
1. When the app starts, `DarkModeContextProvider` reads the user's theme preference
2. The theme is applied by adding `class="theme-dark"` or `class="theme-light"` to the Layout component
3. The CSS variables in style.scss are applied based on the theme class
4. The comments component automatically uses the correct colors via CSS variables with fallbacks

## Testing
To verify dark mode is working:
1. Toggle dark mode in settings
2. Check that the comments section changes colors appropriately
3. Verify text is readable in both light and dark modes
4. Test on mobile and desktop screens

## Files Modified
- `src/style.scss` - Fixed CSS variable scope
- `src/components/comments/comments.scss` - Updated variable references with proper fallbacks
