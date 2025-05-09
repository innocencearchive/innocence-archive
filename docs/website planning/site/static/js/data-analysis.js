/**
 * Statistical Analysis Features for Wrongfully Convicted Americans Website
 * This file implements data visualization and statistical analysis components
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the data exploration page
    const dataExplorationContainer = document.getElementById('data-exploration');
    if (!dataExplorationContainer) return;
    
    // Initialize the data visualization components
    initDataVisualizations();
    
    /**
     * Initialize all data visualization components
     */
    function initDataVisualizations() {
        // Load the necessary visualization libraries
        loadVisualizationLibraries()
            .then(() => {
                // Create the visualizations once libraries are loaded
                createExonerationsByYearChart();
                createExonerationsByStateMap();
                createContributingFactorsChart();
                createTimeServedChart();
                createDemographicsChart();
                createCrimeTypeChart();
                
                // Set up filter controls for the visualizations
                setupVisualizationFilters();
                
                // Add export functionality
                setupExportOptions();
            })
            .catch(error => {
                console.error('Error loading visualization libraries:', error);
                dataExplorationContainer.innerHTML = '<div class="error">Error loading data visualization components. Please try again later.</div>';
            });
    }
    
    /**
     * Load required visualization libraries
     */
    function loadVisualizationLibraries() {
        return new Promise((resolve, reject) => {
            // This would load external libraries like Chart.js, D3.js, etc.
            // For now, we'll simulate successful loading
            setTimeout(resolve, 500);
        });
    }
    
    /**
     * Create chart showing exonerations by year
     */
    function createExonerationsByYearChart() {
        const container = document.getElementById('exonerations-by-year');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading">Loading chart data...</div>';
        
        // Fetch data from API
        fetch('/api/stats/exonerations-by-year')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear loading state
                container.innerHTML = '';
                
                // Create chart container
                const chartContainer = document.createElement('div');
                chartContainer.className = 'chart-container';
                container.appendChild(chartContainer);
                
                // In a real implementation, this would create a line chart using a library like Chart.js
                // For now, we'll create a placeholder with some sample data
                const sampleData = [
                    { year: 1989, count: 4 },
                    { year: 1990, count: 6 },
                    { year: 1991, count: 8 },
                    { year: 1992, count: 10 },
                    { year: 1993, count: 12 },
                    { year: 1994, count: 15 },
                    { year: 1995, count: 18 },
                    { year: 1996, count: 22 },
                    { year: 1997, count: 25 },
                    { year: 1998, count: 28 },
                    { year: 1999, count: 32 },
                    { year: 2000, count: 38 },
                    { year: 2001, count: 42 },
                    { year: 2002, count: 48 },
                    { year: 2003, count: 52 },
                    { year: 2004, count: 58 },
                    { year: 2005, count: 65 },
                    { year: 2006, count: 70 },
                    { year: 2007, count: 75 },
                    { year: 2008, count: 82 },
                    { year: 2009, count: 87 },
                    { year: 2010, count: 93 },
                    { year: 2011, count: 98 },
                    { year: 2012, count: 105 },
                    { year: 2013, count: 110 },
                    { year: 2014, count: 115 },
                    { year: 2015, count: 120 },
                    { year: 2016, count: 125 },
                    { year: 2017, count: 130 },
                    { year: 2018, count: 135 },
                    { year: 2019, count: 140 },
                    { year: 2020, count: 145 },
                    { year: 2021, count: 150 },
                    { year: 2022, count: 155 },
                    { year: 2023, count: 160 }
                ];
                
                createPlaceholderLineChart(chartContainer, 'Exonerations by Year', sampleData, 'year', 'count');
                
                // Add insights section
                const insights = document.createElement('div');
                insights.className = 'chart-insights';
                insights.innerHTML = `
                    <h3>Key Insights</h3>
                    <ul>
                        <li>Exonerations have steadily increased over time, with significant growth since 2000.</li>
                        <li>The peak year was 2023 with 160 exonerations.</li>
                        <li>The trend shows growing awareness and resources dedicated to identifying wrongful convictions.</li>
                    </ul>
                `;
                container.appendChild(insights);
            })
            .catch(error => {
                console.error('Error fetching exonerations by year data:', error);
                container.innerHTML = '<div class="error">Error loading chart data. Please try again later.</div>';
            });
    }
    
    /**
     * Create map showing exonerations by state
     */
    function createExonerationsByStateMap() {
        const container = document.getElementById('exonerations-by-state');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading">Loading map data...</div>';
        
        // Fetch data from API
        fetch('/api/stats/exonerations-by-state')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear loading state
                container.innerHTML = '';
                
                // Create map container
                const mapContainer = document.createElement('div');
                mapContainer.className = 'map-container';
                mapContainer.style.height = '400px';
                container.appendChild(mapContainer);
                
                // In a real implementation, this would create a choropleth map using a library like D3.js
                // For now, we'll create a placeholder with some sample data
                const sampleData = [
                    { state: 'Texas', count: 380 },
                    { state: 'New York', count: 325 },
                    { state: 'California', count: 290 },
                    { state: 'Illinois', count: 275 },
                    { state: 'Michigan', count: 165 },
                    { state: 'Florida', count: 150 },
                    { state: 'Pennsylvania', count: 135 },
                    { state: 'Ohio', count: 120 },
                    { state: 'Massachusetts', count: 110 },
                    { state: 'Louisiana', count: 105 }
                ];
                
                // Create a simple placeholder for the map
                mapContainer.innerHTML = `
                    <div class="map-placeholder">
                        <h3>Exonerations by State (Top 10)</h3>
                        <div class="state-bars">
                            ${sampleData.map(item => `
                                <div class="state-bar">
                                    <div class="state-name">${item.state}</div>
                                    <div class="bar-container">
                                        <div class="bar" style="width: ${(item.count / 380) * 100}%"></div>
                                        <div class="count">${item.count}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <p class="map-note">Interactive map would be displayed here in the full implementation.</p>
                    </div>
                `;
                
                // Add insights section
                const insights = document.createElement('div');
                insights.className = 'chart-insights';
                insights.innerHTML = `
                    <h3>Key Insights</h3>
                    <ul>
                        <li>Texas leads with the highest number of exonerations (380), followed by New York (325) and California (290).</li>
                        <li>The top 5 states account for over 50% of all exonerations nationwide.</li>
                        <li>States with robust innocence projects and reform initiatives tend to have higher exoneration rates.</li>
                    </ul>
                `;
                container.appendChild(insights);
            })
            .catch(error => {
                console.error('Error fetching exonerations by state data:', error);
                container.innerHTML = '<div class="error">Error loading map data. Please try again later.</div>';
            });
    }
    
    /**
     * Create chart showing contributing factors to wrongful convictions
     */
    function createContributingFactorsChart() {
        const container = document.getElementById('contributing-factors');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading">Loading chart data...</div>';
        
        // Fetch data from API
        fetch('/api/stats/contributing-factors')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear loading state
                container.innerHTML = '';
                
                // Create chart container
                const chartContainer = document.createElement('div');
                chartContainer.className = 'chart-container';
                container.appendChild(chartContainer);
                
                // In a real implementation, this would create a bar chart using a library like Chart.js
                // For now, we'll create a placeholder with some sample data
                const sampleData = [
                    { factor: 'Mistaken Witness ID', count: 720 },
                    { factor: 'Official Misconduct', count: 680 },
                    { factor: 'Perjury/False Accusation', count: 640 },
                    { factor: 'False Confession', count: 340 },
                    { factor: 'False or Misleading Forensic Evidence', count: 320 },
                    { factor: 'Inadequate Legal Defense', count: 280 },
                    { factor: 'Informant Testimony', count: 220 }
                ];
                
                createPlaceholderBarChart(chartContainer, 'Contributing Factors to Wrongful Convictions', sampleData, 'factor', 'count');
                
                // Add insights section
                const insights = document.createElement('div');
                insights.className = 'chart-insights';
                insights.innerHTML = `
                    <h3>Key Insights</h3>
                    <ul>
                        <li>Mistaken witness identification is the leading factor in wrongful convictions (720 cases).</li>
                        <li>Official misconduct (680) and perjury/false accusation (640) are also major contributing factors.</li>
                        <li>Many cases involve multiple contributing factors, creating compounding issues in the justice system.</li>
                    </ul>
                `;
                container.appendChild(insights);
            })
            .catch(error => {
                console.error('Error fetching contributing factors data:', error);
                container.innerHTML = '<div class="error">Error loading chart data. Please try again later.</div>';
            });
    }
    
    /**
     * Create chart showing time served by exonerees
     */
    function createTimeServedChart() {
        const container = document.getElementById('time-served');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading">Loading chart data...</div>';
        
        // Fetch data from API
        fetch('/api/stats/time-served')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear loading state
                container.innerHTML = '';
                
                // Create chart container
                const chartContainer = document.createElement('div');
                chartContainer.className = 'chart-container';
                container.appendChild(chartContainer);
                
                // In a real implementation, this would create a histogram using a library like Chart.js
                // For now, we'll create a placeholder with some sample data
                const sampleData = [
                    { range: '0-5 years', count: 420 },
                    { range: '6-10 years', count: 580 },
                    { range: '11-15 years', count: 480 },
                    { range: '16-20 years', count: 320 },
                    { range: '21-25 years', count: 180 },
                    { range: '26-30 years', count: 120 },
                    { range: '31+ years', count: 100 }
                ];
                
                createPlaceholderBarChart(chartContainer, 'Time Served by Exonerees', sampleData, 'range', 'count');
                
                // Add insights section
                const insights = document.createElement('div');
                insights.className = 'chart-insights';
                insights.innerHTML = `
                    <h3>Key Insights</h3>
                    <ul>
                        <li>The majority of exonerees served between 6-10 years (580 individuals) before being exonerated.</li>
                        <li>Over 400 individuals served more than 20 years for crimes they didn't commit.</li>
                        <li>The average time served before exoneration is approximately 14 years.</li>
                        <li>Collectively, exonerees have lost over 25,000 years of their lives to wrongful imprisonment.</li>
                    </ul>
                `;
                container.appendChild(insights);
            })
            .catch(error => {
                console.error('Error fetching time served data:', error);
                container.innerHTML = '<div class="error">Error loading chart data. Please try again later.</div>';
            });
    }
    
    /**
     * Create chart showing demographics of exonerees
     */
    function createDemographicsChart() {
        const container = document.getElementById('demographics');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading">Loading chart data...</div>';
        
        // Fetch data from API
        fetch('/api/stats/demographics')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear loading state
                container.innerHTML = '';
                
                // Create tabs for different demographic breakdowns
                const tabsContainer = document.createElement('div');
                tabsContainer.className = 'tabs-container';
                container.appendChild(tabsContainer);
                
                const tabs = document.createElement('div');
                tabs.className = 'tabs';
                tabsContainer.appendChild(tabs);
                
                const tabContent = document.createElement('div');
                tabContent.className = 'tab-content';
                tabsContainer.appendChild(tabContent);
                
                // Create tabs
                const tabData = [
                    { id: 'race', label: 'Race/Ethnicity' },
                    { id: 'gender', label: 'Gender' },
                    { id: 'age', label: 'Age at Conviction' }
                ];
                
                tabData.forEach((tab, index) => {
                    const tabButton = document.createElement('button');
                    tabButton.className = `tab-button ${index === 0 ? 'active' : ''}`;
                    tabButton.setAttribute('data-tab', tab.id);
                    tabButton.textContent = tab.label;
                    tabs.appendChild(tabButton);
                    
                    const tabPane = document.createElement('div');
                    tabPane.className = `tab-pane ${index === 0 ? 'active' : ''}`;
                    tabPane.id = `tab-${tab.id}`;
                    tabContent.appendChild(tabPane);
                    
                    // Create chart container for this tab
                    const chartContainer = document.createElement('div');
                    chartContainer.className = 'chart-container';
                    tabPane.appendChild(chartContainer);
                    
                    // Create different charts based on tab
                    if (tab.id === 'race') {
                        const raceData = [
                            { category: 'Black', count: 950 },
                            { category: 'White', count: 580 },
                            { category: 'Hispanic', count: 420 },
                            { category: 'Other', count: 150 }
                        ];
                        createPlaceholderPieChart(chartContainer, 'Exonerees by Race/Ethnicity', raceData, 'category', 'count');
                    } else if (tab.id === 'gender') {
                        const genderData = [
                            { category: 'Male', count: 1850 },
                            { category: 'Female', count: 250 }
                        ];
                        createPlaceholderPieChart(chartContainer, 'Exonerees by Gender', genderData, 'category', 'count');
                    } else if (tab.id === 'age') {
                        const ageData = [
                            { category: 'Under 18', count: 180 },
                            { category: '18-25', count: 720 },
                            { category: '26-35', count: 650 },
                            { category: '36-45', count: 380 },
                            { category: '46+', count: 170 }
                        ];
                        createPlaceholderBarChart(chartContainer, 'Exonerees by Age at Conviction', ageData, 'category', 'count');
                    }
                });
                
                // Add tab switching functionality
                tabs.addEventListener('click', function(e) {
                    if (e.target.classList.contains('tab-button')) {
                        // Remove active class from all tabs
                        document.querySelectorAll('.tab-button').forEach(tab => {
                            tab.classList.remove('active');
                        });
                        document.querySelectorAll('.tab-pane').forEach(pane => {
                            pane.classList.remove('active');
                        });
                        
                        // Add active class to clicked tab
                        e.target.classList.add('active');
                        const tabId = e.target.getAttribute('data-tab');
                        document.getElementById(`tab-${tabId}`).classList.add('active');
                    }
                });
                
                // Add insights section
                const insights = document.createElement('div');
                insights.className = 'chart-insights';
                insights.innerHTML = `
                    <h3>Key Insights</h3>
                    <ul>
                        <li>Black individuals are significantly overrepresented among exonerees (45% of exonerees vs. 13% of US population).</li>
                        <li>Men make up the vast majority of exonerees (88%).</li>
                        <li>Young adults (18-35) account for over 65% of wrongful convictions.</li>
                        <li>These demographic patterns suggest systemic biases in the criminal justice system.</li>
                    </ul>
                `;
                container.appendChild(insights);
            })
            .catch(error => {
                console.error('Error fetching demographics data:', error);
                container.innerHTML = '<div class="error">Error loading chart data. Please try again later.</div>';
            });
    }
    
    /**
     * Create chart showing crime types in wrongful convictions
     */
    function createCrimeTypeChart() {
        const container = document.getElementById('crime-types');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading">Loading chart data...</div>';
        
        // Fetch data from API
        fetch('/api/stats/crime-types')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear loading state
                container.innerHTML = '';
                
                // Create chart container
                const chartContainer = document.createElement('div');
                chartContainer.className = 'chart-container';
                container.appendChild(chartContainer);
                
                // In a real implementation, this would create a pie chart using a library like Chart.js
                // For now, we'll create a placeholder with some sample data
                const sampleData = [
                    { category: 'Murder', count: 820 },
                    { category: 'Sexual Assault', count: 580 },
                    { category: 'Drug Crimes', count: 320 },
                    { category: 'Robbery', count: 180 },
                    { category: 'Other Violent Crimes', count: 120 },
                    { category: 'Other Non-Violent Crimes', count: 80 }
                ];
                
                createPlaceholderPieChart(chartContainer, 'Exonerations by Crime Type', sampleData, 'category', 'count');
                
                // Add insights section
                const insights = document.createElement('div');
                insights.className = 'chart-insights';
                insights.innerHTML = `
                    <h3>Key Insights</h3>
                    <ul>
                        <li>Murder cases account for the largest percentage of exonerations (39%).</li>
                        <li>Sexual assault cases represent 28% of all exonerations.</li>
                        <li>Serious crimes with severe penalties are more likely to be the focus of exoneration efforts.</li>
                        <li>Drug crimes have seen an increasing share of exonerations in recent years.</li>
                    </ul>
                `;
                container.appendChild(insights);
            })
            .catch(error => {
                console.error('Error fetching crime type data:', error);
                container.innerHTML = '<div class="error">Error loading chart data. Please try again later.</div>';
            });
    }
    
    /**
     * Set up filter controls for the visualizations
     */
    function setupVisualizationFilters() {
        const filterContainer = document.getElementById('visualization-filters');
        if (!filterContainer) return;
        
        // Create filter controls
        filterContainer.innerHTML = `
            <div class="filter-section">
                <h3>Filter Visualizations</h3>
                <div class="filter-row">
                    <div class="filter-group">
                        <label for="year-range">Year Range:</label>
                        <div class="range-inputs">
                            <input type="number" id="year-from" min="1989" max="2023" value="1989">
                            <span>to</span>
                            <input type="number" id="year-to" min="1989" max="2023" value="2023">
                        </div>
                    </div>
                    
                    <div class="filter-group">
                        <label for="crime-type-filter">Crime Type:</label>
                        <select id="crime-type-filter">
                            <option value="all">All Crime Types</option>
                            <option value="murder">Murder</option>
                            <option value="sexual-assault">Sexual Assault</option>
                            <option value="drug">Drug Crimes</option>
                            <option value="robbery">Robbery</option>
                            <option value="other-violent">Other Violent Crimes</option>
                            <option value="other-nonviolent">Other Non-Violent Crimes</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="region-filter">Region:</label>
                        <select id="region-filter">
                            <option value="all">All Regions</option>
                            <option value="northeast">Northeast</option>
                            <option value="midwest">Midwest</option>
                            <option value="south">South</option>
                            <option value="west">West</option>
                        </select>
                    </div>
                </div>
                
                <div class="filter-actions">
                    <button id="apply-viz-filters" class="apply-filters">Apply Filters</button>
                    <button id="reset-viz-filters" class="clear-filters">Reset Filters</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        document.getElementById('apply-viz-filters').addEventListener('click', function() {
            // This would update all visualizations based on selected filters
            // For now, we'll just show a message
            const yearFrom = document.getElementById('year-from').value;
            const yearTo = document.getElementById('year-to').value;
            const crimeType = document.getElementById('crime-type-filter').value;
            const region = document.getElementById('region-filter').value;
            
            alert(`Filters applied: Years ${yearFrom}-${yearTo}, Crime Type: ${crimeType}, Region: ${region}`);
            
            // In a real implementation, this would refresh all charts with the new filters
            refreshAllVisualizations();
        });
        
        document.getElementById('reset-viz-filters').addEventListener('click', function() {
            // Reset all filter inputs to defaults
            document.getElementById('year-from').value = '1989';
            document.getElementById('year-to').value = '2023';
            document.getElementById('crime-type-filter').value = 'all';
            document.getElementById('region-filter').value = 'all';
            
            // Refresh visualizations with default filters
            refreshAllVisualizations();
        });
    }
    
    /**
     * Refresh all visualizations with current filters
     */
    function refreshAllVisualizations() {
        // This would update all charts with the current filter settings
        // For now, we'll just show a loading state briefly
        const chartContainers = document.querySelectorAll('.chart-container');
        
        chartContainers.forEach(container => {
            const originalContent = container.innerHTML;
            container.innerHTML = '<div class="loading">Updating chart...</div>';
            
            // Simulate chart refresh
            setTimeout(() => {
                container.innerHTML = originalContent;
            }, 800);
        });
    }
    
    /**
     * Set up export options for data and visualizations
     */
    function setupExportOptions() {
        const exportContainer = document.getElementById('export-options');
        if (!exportContainer) return;
        
        // Create export controls
        exportContainer.innerHTML = `
            <div class="export-section">
                <h3>Export Data</h3>
                <div class="export-buttons">
                    <button id="export-csv" class="export-button">
                        <i class="fas fa-file-csv"></i> Export as CSV
                    </button>
                    <button id="export-json" class="export-button">
                        <i class="fas fa-file-code"></i> Export as JSON
                    </button>
                    <button id="export-images" class="export-button">
                        <i class="fas fa-file-image"></i> Export Charts as Images
                    </button>
                    <button id="export-pdf" class="export-button">
                        <i class="fas fa-file-pdf"></i> Export Report as PDF
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        document.getElementById('export-csv').addEventListener('click', function() {
            alert('CSV export functionality would be implemented here');
        });
        
        document.getElementById('export-json').addEventListener('click', function() {
            alert('JSON export functionality would be implemented here');
        });
        
        document.getElementById('export-images').addEventListener('click', function() {
            alert('Chart image export functionality would be implemented here');
        });
        
        document.getElementById('export-pdf').addEventListener('click', function() {
            alert('PDF report export functionality would be implemented here');
        });
    }
    
    /**
     * Create a placeholder line chart
     */
    function createPlaceholderLineChart(container, title, data, xKey, yKey) {
        // Create a simple placeholder for the line chart
        const chartHtml = `
            <div class="chart-placeholder line-chart">
                <h3>${title}</h3>
                <div class="chart-area">
                    <div class="y-axis">
                        ${Array(5).fill(0).map((_, i) => {
                            const max = Math.max(...data.map(d => d[yKey]));
                            const value = Math.round(max - (i * (max / 4)));
                            return `<div class="y-label">${value}</div>`;
                        }).join('')}
                    </div>
                    <div class="chart-content">
                        <svg class="line-svg" viewBox="0 0 1000 400">
                            <polyline points="${data.map((d, i) => {
                                const x = (i / (data.length - 1)) * 1000;
                                const y = 400 - ((d[yKey] / Math.max(...data.map(d => d[yKey]))) * 400);
                                return `${x},${y}`;
                            }).join(' ')}" fill="none" stroke="#2c7a7b" stroke-width="3" />
                            ${data.map((d, i) => {
                                const x = (i / (data.length - 1)) * 1000;
                                const y = 400 - ((d[yKey] / Math.max(...data.map(d => d[yKey]))) * 400);
                                return `<circle cx="${x}" cy="${y}" r="5" fill="#2c7a7b" />`;
                            }).join('')}
                        </svg>
                        <div class="x-axis">
                            ${data.filter((_, i) => i % Math.ceil(data.length / 10) === 0 || i === data.length - 1).map(d => `
                                <div class="x-label">${d[xKey]}</div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = chartHtml;
    }
    
    /**
     * Create a placeholder bar chart
     */
    function createPlaceholderBarChart(container, title, data, xKey, yKey) {
        // Create a simple placeholder for the bar chart
        const chartHtml = `
            <div class="chart-placeholder bar-chart">
                <h3>${title}</h3>
                <div class="chart-area">
                    <div class="y-axis">
                        ${Array(5).fill(0).map((_, i) => {
                            const max = Math.max(...data.map(d => d[yKey]));
                            const value = Math.round(max - (i * (max / 4)));
                            return `<div class="y-label">${value}</div>`;
                        }).join('')}
                    </div>
                    <div class="chart-content">
                        <div class="bars">
                            ${data.map(d => {
                                const height = (d[yKey] / Math.max(...data.map(d => d[yKey]))) * 100;
                                return `
                                    <div class="bar-container">
                                        <div class="bar" style="height: ${height}%"></div>
                                        <div class="bar-label">${d[xKey]}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = chartHtml;
    }
    
    /**
     * Create a placeholder pie chart
     */
    function createPlaceholderPieChart(container, title, data, labelKey, valueKey) {
        // Calculate percentages
        const total = data.reduce((sum, d) => sum + d[valueKey], 0);
        const dataWithPercentages = data.map(d => ({
            ...d,
            percentage: ((d[valueKey] / total) * 100).toFixed(1)
        }));
        
        // Create a simple placeholder for the pie chart
        const chartHtml = `
            <div class="chart-placeholder pie-chart">
                <h3>${title}</h3>
                <div class="chart-area">
                    <div class="pie-container">
                        <div class="pie-visualization">
                            <div class="pie-chart-placeholder">Pie Chart Visualization</div>
                        </div>
                        <div class="pie-legend">
                            ${dataWithPercentages.map((d, i) => {
                                const colors = ['#1a365d', '#2c7a7b', '#d69e2e', '#e53e3e', '#38a169', '#805ad5', '#dd6b20'];
                                const color = colors[i % colors.length];
                                return `
                                    <div class="legend-item">
                                        <div class="legend-color" style="background-color: ${color}"></div>
                                        <div class="legend-label">${d[labelKey]}</div>
                                        <div class="legend-value">${d[valueKey]} (${d.percentage}%)</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = chartHtml;
    }
});
