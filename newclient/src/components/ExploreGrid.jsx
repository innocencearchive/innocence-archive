// src/components/ExploreGrid.jsx
import React from 'react';

// Import the module components (assuming paths are correct)
import StatsModule from './StatsModule';
import FeaturedOrganizationModule from './FeaturedOrganizationModule';
import FeaturedMediaModule from './FeaturedMediaModule';
import ContributingFactorsModule from './ContributingFactorsModule';

// Assuming theme constants are available, otherwise replace with hex codes
// import { BRONZE_COLOR, DARK_BRONZE_COLOR, BRONZE_BORDER } from './themeConstants';
const BRONZE_COLOR = 'text-[#af7a56]'; // Example
const DARK_BRONZE_COLOR = 'text-[#8c6046]'; // Example
const BRONZE_BORDER_COLOR = '#af7a56'; // Example hex code for outline

/**
 * ExploreGrid Component
 * Displays a responsive grid of modules. Height is determined by content.
 */
const ExploreGrid = ({
    featuredMedia = {},
    featuredOrg = null,
    stats = [],
    factors = []
}) => (
  // Outer Section: Removed min-h-screen and flex centering.
  // Added standard padding. Background color remains.
  // Spacing around this section is controlled by the parent (HomePage.jsx).
  <section
    aria-labelledby="explore-title"
    className="w-full px-4 sm:px-6 lg:px-8 bg-black" // REMOVED min-h-screen, flex, items-center, justify-start
  >
    {/* Content Container: Replaces the aspect ratio div. */}
    {/* Now it just provides width constraint, padding, and the outline. */}
    {/* Height will grow based on the content inside. */}
    <div
      className="w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8" // Centered, max-width, padding
      style={{
        outline: `4px solid ${BRONZE_BORDER_COLOR}`, // Apply outline here
        borderRadius: '0.5rem', // Optional: Add rounded corners to match outline
      }}
    >
        {/* Title: Centered */}
        <h2
          id="explore-title"
          className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif ${DARK_BRONZE_COLOR} uppercase mb-6 md:mb-8 lg:mb-10 text-center`} // Adjusted bottom margin
        >
          Explore the Archive
        </h2>

        {/* Grid Container: Uses gap. Height determined by content. */}
        {/* Grid items will stretch vertically if their content requires it. */}
        {/* Added max-width to prevent grid becoming too wide on large screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-8 w-full max-w-5xl mx-auto">
          {/* Module Wrapper Divs: These provide background and padding for each module. */}
          {/* Removed fixed width w-[80%] and mx-auto - let the grid handle sizing. */}
          {/* Added h-full so the background fills the grid cell height if rows become uneven. */}

          {/* Stats Module Wrapper */}
          <div className="bg-gray-800 rounded-lg p-4 md:p-6 flex flex-col h-full">
            <StatsModule stats={stats} />
          </div>

          {/* Featured Organization Module Wrapper */}
          <div className="bg-gray-800 rounded-lg p-4 md:p-6 flex flex-col h-full">
            <FeaturedOrganizationModule org={featuredOrg} />
          </div>

          {/* Featured Media Module Wrapper */}
          <div className="bg-gray-800 rounded-lg p-4 md:p-6 flex flex-col h-full">
            <FeaturedMediaModule media={featuredMedia} />
          </div>

          {/* Contributing Factors Module Wrapper */}
          <div className="bg-gray-800 rounded-lg p-4 md:p-6 flex flex-col h-full">
            <ContributingFactorsModule factors={factors} />
          </div>

        </div>
    </div>
  </section>
);

export default ExploreGrid;
