import React from 'react';

/**
 * Displays the summary section for a Media Work.
 * Expects props:
 * - summary: The summary text (string). The parent component should provide this,
 * mapping from the schema's 'summaryNotes' field and handling fallbacks.
 */
const WorkSummary = ({ summary }) => (
  <section aria-label="Summary" className="py-6 px-4 md:px-8 bg-gray-800 rounded-lg mb-8">
    <h2 className="text-xl font-semibold text-gray-100 mb-2">Summary</h2>
    {/* Display the summary text passed via props */}
    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{summary}</p> {/* Added whitespace-pre-wrap */}
  </section>
);

export default WorkSummary;
