// src/components/FeaturedStory.jsx
// Assuming 'react-router-dom', and theme constants are correctly imported
import React from 'react';
import { Link } from 'react-router-dom';
// Make sure these imports point to your actual files/definitions
import { BRONZE_COLOR, DARK_BRONZE_COLOR, BRONZE_BORDER } from './themeconstants'; // Or '../components/themeconstants'

const FeaturedStory = ({ story }) => {

  // Prepare display data using provided story object or fallbacks
  const displayName = (story?.firstName && story?.lastName)
                      ? `${story.firstName} ${story.lastName}`
                      : (story?.name || 'Featured Case'); // Fallback name
  const displaySummary = story?.narrativeSummary ?? 'No summary available for this case.'; // Fallback summary
  const storyId = story?.id; // Get ID if story exists

  return (
    <section
      aria-labelledby="featured-story-title"
      // Outer Section: Removed min-h-screen, kept padding and background
      // The parent container in HomePage.jsx will now control the spacing around this section
      className="w-full flex items-center justify-start px-4 sm:px-6 lg:px-8 bg-black" // REMOVED min-h-screen
    >
      {/* Aspect Ratio Container: Enforces 19:9 ratio, full width, bronze outline */}
      {/* This container now dictates the height based on its aspect ratio and width */}
      <div style={{
          aspectRatio: '21 / 9', // Kept aspect ratio
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          outline: `4px solid #af7a56`, // Use your actual bronze color hex code if different
        }}
      >
          {/* Inner Content Container: Holds the actual text/links */}
          <div className="text-center p-4 sm:p-6 md:p-8 w-full h-full flex flex-col justify-center"> {/* Ensure it fills the frame and centers content */}
              {/* Conditional rendering based on story existence */}
              {!story ? (
                  // Display placeholder if no story is available
                  <>
                      <h2 id="featured-story-title" className={`text-3xl sm:text-4xl font-serif uppercase ${DARK_BRONZE_COLOR} mb-6 md:mb-8`}>
                        Featured Story
                      </h2>
                      <p className="text-lg text-gray-400">No featured story available at the moment.</p>
                  </>
              ) : (
                  // Display actual story content
                  <>
                      <h2
                        id="featured-story-title"
                        className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif uppercase ${DARK_BRONZE_COLOR} mb-3 md:mb-4`}
                      >
                        Featured Story
                      </h2>
                      <h3 className={`text-lg sm:text-xl md:text-2xl font-bold ${BRONZE_COLOR} mb-2 md:mb-3`}>{displayName}</h3>
                      {/* Limiting summary lines */}
                      <p className="text-gray-300 text-sm sm:text-base md:text-lg mb-4 md:mb-6 line-clamp-3 md:line-clamp-4 lg:line-clamp-5 overflow-hidden">{displaySummary}</p>
                      {/* Link to profile */}
                      {storyId && ( // Only show link if storyId exists
                        <Link
                          to={`/profile/${storyId}`}
                          className={`inline-block px-4 py-2 sm:px-5 sm:py-2.5 border-2 ${BRONZE_BORDER} ${BRONZE_COLOR} rounded hover:bg-[#af7a56] hover:text-black transition duration-150 ease-in-out text-sm sm:text-base`}
                        >
                          Read Full Profile
                        </Link>
                      )}
                  </>
              )}
          </div>
      </div>
    </section>
  );
};

export default FeaturedStory;
