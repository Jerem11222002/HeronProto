# Event Card GUI Design Improvements

## Current Issues
1. **Image underutilized** - Takes only 20-25% width
2. **Inefficient spacing** - 20px padding with large gaps wastes space
3. **Information scattered** - Details not organized logically
4. **Poor hierarchy** - Key info (date, location, capacity) hidden
5. **Tags waste space** - Hashtags wrap to multiple lines
6. **Buttons hard to reach** - Hidden at bottom

---

## Recommended Redesigns

### Option 1: Image-First Horizontal Layout (Recommended)
```
┌─────────────────────────────────────────────────────┐
│  IMAGE (45%)  │  HEADER (55%)                       │
│               │  • Title (Bold)                     │
│  [Thumbnail]  │  • Date/Time (Icon + Text)          │
│               │  • Seats: 4/20 Participants: 4      │
│               │  • UMAK Siglahi | Dance             │
│               │  • Type: Watch-Only | Free          │
│  Status badge │  • Location: UMAK oval              │
│               │  ┌─────────────┬──────────────┐     │
│               │  │ Join Event  │ ♥ Save Share │     │
│               │  └─────────────┴──────────────┘     │
│               │                                     │
│               │  Short description (1-2 lines)     │
│               │  #folk-dance #traditional-arts     │
└─────────────────────────────────────────────────────┘
```

### Option 2: Full-Width Image + Compact Info
```
┌──────────────────────────────────┐
│       IMAGE (Full Width)         │
│   with overlaid status badge     │
├──────────────────────────────────┤
│ TITLE                            │
│ Date • Location • Type           │
│ Org Badge | Participants 4/20    │
│ [Expand for full description]    │
│ #tags #here                      │
│ [Join] [Save] [Share]            │
└──────────────────────────────────┘
```

---

## Specific CSS Changes

### 1. Restructure Grid Layout
**Current:** Full-width card with horizontal sections
**New:** 2-column grid on desktop
```scss
.event-card {
  display: grid;
  grid-template-columns: 45% 1fr;
  gap: 0;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.event-image {
  height: 280px;
  grid-column: 1;
  grid-row: 1 / 4; // Span 3 rows
}

.event-info {
  grid-column: 2;
  padding: 16px;
}
```

### 2. Compact Information Section
```scss
.event-info {
  padding: 16px; // Reduced from 20px
  display: flex;
  flex-direction: column;
  gap: 12px; // Reduced from 16px
  
  .engagement-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 0; // Remove padding
    border: none; // Remove border
    margin: 0;
    
    .metric {
      padding: 8px;
      background: themed("bgSoft");
      border-radius: 8px;
      justify-content: space-between;
      font-size: 0.85rem;
    }
  }
}
```

### 3. Better Title & Header Hierarchy
```scss
.event-header {
  h2 {
    font-size: 1.3rem; // Slightly larger
    font-weight: 700;
    margin: 0 0 8px 0;
    line-height: 1.3;
    color: themed("textColor");
  }
  
  .meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.9rem;
    color: themed("textColorSoft");
    margin: 4px 0;
    
    svg {
      width: 16px;
      height: 16px;
    }
  }
}
```

### 4. Optimize Tags Display
**Current:** All tags visible, wrapping
**New:** Horizontal scroll or limited display

```scss
.event-tags {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 8px 0;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  .tag {
    white-space: nowrap;
    padding: 4px 10px;
    background: themed("primary");
    color: white;
    border-radius: 12px;
    font-size: 0.75rem;
    flex-shrink: 0;
  }
}
```

### 5. Better Buttons Layout
```scss
.event-actions {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  margin-top: 12px;
  
  .join-btn {
    grid-column: 1;
    padding: 10px 16px;
    font-size: 0.95rem;
  }
  
  .action-btns {
    display: flex;
    gap: 4px;
    
    button {
      padding: 10px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
```

### 6. Compact Type & Ticket Info
```scss
.event-extra-details {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 0.85rem;
  background: themed("bgSoft");
  padding: 8px 12px;
  border-radius: 8px;
  
  .event-type,
  .event-ticketing {
    display: flex;
    gap: 4px;
    
    strong {
      font-weight: 600;
      min-width: 45px;
    }
  }
}
```

---

## Summary of Benefits

| Issue | Solution | Benefit |
|-------|----------|---------|
| Image too small | Increase to 45-50% width | Better visual impact, thumbnail clarity |
| Wasted space | Reduce padding 20px → 16px | More efficient use of space |
| Information scattered | Group: date/location/meta | Improved readability |
| Tags overflow | Horizontal scroll or limit | Cleaner layout |
| Poor hierarchy | Larger title, bold organizing | Better scannability |
| Buttons hard to find | Move to info section | Improved UX |
| Content height | Compact sections | Shorter cards, see more events |

---

## Implementation Priority
1. **HIGH**: Image size increase (45% width)
2. **HIGH**: Padding/gap reduction
3. **HIGH**: Grid layout restructure
4. **MEDIUM**: Tags horizontal scroll
5. **MEDIUM**: Button reorganization
6. **LOW**: Animation tweaks

---

## Responsive Considerations
- **Desktop (1200px+)**: 2-column (image + info)
- **Tablet (768-1200px)**: Consider 2-column or full-width
- **Mobile (<768px)**: Full-width single column (image stacked on top)
