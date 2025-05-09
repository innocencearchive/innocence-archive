# Website Wireframes for Wrongfully Convicted Americans Database

## Overview
This document outlines the structure and layout of the Wrongfully Convicted Americans website. The design prioritizes personal stories while enabling data analysis and pattern identification.

## Site Map
```
Home
├── Browse Stories
│   ├── Story Detail Page
│   └── Advanced Search/Filter
├── Explore Data
│   ├── Geographic Patterns
│   ├── Contributing Factors Analysis
│   └── Timeline View
├── Untold Stories
│   └── Highlighted Cases Needing Attention
├── About
│   ├── Project Information
│   ├── Methodology
│   └── Resources
└── Contact
```

## Page Descriptions

### 1. Home Page
The landing page that introduces the project and provides entry points to the main sections.

**Key Elements:**
- Hero section with impactful statistics and call to action
- Featured stories carousel (rotating selection of compelling cases)
- "Untold Stories" section highlighting cases with little media coverage
- Quick search functionality
- Geographic heat map showing concentration of cases
- Latest additions to the database

**Wireframe:**
```
+-----------------------------------------------+
|  HEADER / NAVIGATION                          |
+-----------------------------------------------+
|                                               |
|  HERO SECTION                                 |
|  Impactful statistic + Search bar             |
|                                               |
+-----------------------------------------------+
|                                               |
|  FEATURED STORIES                             |
|  +--------+  +--------+  +--------+          |
|  | Story 1 |  | Story 2 |  | Story 3 |        |
|  +--------+  +--------+  +--------+          |
|                                               |
+-----------------------------------------------+
|                                               |
|  GEOGRAPHIC HEAT MAP                          |
|                                               |
|                                               |
+-----------------------------------------------+
|                                               |
|  UNTOLD STORIES                               |
|  +--------+  +--------+  +--------+          |
|  | Case 1  |  | Case 2  |  | Case 3  |        |
|  +--------+  +--------+  +--------+          |
|                                               |
+-----------------------------------------------+
|  FOOTER                                       |
+-----------------------------------------------+
```

### 2. Browse Stories Page
A searchable, filterable list of all exonerees in the database.

**Key Elements:**
- Advanced search and filter options (by name, location, crime type, contributing factors, etc.)
- Sort options (by exoneration date, time served, etc.)
- List view with key information for each case
- Visual indicators for cases with/without media coverage
- Pagination or infinite scroll

**Wireframe:**
```
+-----------------------------------------------+
|  HEADER / NAVIGATION                          |
+-----------------------------------------------+
|                                               |
|  SEARCH & FILTER PANEL                        |
|  +-------------------+  +-----------------+   |
|  | Search            |  | Filter Options  |   |
|  +-------------------+  +-----------------+   |
|                                               |
+-----------------------------------------------+
|                                               |
|  RESULTS (LIST VIEW)                          |
|  +-------------------------------------------+|
|  | Case 1                                    ||
|  | Name, Location, Crime, Years served       ||
|  | Tags, Media coverage indicator            ||
|  +-------------------------------------------+|
|                                               |
|  +-------------------------------------------+|
|  | Case 2                                    ||
|  | Name, Location, Crime, Years served       ||
|  | Tags, Media coverage indicator            ||
|  +-------------------------------------------+|
|                                               |
|  +-------------------------------------------+|
|  | Case 3                                    ||
|  | Name, Location, Crime, Years served       ||
|  | Tags, Media coverage indicator            ||
|  +-------------------------------------------+|
|                                               |
+-----------------------------------------------+
|  PAGINATION                                   |
+-----------------------------------------------+
|  FOOTER                                       |
+-----------------------------------------------+
```

### 3. Story Detail Page
Detailed information about a specific exoneree.

**Key Elements:**
- Personal information (name, age, demographics)
- Case details (crime, conviction date, exoneration date, years served)
- Contributing factors to wrongful conviction (visual indicators)
- Media references (podcasts, articles, books) if available
- "No media coverage" indicator if applicable
- Similar cases section
- Location on map
- Timeline of events

**Wireframe:**
```
+-----------------------------------------------+
|  HEADER / NAVIGATION                          |
+-----------------------------------------------+
|                                               |
|  PERSON OVERVIEW                              |
|  +----------+  +-------------------------+    |
|  |          |  | Name                    |    |
|  |  Photo   |  | Demographics            |    |
|  | (if avail)|  | Years served: XX       |    |
|  |          |  | Location: State, County |    |
|  +----------+  +-------------------------+    |
|                                               |
+-----------------------------------------------+
|                                               |
|  CASE DETAILS                                 |
|  Crime: Type                                  |
|  Convicted: Year                              |
|  Exonerated: Year                             |
|  Sentence: Details                            |
|                                               |
+-----------------------------------------------+
|                                               |
|  CONTRIBUTING FACTORS                         |
|  [DNA] [False Confession] [Witness Misid]     |
|  [Official Misconduct] [Inadequate Defense]   |
|                                               |
+-----------------------------------------------+
|                                               |
|  MEDIA COVERAGE                               |
|  [ ] Podcast episodes                         |
|  [ ] News articles                            |
|  [ ] Books                                    |
|  OR                                           |
|  [NO MEDIA COVERAGE INDICATOR]                |
|                                               |
+-----------------------------------------------+
|                                               |
|  SIMILAR CASES                                |
|  +--------+  +--------+  +--------+          |
|  | Case 1  |  | Case 2  |  | Case 3  |        |
|  +--------+  +--------+  +--------+          |
|                                               |
+-----------------------------------------------+
|  FOOTER                                       |
+-----------------------------------------------+
```

### 4. Explore Data Page
Tools for analyzing patterns and trends in the data.

**Key Elements:**
- Interactive map showing geographic distribution
- Charts showing contributing factors
- Timeline of exonerations
- Demographic breakdowns
- Crime type analysis
- Time served statistics
- Export data options for journalists/researchers

**Wireframe:**
```
+-----------------------------------------------+
|  HEADER / NAVIGATION                          |
+-----------------------------------------------+
|                                               |
|  DATA EXPLORATION TOOLS                       |
|  +-------------------+  +-----------------+   |
|  | View Selection    |  | Filter Options  |   |
|  +-------------------+  +-----------------+   |
|                                               |
+-----------------------------------------------+
|                                               |
|  INTERACTIVE VISUALIZATION                    |
|  (Map, Chart, Timeline based on selection)    |
|                                               |
|                                               |
|                                               |
|                                               |
+-----------------------------------------------+
|                                               |
|  KEY INSIGHTS                                 |
|  +-------------------------------------------+|
|  | Insight 1                                 ||
|  +-------------------------------------------+|
|                                               |
|  +-------------------------------------------+|
|  | Insight 2                                 ||
|  +-------------------------------------------+|
|                                               |
|  +-------------------------------------------+|
|  | Insight 3                                 ||
|  +-------------------------------------------+|
|                                               |
+-----------------------------------------------+
|  EXPORT OPTIONS                               |
+-----------------------------------------------+
|  FOOTER                                       |
+-----------------------------------------------+
```

### 5. Untold Stories Page
Highlighting cases that have received little to no media attention.

**Key Elements:**
- Explanation of criteria for "untold" classification
- Filterable list of cases with no media coverage
- Sorting options (by location, crime type, etc.)
- Call to action for journalists/researchers

**Wireframe:**
```
+-----------------------------------------------+
|  HEADER / NAVIGATION                          |
+-----------------------------------------------+
|                                               |
|  UNTOLD STORIES INTRODUCTION                  |
|  Explanation and call to action               |
|                                               |
+-----------------------------------------------+
|                                               |
|  FILTER OPTIONS                               |
|  +-------------------+  +-----------------+   |
|  | Sort by           |  | Filter by       |   |
|  +-------------------+  +-----------------+   |
|                                               |
+-----------------------------------------------+
|                                               |
|  UNTOLD STORIES LIST                          |
|  +-------------------------------------------+|
|  | Case 1                                    ||
|  | Brief details + why this story matters    ||
|  +-------------------------------------------+|
|                                               |
|  +-------------------------------------------+|
|  | Case 2                                    ||
|  | Brief details + why this story matters    ||
|  +-------------------------------------------+|
|                                               |
|  +-------------------------------------------+|
|  | Case 3                                    ||
|  | Brief details + why this story matters    ||
|  +-------------------------------------------+|
|                                               |
+-----------------------------------------------+
|  CONTACT FOR JOURNALISTS                      |
+-----------------------------------------------+
|  FOOTER                                       |
+-----------------------------------------------+
```

## Navigation Components

### Header Navigation
- Logo/Home
- Browse Stories
- Explore Data
- Untold Stories
- About
- Contact
- Search Icon

### Footer
- About the Project
- Methodology
- Data Sources
- Privacy Policy
- Contact Information
- Social Media Links

## Mobile Considerations
- Responsive design for all pages
- Simplified navigation menu (hamburger)
- Touch-friendly filters and controls
- Optimized visualizations for smaller screens

## User Interaction Flows

### 1. Discovering Individual Stories
```
Home Page → Browse Stories → Apply Filters → Story Detail Page
```

### 2. Finding Untold Stories
```
Home Page → Untold Stories → Filter by Location/Type → Story Detail Page
```

### 3. Analyzing Patterns
```
Home Page → Explore Data → Select Visualization → Apply Filters → Export Data (optional)
```

### 4. Geographic Exploration
```
Home Page → Interactive Map → Click on Hotspot → List of Cases in Area → Story Detail Page
```

## Design Priorities
1. Emphasize human stories over raw data
2. Make it easy to discover cases that haven't received attention
3. Enable pattern identification and analysis
4. Create intuitive navigation for both general public and journalists
5. Ensure mobile-friendly experience
