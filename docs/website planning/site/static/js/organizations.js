/**
 * Enhanced Search and Filtering for Organizations Page
 * This file extends the basic organizations.js with more advanced search and filtering capabilities
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const searchInput = document.querySelector('.search-bar input');
    const searchButton = document.querySelector('.search-bar button');
    const filterCheckboxes = document.querySelectorAll('.filter-checkbox input');
    const clearFiltersButton = document.querySelector('.clear-filters');
    const applyFiltersButton = document.querySelector('.apply-filters');
    const sortSelect = document.getElementById('sort-by');
    const resultsShown = document.getElementById('results-shown');
    const resultsTotal = document.getElementById('results-total');
    const resourcesGrid = document.querySelector('.resources-grid');
    const paginationPrev = document.querySelector('.pagination-prev');
    const paginationNext = document.querySelector('.pagination-next');
    const paginationPages = document.querySelector('.pagination-pages');
    const mapContainer = document.getElementById('organizations-map');
    
    // State
    let currentPage = 1;
    let itemsPerPage = 12;
    let activeFilters = {
        types: [],
        states: [],
        services: []
    };
    let searchQuery = '';
    let sortOption = 'name';
    let map = null;
    let markers = [];
    let debounceTimer;
    
    // Initialize the page
    initPage();
    
    /**
     * Initialize the page
     */
    function initPage() {
        // Set up event listeners
        setupEventListeners();
        
        // Initialize map if available
        if (mapContainer) {
            initMap();
        }
        
        // Load initial data
        fetchOrganizations();
    }
    
    /**
     * Set up event listeners for interactive elements
     */
    function setupEventListeners() {
        // Search with debounce
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() {
                handleSearch();
            }, 500); // 500ms debounce
        });
        
        searchButton.addEventListener('click', handleSearch);
        
        // Filters
        filterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                updateActiveFilters();
                // Auto-apply filters when checkboxes change
                applyFilters();
            });
        });
        
        clearFiltersButton.addEventListener('click', clearFilters);
        applyFiltersButton.addEventListener('click', applyFilters);
        
        // Sorting
        sortSelect.addEventListener('change', handleSort);
        
        // Pagination
        paginationPrev.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                fetchOrganizations();
            }
        });
        
        paginationNext.addEventListener('click', function(e) {
            e.preventDefault();
            const totalPages = parseInt(paginationNext.getAttribute('data-total-pages') || '1');
            if (currentPage < totalPages) {
                currentPage++;
                fetchOrganizations();
            }
        });
        
        // URL parameter handling on page load
        handleUrlParams();
        
        // Update URL when filters change
        window.addEventListener('popstate', function(event) {
            if (event.state) {
                // Restore state from popstate event
                currentPage = event.state.page || 1;
                searchQuery = event.state.search || '';
                activeFilters = event.state.filters || {types: [], states: [], services: []};
                sortOption = event.state.sort || 'name';
                
                // Update UI to match state
                updateUIFromState();
                
                // Fetch data with restored state
                fetchOrganizations(false); // Don't push state again
            } else {
                // Handle initial page load
                handleUrlParams();
            }
        });
    }
    
    /**
     * Handle URL parameters on page load
     */
    function handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Get page from URL
        const pageParam = urlParams.get('page');
        if (pageParam) {
            currentPage = parseInt(pageParam);
        }
        
        // Get search query from URL
        const searchParam = urlParams.get('search');
        if (searchParam) {
            searchQuery = searchParam;
            searchInput.value = searchQuery;
        }
        
        // Get sort option from URL
        const sortParam = urlParams.get('sort');
        if (sortParam) {
            sortOption = sortParam;
            sortSelect.value = sortOption;
        }
        
        // Get filter params from URL
        const typeParams = urlParams.getAll('type');
        const stateParams = urlParams.getAll('state');
        const serviceParams = urlParams.getAll('service');
        
        if (typeParams.length > 0 || stateParams.length > 0 || serviceParams.length > 0) {
            activeFilters = {
                types: typeParams,
                states: stateParams,
                services: serviceParams
            };
            
            // Update checkbox UI to match URL params
            updateCheckboxesFromFilters();
        }
    }
    
    /**
     * Update checkboxes to match active filters
     */
    function updateCheckboxesFromFilters() {
        // Reset all checkboxes
        filterCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Set checkboxes based on active filters
        filterCheckboxes.forEach(checkbox => {
            const name = checkbox.name;
            const value = checkbox.value;
            
            if (name === 'org-type' && activeFilters.types.includes(value)) {
                checkbox.checked = true;
            } else if (name === 'state' && activeFilters.states.includes(value)) {
                checkbox.checked = true;
            } else if (name === 'service' && activeFilters.services.includes(value)) {
                checkbox.checked = true;
            }
        });
    }
    
    /**
     * Update UI elements to match current state
     */
    function updateUIFromState() {
        // Update search input
        searchInput.value = searchQuery;
        
        // Update sort select
        sortSelect.value = sortOption;
        
        // Update checkboxes
        updateCheckboxesFromFilters();
    }
    
    /**
     * Update URL to reflect current state (for bookmarking and sharing)
     */
    function updateUrl(pushState = true) {
        const urlParams = new URLSearchParams();
        
        // Add page parameter
        if (currentPage > 1) {
            urlParams.append('page', currentPage);
        }
        
        // Add search parameter
        if (searchQuery) {
            urlParams.append('search', searchQuery);
        }
        
        // Add sort parameter
        if (sortOption !== 'name') {
            urlParams.append('sort', sortOption);
        }
        
        // Add filter parameters
        activeFilters.types.forEach(type => {
            urlParams.append('type', type);
        });
        
        activeFilters.states.forEach(state => {
            urlParams.append('state', state);
        });
        
        activeFilters.services.forEach(service => {
            urlParams.append('service', service);
        });
        
        // Create new URL
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        
        // Update browser history
        if (pushState) {
            const state = {
                page: currentPage,
                search: searchQuery,
                filters: activeFilters,
                sort: sortOption
            };
            
            window.history.pushState(state, '', newUrl);
        } else {
            window.history.replaceState({
                page: currentPage,
                search: searchQuery,
                filters: activeFilters,
                sort: sortOption
            }, '', newUrl);
        }
    }
    
    /**
     * Handle search functionality
     */
    function handleSearch() {
        searchQuery = searchInput.value.trim();
        currentPage = 1; // Reset to first page on new search
        fetchOrganizations();
    }
    
    /**
     * Update active filters based on checkbox selections
     */
    function updateActiveFilters() {
        activeFilters = {
            types: [],
            states: [],
            services: []
        };
        
        filterCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const name = checkbox.name;
                const value = checkbox.value;
                
                if (name === 'org-type') {
                    activeFilters.types.push(value);
                } else if (name === 'state') {
                    activeFilters.states.push(value);
                } else if (name === 'service') {
                    activeFilters.services.push(value);
                }
            }
        });
    }
    
    /**
     * Clear all filters
     */
    function clearFilters() {
        filterCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        searchInput.value = '';
        searchQuery = '';
        activeFilters = {
            types: [],
            states: [],
            services: []
        };
        
        currentPage = 1; // Reset to first page
        fetchOrganizations();
    }
    
    /**
     * Apply filters to the organizations data
     */
    function applyFilters() {
        updateActiveFilters();
        currentPage = 1; // Reset to first page when filters change
        fetchOrganizations();
    }
    
    /**
     * Handle sorting of organizations
     */
    function handleSort() {
        sortOption = sortSelect.value;
        fetchOrganizations();
    }
    
    /**
     * Fetch organizations data from the API
     */
    function fetchOrganizations(pushState = true) {
        // Show loading state
        resourcesGrid.innerHTML = '<div class="loading">Loading organizations...</div>';
        
        // Build API URL with query parameters
        const apiUrl = new URL('/api/organizations', window.location.origin);
        
        // Add search parameter
        if (searchQuery) {
            apiUrl.searchParams.append('name', searchQuery);
        }
        
        // Add filter parameters
        activeFilters.types.forEach(type => {
            apiUrl.searchParams.append('org_type', type);
        });
        
        activeFilters.states.forEach(state => {
            apiUrl.searchParams.append('state', state);
        });
        
        activeFilters.services.forEach(service => {
            apiUrl.searchParams.append('service', service);
        });
        
        // Add sort parameter
        apiUrl.searchParams.append('sort', sortOption);
        
        // Add pagination parameters
        apiUrl.searchParams.append('page', currentPage);
        apiUrl.searchParams.append('per_page', itemsPerPage);
        
        // Update URL for bookmarking and sharing
        updateUrl(pushState);
        
        // Fetch data from API
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Update UI with fetched data
                updateResults(data.organizations, data.total);
                
                // Update map if available
                if (mapContainer && map) {
                    updateMap(data.organizations);
                }
            })
            .catch(error => {
                console.error('Error fetching organizations:', error);
                resourcesGrid.innerHTML = '<div class="error">Error loading organizations. Please try again later.</div>';
            });
    }
    
    /**
     * Update the results display
     */
    function updateResults(organizations, totalCount) {
        // Update counts
        resultsShown.textContent = organizations.length;
        resultsTotal.textContent = totalCount;
        
        // Calculate pagination
        const totalPages = Math.ceil(totalCount / itemsPerPage);
        
        // Update pagination UI
        updatePagination(totalPages);
        
        // Update organization cards
        resourcesGrid.innerHTML = '';
        
        if (organizations.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = '<p>No organizations match your search criteria. Please try different filters.</p>';
            resourcesGrid.appendChild(noResults);
        } else {
            organizations.forEach(org => {
                resourcesGrid.appendChild(createOrganizationCard(org));
            });
        }
        
        // Add filter tags display
        updateFilterTags();
    }
    
    /**
     * Create an organization card element
     */
    function createOrganizationCard(org) {
        const card = document.createElement('div');
        card.className = 'resource-card';
        
        let servicesHtml = '';
        if (org.services && org.services.length > 0) {
            servicesHtml = '<div class="resource-services">' + 
                org.services.map(service => `<span class="service-tag">${service.name}</span>`).join('') +
                '</div>';
        }
        
        let contactHtml = '';
        if (org.phone) {
            contactHtml += `<p class="resource-contact"><i class="fas fa-phone"></i> ${org.phone}</p>`;
        }
        if (org.email) {
            contactHtml += `<p class="resource-contact"><i class="fas fa-envelope"></i> ${org.email}</p>`;
        }
        
        card.innerHTML = `
            <div class="resource-content">
                <div class="resource-type">${org.org_type || 'Organization'}</div>
                <h3 class="resource-title">${org.name}</h3>
                <p class="resource-location"><i class="fas fa-map-marker-alt"></i> ${org.city || ''}, ${org.state || ''}</p>
                <p class="resource-description">${org.description || 'No description available.'}</p>
                ${servicesHtml}
                ${org.website ? `<a href="${org.website}" target="_blank" class="resource-link">Visit Website <i class="fas fa-external-link-alt"></i></a>` : ''}
                ${contactHtml}
            </div>
        `;
        
        return card;
    }
    
    /**
     * Update filter tags display to show active filters
     */
    function updateFilterTags() {
        // Check if filter tags container exists, create if not
        let filterTagsContainer = document.querySelector('.active-filters');
        if (!filterTagsContainer) {
            filterTagsContainer = document.createElement('div');
            filterTagsContainer.className = 'active-filters';
            
            // Insert after the filter panel
            const filterPanel = document.querySelector('.filter-panel');
            if (filterPanel && filterPanel.parentNode) {
                filterPanel.parentNode.insertBefore(filterTagsContainer, filterPanel.nextSibling);
            }
        }
        
        // Clear existing tags
        filterTagsContainer.innerHTML = '';
        
        // Check if we have any active filters
        const hasActiveFilters = searchQuery || 
                               activeFilters.types.length > 0 || 
                               activeFilters.states.length > 0 || 
                               activeFilters.services.length > 0;
        
        if (!hasActiveFilters) {
            filterTagsContainer.style.display = 'none';
            return;
        }
        
        filterTagsContainer.style.display = 'block';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'filter-tags-header';
        header.textContent = 'Active Filters:';
        filterTagsContainer.appendChild(header);
        
        // Create tags container
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'filter-tags';
        filterTagsContainer.appendChild(tagsContainer);
        
        // Add search query tag if exists
        if (searchQuery) {
            const searchTag = createFilterTag('Search: ' + searchQuery, () => {
                searchInput.value = '';
                searchQuery = '';
                fetchOrganizations();
            });
            tagsContainer.appendChild(searchTag);
        }
        
        // Add organization type tags
        activeFilters.types.forEach(type => {
            const typeLabel = document.querySelector(`label[for="type-${type}"]`);
            const typeName = typeLabel ? typeLabel.textContent : type;
            
            const typeTag = createFilterTag('Type: ' + typeName, () => {
                const checkbox = document.getElementById(`type-${type}`);
                if (checkbox) {
                    checkbox.checked = false;
                }
                activeFilters.types = activeFilters.types.filter(t => t !== type);
                fetchOrganizations();
            });
            tagsContainer.appendChild(typeTag);
        });
        
        // Add state tags
        activeFilters.states.forEach(state => {
            const stateLabel = document.querySelector(`label[for="state-${state}"]`);
            const stateName = stateLabel ? stateLabel.textContent : state;
            
            const stateTag = createFilterTag('State: ' + stateName, () => {
                const checkbox = document.getElementById(`state-${state}`);
                if (checkbox) {
                    checkbox.checked = false;
                }
                activeFilters.states = activeFilters.states.filter(s => s !== state);
                fetchOrganizations();
            });
            tagsContainer.appendChild(stateTag);
        });
        
        // Add service tags
        activeFilters.services.forEach(service => {
            const serviceLabel = document.querySelector(`label[for="service-${service}"]`);
            const serviceName = serviceLabel ? serviceLabel.textContent : service;
            
            const serviceTag = createFilterTag('Service: ' + serviceName, () => {
                const checkbox = document.getElementById(`service-${service}`);
                if (checkbox) {
                    checkbox.checked = false;
                }
                activeFilters.services = activeFilters.services.filter(s => s !== service);
                fetchOrganizations();
            });
            tagsContainer.appendChild(serviceTag);
        });
        
        // Add clear all button
        const clearAllButton = document.createElement('button');
        clearAllButton.className = 'clear-all-filters';
        clearAllButton.textContent = 'Clear All Filters';
        clearAllButton.addEventListener('click', clearFilters);
        filterTagsContainer.appendChild(clearAllButton);
    }
    
    /**
     * Create a filter tag element
     */
    function createFilterTag(text, removeCallback) {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        
        const tagText = document.createElement('span');
        tagText.textContent = text;
        tag.appendChild(tagText);
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-tag';
        removeButton.innerHTML = '&times;';
        removeButton.setAttribute('aria-label', 'Remove filter');
        removeButton.addEventListener('click', removeCallback);
        tag.appendChild(removeButton);
        
        return tag;
    }
    
    /**
     * Update pagination controls
     */
    function updatePagination(totalPages) {
        // Update previous/next buttons
        paginationPrev.disabled = currentPage === 1;
        paginationNext.disabled = currentPage === totalPages;
        
        // Store total pages for next button
        paginationNext.setAttribute('data-total-pages', totalPages);
        
        // Update page numbers
        paginationPages.innerHTML = '';
        
        // Determine which page numbers to show
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // Adjust if we're near the end
        if (endPage - startPage < 4 && startPage > 1) {
            startPage = Math.max(1, endPage - 4);
        }
        
        // Add first page and ellipsis if needed
        if (startPage > 1) {
            addPageLink(1);
            if (startPage > 2) {
                addEllipsis();
            }
        }
        
        // Add page numbers
        for (let i = startPage; i <= endPage; i++) {
            addPageLink(i);
        }
        
        // Add ellipsis and last page if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                addEllipsis();
            }
            addPageLink(totalPages);
        }
        
        // Helper function to add page link
        function addPageLink(pageNum) {
            const pageLink = document.createElement('a');
            pageLink.href = `?page=${pageNum}`;
            pageLink.className = `pagination-page ${pageNum === currentPage ? 'active' : ''}`;
            pageLink.textContent = pageNum;
            
            pageLink.addEventListener('click', function(e) {
                e.preventDefault();
                currentPage = pageNum;
                fetchOrganizations();
            });
            
            paginationPages.appendChild(pageLink);
        }
        
        // Helper function to add ellipsis
        function addEllipsis() {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            paginationPages.appendChild(ellipsis);
        }
    }
    
    /**
     * Initialize the map
     */
    function initMap() {
        // This would use a mapping library like Leaflet or Google Maps
        // For now, we'll just create a placeholder
        if (mapContainer) {
            mapContainer.innerHTML = '<div class="map-placeholder">Interactive map of organizations will be displayed here</div>';
            
            // In a real implementation, this would initialize the map:
            /*
            map = L.map('organizations-map').setView([37.8, -96], 4);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            */
        }
    }
    
    /**
     * Update the map with filtered organizations
     */
    function updateMap(organizations) {
        // This would update markers on the map based on filtered organizations
        // For now, we'll just update our placeholder
        if (mapContainer) {
            const mapPlaceholder = mapContainer.querySelector('.map-placeholder');
            if (mapPlaceholder) {
                mapPlaceholder.textContent = `Interactive map showing ${organizations.length} organizations`;
            }
            
            // In a real implementation, this would update the markers:
            /*
            // Clear existing markers
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];
            
            // Add new markers
            organizations.forEach(org => {
                if (org.latitude && org.longitude) {
                    const marker = L.marker([org.latitude, org.longitude])
                        .addTo(map)
                        .bindPopup(`<b>${org.name}</b><br>${org.city}, ${org.state}`);
                    markers.push(marker);
                }
            });
            */
        }
    }
});
