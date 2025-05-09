import React, { useState, useEffect } from 'react';

function IndividualsList() {
  const [individuals, setIndividuals] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Make sure this URL matches your backend server address and port
    fetch('http://localhost:3001/api/individuals')
      .then(response => {
        if (!response.ok) {
          // If response is not 2xx, throw an error
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json(); // Parse JSON data
      })
      .then(data => {
        setIndividuals(data); // Set the data in state
        setError(null); // Clear any previous errors
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setError(err.message); // Set error state
        setIndividuals([]); // Clear data on error
      })
      .finally(() => {
        setLoading(false); // Set loading to false
      });
  }, []); // Empty dependency array means this runs once on mount

  if (loading) return <p>Loading individuals...</p>;
  if (error) return <p>Error loading individuals: {error}</p>;

  return (
    <div>
      <h2>Individuals</h2>
      {individuals.length > 0 ? (
        <ul>
          {individuals.map(ind => (
            // Make sure your individual object has an 'id' and 'lastName'
            <li key={ind.id}>{ind.firstName} {ind.lastName}</li>
          ))}
        </ul>
      ) : (
        <p>No individuals found.</p>
      )}
    </div>
  );
}

export default IndividualsList;
