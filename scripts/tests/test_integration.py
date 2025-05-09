#!/usr/bin/env python3
"""
Integration test script for Wrongfully Convicted Americans website
This script tests the integration between frontend and backend components
"""

import os
import sys
import unittest
import sqlite3
import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app

class IntegrationTestCase(unittest.TestCase):
    """Test case for frontend-backend integration"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment once before all tests"""
        # Set up Chrome options for headless testing
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        # Initialize WebDriver
        cls.driver = webdriver.Chrome(options=chrome_options)
        cls.driver.implicitly_wait(10)
        
        # Start Flask app in a separate process
        cls.flask_process = cls.start_flask_app()
        
        # Wait for Flask app to start
        time.sleep(2)
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests"""
        cls.driver.quit()
        cls.stop_flask_app(cls.flask_process)
    
    @classmethod
    def start_flask_app(cls):
        """Start Flask app in a separate process"""
        import subprocess
        import signal
        
        # Start Flask app on port 5000
        process = subprocess.Popen(
            ["python3", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"],
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            preexec_fn=os.setsid
        )
        return process
    
    @classmethod
    def stop_flask_app(cls, process):
        """Stop Flask app process"""
        import os
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    
    def test_home_page_loads(self):
        """Test that the home page loads and contains expected elements"""
        self.driver.get("http://localhost:5000/")
        
        # Check page title
        self.assertIn("Wrongfully Convicted Americans", self.driver.title)
        
        # Check for main navigation elements
        nav_items = self.driver.find_elements(By.CSS_SELECTOR, "nav ul li a")
        nav_texts = [item.text for item in nav_items]
        self.assertIn("Home", nav_texts)
        self.assertIn("Browse Stories", nav_texts)
        self.assertIn("Resources", nav_texts)
        self.assertIn("Organizations", nav_texts)
    
    def test_organizations_page_functionality(self):
        """Test the organizations page functionality"""
        self.driver.get("http://localhost:5000/organizations")
        
        # Check page title
        self.assertIn("Organizations", self.driver.title)
        
        # Test search functionality
        search_input = self.driver.find_element(By.CSS_SELECTOR, ".search-bar input")
        search_button = self.driver.find_element(By.CSS_SELECTOR, ".search-bar button")
        
        search_input.clear()
        search_input.send_keys("Innocence")
        search_button.click()
        
        # Wait for results to update
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".resource-card"))
        )
        
        # Check that search results contain the search term
        resource_titles = self.driver.find_elements(By.CSS_SELECTOR, ".resource-title")
        found_match = False
        for title in resource_titles:
            if "Innocence" in title.text:
                found_match = True
                break
        self.assertTrue(found_match, "Search results should contain the search term")
        
        # Test filter functionality
        filter_checkboxes = self.driver.find_elements(By.CSS_SELECTOR, ".filter-checkbox input")
        if filter_checkboxes:
            # Select the first filter option
            filter_checkboxes[0].click()
            
            # Click apply filters button
            apply_button = self.driver.find_element(By.CSS_SELECTOR, ".apply-filters")
            apply_button.click()
            
            # Wait for results to update
            time.sleep(2)
            
            # Check that filter tags are displayed
            filter_tags = self.driver.find_elements(By.CSS_SELECTOR, ".filter-tag")
            self.assertGreater(len(filter_tags), 0, "Filter tags should be displayed after applying filters")
            
            # Test clearing filters
            clear_button = self.driver.find_element(By.CSS_SELECTOR, ".clear-filters")
            clear_button.click()
            
            # Wait for results to update
            time.sleep(2)
            
            # Check that all checkboxes are unchecked
            filter_checkboxes = self.driver.find_elements(By.CSS_SELECTOR, ".filter-checkbox input")
            for checkbox in filter_checkboxes:
                self.assertFalse(checkbox.is_selected(), "Checkboxes should be unchecked after clearing filters")
    
    def test_resources_page_functionality(self):
        """Test the resources page functionality"""
        self.driver.get("http://localhost:5000/resources")
        
        # Check page title
        self.assertIn("Resources", self.driver.title)
        
        # Check for featured resources section
        featured_section = self.driver.find_elements(By.CSS_SELECTOR, ".featured-resources")
        self.assertGreater(len(featured_section), 0, "Featured resources section should be present")
        
        # Test sorting functionality
        sort_select = self.driver.find_element(By.CSS_SELECTOR, "#sort-by")
        sort_options = self.driver.find_elements(By.CSS_SELECTOR, "#sort-by option")
        
        # Check that sort options exist
        self.assertGreater(len(sort_options), 0, "Sort options should be available")
        
        # Select a different sort option
        for option in sort_options:
            if option.get_attribute("value") == "date-desc":
                option.click()
                break
        
        # Wait for results to update
        time.sleep(2)
        
        # Check that results are displayed
        resource_cards = self.driver.find_elements(By.CSS_SELECTOR, ".resource-card")
        self.assertGreater(len(resource_cards), 0, "Resource cards should be displayed after sorting")
    
    def test_pagination_functionality(self):
        """Test pagination functionality"""
        self.driver.get("http://localhost:5000/organizations")
        
        # Check if pagination exists
        pagination = self.driver.find_elements(By.CSS_SELECTOR, ".pagination")
        if not pagination:
            self.skipTest("Pagination not present, possibly not enough items to paginate")
        
        # Get initial results
        initial_cards = self.driver.find_elements(By.CSS_SELECTOR, ".resource-card")
        initial_count = len(initial_cards)
        
        # Click next page button if enabled
        next_button = self.driver.find_element(By.CSS_SELECTOR, ".pagination-next")
        if not next_button.get_attribute("disabled"):
            next_button.click()
            
            # Wait for page to update
            time.sleep(2)
            
            # Check that results have changed
            new_cards = self.driver.find_elements(By.CSS_SELECTOR, ".resource-card")
            new_titles = [card.find_element(By.CSS_SELECTOR, ".resource-title").text for card in new_cards]
            initial_titles = [card.find_element(By.CSS_SELECTOR, ".resource-title").text for card in initial_cards]
            
            self.assertNotEqual(new_titles, initial_titles, "Results should change after pagination")
            
            # Test previous page button
            prev_button = self.driver.find_element(By.CSS_SELECTOR, ".pagination-prev")
            prev_button.click()
            
            # Wait for page to update
            time.sleep(2)
            
            # Check that we're back to the initial results
            current_cards = self.driver.find_elements(By.CSS_SELECTOR, ".resource-card")
            current_titles = [card.find_element(By.CSS_SELECTOR, ".resource-title").text for card in current_cards]
            
            self.assertEqual(len(current_cards), initial_count, "Number of results should match initial count")
    
    def test_url_parameter_persistence(self):
        """Test that URL parameters persist and reflect the current state"""
        self.driver.get("http://localhost:5000/organizations")
        
        # Apply a search term
        search_input = self.driver.find_element(By.CSS_SELECTOR, ".search-bar input")
        search_button = self.driver.find_element(By.CSS_SELECTOR, ".search-bar button")
        
        search_input.clear()
        search_input.send_keys("Innocence")
        search_button.click()
        
        # Wait for results to update
        time.sleep(2)
        
        # Check that URL contains the search parameter
        current_url = self.driver.current_url
        self.assertIn("search=Innocence", current_url, "URL should contain search parameter")
        
        # Apply a sort option
        sort_select = self.driver.find_element(By.CSS_SELECTOR, "#sort-by")
        for option in sort_select.find_elements(By.TAG_NAME, "option"):
            if option.get_attribute("value") == "name-desc":
                option.click()
                break
        
        # Wait for results to update
        time.sleep(2)
        
        # Check that URL contains both parameters
        current_url = self.driver.current_url
        self.assertIn("search=Innocence", current_url, "URL should maintain search parameter")
        self.assertIn("sort=name-desc", current_url, "URL should contain sort parameter")
        
        # Reload the page with the current URL
        self.driver.get(current_url)
        
        # Wait for page to load
        time.sleep(2)
        
        # Check that the search input still has the search term
        search_input = self.driver.find_element(By.CSS_SELECTOR, ".search-bar input")
        self.assertEqual(search_input.get_attribute("value"), "Innocence", "Search input should maintain value after page reload")
        
        # Check that the sort select still has the selected option
        sort_select = self.driver.find_element(By.CSS_SELECTOR, "#sort-by")
        selected_option = sort_select.find_element(By.CSS_SELECTOR, "option:checked")
        self.assertEqual(selected_option.get_attribute("value"), "name-desc", "Sort selection should maintain value after page reload")

if __name__ == '__main__':
    unittest.main()
