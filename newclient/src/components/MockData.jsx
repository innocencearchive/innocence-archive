import React from 'react';

// --- Mock Data (For Simulation) ---
// Represents data you might fetch from your API based on the work's ID
export const mockMediaDatabase = {
  "book-123": {
    id: "book-123",
    type: "Book", // Type identifier
    title: "Guilty Until Proven Innocent: The [Fictional] Story",
    creator: "Jane Author", // Author for books
    publicationYear: 2021,
    publisher: "Justice Press",
    summary: "A deep dive into the wrongful conviction of John Smith, exploring the flawed investigation and the fight for exoneration. This book covers the case from start to finish.",
    // Books don't typically have 'items' in this context
    items: [],
    relatedIndividuals: [{ id: "john-smith", name: "John Smith" }],
    relatedFactors: [{ id: "factor-1", name: "Eyewitness Misidentification" }]
  },
  "podcast-series-456": {
    id: "podcast-series-456",
    type: "Podcast Series", // Type identifier
    title: "Injustice Uncovered",
    creator: "Podcast Network X", // Network or primary host
    publicationYear: "2022-Present", // Can be a range
    summary: "A podcast series dedicated to investigating potential wrongful convictions across the United States. Each season focuses on a different region or type of case.",
    // Podcast Series have items (episodes)
    items: [
      { id: "ep-001", title: "Episode 1: The Case of Alice Brown", date: "2022-10-01", itemType: "Podcast Episode" },
      { id: "ep-002", title: "Episode 2: Faulty Forensics", date: "2022-10-08", itemType: "Podcast Episode" },
      { id: "ep-003", title: "Episode 3: Coerced Confessions", date: "2022-10-15", itemType: "Podcast Episode" },
    ],
    relatedIndividuals: [], // Maybe aggregate individuals from episodes later
    relatedFactors: [{ id: "factor-2", name: "False Confession" }, { id: "factor-3", name: "Faulty Forensics" }]
  },
  "film-789": {
    id: "film-789",
    type: "Film", // Type identifier
    title: "The Thin Line",
    creator: "Director Name", // Director for films
    publicationYear: 2020,
    studio: "Indie Films Co.",
    runtime: "115 min",
    summary: "A documentary film following the appeals process for Richard Roe, highlighting the challenges faced by those claiming innocence.",
    items: [], // Films generally don't have 'items' in this way
    relatedIndividuals: [{ id: "richard-roe", name: "Richard Roe" }],
    relatedFactors: [{ id: "factor-4", name: "Official Misconduct" }]
  }
  // Add more mock works as needed
};

export const mockItemDatabase = {
  "ep-001": {
    id: "ep-001",
    type: "Podcast Episode",
    title: "Episode 1: The Case of Alice Brown",
    parentWork: { // Link back to the container/work
      id: "podcast-series-456",
      title: "Injustice Uncovered",
      type: "Podcast Series"
    },
    date: "2022-10-01",
    episodeNumber: 1,
    guests: ["Investigative Journalist A", "Legal Expert B"],
    summary: "This inaugural episode examines the conviction of Alice Brown, focusing on the questionable eyewitness testimony and lack of physical evidence presented at trial. Features interviews with legal experts.",
    externalLink: "#", // Link to actual podcast episode audio/page
    transcriptLink: "#transcript-ep-001", // Link to transcript if available
    relatedIndividuals: [{ id: "alice-brown", name: "Alice Brown" }], // Fictional individual
    relatedFactors: [{ id: "factor-1", name: "Eyewitness Misidentification" }]
  },
  "article-abc": {
    id: "article-abc",
    type: "Newspaper Article",
    title: "Justice System Fails Richard Roe, Advocates Say",
     parentWork: { // Link back to the container/work (e.g., Newspaper)
      id: "newspaper-xyz",
      title: "The Metro Times", // Example newspaper name
      type: "Newspaper"
    },
    date: "2023-05-15",
    author: "Reporter C",
    summary: "A detailed article outlining the perceived flaws in the original investigation and trial of Richard Roe, quoting legal advocates who are pushing for a case review.",
    externalLink: "#", // Link to actual article online
    transcriptLink: null, // N/A for articles generally
    relatedIndividuals: [{ id: "richard-roe", name: "Richard Roe" }],
    relatedFactors: [{ id: "factor-4", name: "Official Misconduct" }, { id: "factor-2", name: "False Confession" }] // Example
  }
  // Add more mock items as needed
};

// --- Mock Data (For Simulation) ---
// Represents data you might fetch for a specific organization ID
export const mockOrgDatabase = {
  "org-123": {
    id: "org-123",
    name: "Michigan Innocence Clinic",
    type: "University Legal Clinic", // e.g., Legal Aid, Policy Reform, Post-Exoneration
    location: "Ann Arbor, MI",
    website: "https://www.law.umich.edu/clinical/innocenceclinic/Pages/default.aspx", // Example real link
    phone: "734-XXX-XXXX", // Placeholder
    address: "University of Michigan Law School...", // Placeholder
    mission: "The Michigan Innocence Clinic is dedicated to securing the release of wrongfully convicted individuals in Michigan through legal representation, education, and policy reform.",
    relatedIndividuals: [ // Individuals this org is linked to
      { id: "richard-roe", name: "Richard Roe" },
      { id: "fictional-person-1", name: "Fictional Person 1" }
    ],
    relatedMedia: [ // Media items linked to this org
      { id: "book-123", title: "Guilty Until Proven Innocent: The [Fictional] Story", type: "Book", linkType: "work" }, // linkType indicates /work or /item
      { id: "ep-002", title: "Episode 2: Faulty Forensics", type: "Podcast Episode", linkType: "item" }
    ],
    relatedFactors: [] // Could potentially link orgs to factors they focus on
  },
  // Add more mock organizations as needed
};
// Simulate fetching data
export const findMockWorkById = async (workId) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  if (mockMediaDatabase[workId]) {
    return mockMediaDatabase[workId];
  } else {
    throw new Error(`Media work not found for ID: ${workId}`);
  }
};




// Simulate fetching data
export const findMockItemById = async (itemId) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  if (mockItemDatabase[itemId]) {
    return mockItemDatabase[itemId];
  } else {
    throw new Error(`Media item not found for ID: ${itemId}`);
  }
};




// Simulate fetching data
export const findMockOrgById = async (orgId) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  if (mockOrgDatabase[orgId]) {
    return mockOrgDatabase[orgId];
  } else {
    throw new Error(`Organization not found for ID: ${orgId}`);
  }
};
// --- End Mock Data ---

