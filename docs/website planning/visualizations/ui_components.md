# UI Components for Wrongfully Convicted Americans Website

## Overview
This document outlines the key UI components that will be used throughout the website. These components are designed to create a consistent user experience while highlighting the stories of wrongfully convicted individuals.

## Core Components

### 1. Story Card
Used for displaying individual exoneree stories in list views and carousels.

**Elements:**
- Name (First and Last)
- Location (State, County)
- Years served
- Crime type
- Small indicator icons for contributing factors
- Media coverage indicator (has coverage/no coverage)
- Brief case summary (truncated)
- "Read More" link

**Variations:**
- Standard Card (for browse pages)
- Featured Card (for homepage, with larger image)
- Compact Card (for "Similar Cases" sections)

### 2. Search and Filter Panel
Used for finding specific cases or narrowing down results.

**Search Options:**
- Name search
- Location search (state, county)
- Year range (conviction, exoneration)
- Full-text search

**Filter Categories:**
- Demographics (race, sex, age at crime)
- Crime type
- Contributing factors to wrongful conviction
- Sentence type
- Media coverage status
- Years served (ranges)

**UI Elements:**
- Collapsible filter sections
- Checkboxes for multiple selection
- Range sliders for numeric values
- "Clear All" and "Apply Filters" buttons
- Filter tag display (showing active filters)

### 3. Interactive Map
Geographic visualization of cases.

**Features:**
- Heat map showing concentration of cases
- Clickable states/counties
- Zoom functionality
- Filtering capability
- Pop-up information on hover/click
- Legend explaining color coding

**Variations:**
- Full-page map (for Explore Data section)
- Embedded map (for Story Detail pages)
- Homepage overview map

### 4. Case Timeline
Visual representation of key dates in a case.

**Elements:**
- Crime date
- Arrest date (if available)
- Conviction date
- Exoneration date
- Other significant events
- Time indicators showing length between events

### 5. Contributing Factors Visualization
Visual representation of factors that led to wrongful conviction.

**Elements:**
- Icon-based indicators for each factor
- Tooltip explanations
- Grouping by category
- Highlighting of primary factors

### 6. Data Visualization Components
For the Explore Data section.

**Chart Types:**
- Bar charts (for comparing quantities)
- Pie/donut charts (for proportions)
- Line charts (for trends over time)
- Stacked bar charts (for comparing proportions across categories)
- Scatter plots (for correlation analysis)

**Features:**
- Interactive tooltips
- Legend
- Axis labels
- Download/export options
- Filter controls

### 7. Navigation Components

**Main Navigation:**
- Horizontal menu for desktop
- Hamburger menu for mobile
- Active state indicators
- Dropdown for secondary navigation items

**In-Page Navigation:**
- Anchor links for long pages
- "Back to top" button
- Breadcrumb navigation for deep pages

### 8. Media Reference Display
For showing related media about a case.

**Elements:**
- Media type icon (podcast, article, book, video)
- Title
- Source
- Date
- Brief description
- Link to source
- "No media coverage" indicator when applicable

### 9. Pagination and Results Control
For browsing through multiple pages of results.

**Elements:**
- Page numbers
- Previous/Next buttons
- Items per page selector
- Results count indicator
- Sort options dropdown

### 10. Call-to-Action Components
For encouraging user engagement.

**Types:**
- "Discover Untold Stories" button
- "Explore Your Area" geographic prompt
- "Share This Story" social media buttons
- Journalist contact information

## Design System

### Color Palette
- Primary: Deep blue (#1a365d) - Conveys trust and authority
- Secondary: Teal (#2c7a7b) - Provides contrast and highlights important elements
- Accent: Gold (#d69e2e) - Used sparingly for calls to action
- Background: Light gray (#f7fafc) - Creates a clean, readable environment
- Text: Dark gray (#2d3748) - Ensures readability
- Alert colors:
  - Red (#e53e3e) - For errors or critical information
  - Green (#38a169) - For success messages
  - Yellow (#d69e2e) - For warnings or important notes

### Typography
- Headings: Serif font (e.g., Merriweather) - Adds gravitas to the subject matter
- Body: Sans-serif font (e.g., Open Sans) - Ensures readability
- Data visualization: Sans-serif font (e.g., Roboto) - Clean and legible at small sizes

### Iconography
- Contributing factors icons (unique icon for each factor)
- Navigation icons
- Action icons (search, filter, download, etc.)
- Social media sharing icons

### Responsive Behavior
- Desktop (1200px+): Full layout with side-by-side elements
- Tablet (768px-1199px): Adjusted layout with some stacked elements
- Mobile (320px-767px): Fully stacked layout with simplified navigation

## Accessibility Considerations
- High contrast between text and background
- Alternative text for all images and icons
- Keyboard navigable interface
- Screen reader compatible components
- Focus indicators for keyboard users
- Sufficient text size and line spacing
- ARIA labels for interactive elements

## Interactive States
- Hover states for all clickable elements
- Active/selected states for navigation and filters
- Focus states for form elements
- Loading states for data retrieval operations
- Empty states for search results with no matches

## Animation and Transitions
- Subtle transitions between pages
- Smooth animations for expanding/collapsing elements
- Loading animations for data visualizations
- Micro-interactions for user feedback

This component library will ensure consistency across the website while providing flexibility for different content types and user needs.
