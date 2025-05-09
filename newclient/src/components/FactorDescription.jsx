// src/components/FactorDescription.jsx
import React from 'react';

/**
 * FactorDescription Component
 *
 * Displays the description text for a contributing factor.
 * Styled similarly to WorkSummary.
 *
 * @param {object} props - Component props.
 * @param {string} props.description - The description text of the contributing factor.
 */
const FactorDescription = ({ description }) => (
  // Section container with styling matching WorkSummary
  <section aria-label="Description" className="py-6 px-4 md:px-8 bg-gray-800 rounded-lg mb-8">
    {/* Heading for the description section */}
    <h2 className="text-xl font-semibold text-gray-100 mb-2">Description</h2>
    {/* Paragraph to display the description text */}
    <p className="text-gray-300 leading-relaxed">{description}</p>
  </section>
);

export default FactorDescription;
