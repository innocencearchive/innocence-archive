// src/components/FactorHeader.jsx
import React from 'react';

/**
 * FactorHeader Component
 *
 * Displays the name of a contributing factor.
 * Simplified version based on OrganizationHeader.
 *
 * @param {object} props - Component props.
 * @param {string} props.name - The name of the contributing factor.
 */
const FactorHeader = ({ name }) => (
  // Outer container with bottom border and padding, centered text
  <div className="mb-6 border-b border-gray-700 pb-6 text-center">
    {/* Display the factor name as a large heading */}
    <h1 className="text-3xl md:text-4xl font-bold text-gray-50 mb-2">{name}</h1>
    {/* Removed type and location sections from OrganizationHeader */}
  </div>
);

export default FactorHeader;
