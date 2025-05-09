#!/usr/bin/env python3
"""
Performance test script for Wrongfully Convicted Americans website
This script tests the performance and load handling capabilities of the website
"""

import os
import sys
import time
import unittest
import requests
import statistics
import concurrent.futures
import matplotlib.pyplot as plt
import numpy as np
from tqdm import tqdm

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class PerformanceTestCase(unittest.TestCase):
    """Test case for website performance"""
    
    BASE_URL = "http://localhost:5000"
    
    def setUp(self):
        """Set up test environment"""
        # Ensure the server is running
        try:
            response = requests.get(f"{self.BASE_URL}/")
            if response.status_code != 200:
                self.skipTest("Server is not running or not responding correctly")
        except requests.exceptions.ConnectionError:
            self.skipTest("Server is not running")
    
    def test_page_load_times(self):
        """Test page load times for different pages"""
        pages = [
            "/",
            "/browse",
            "/resources",
            "/organizations",
            "/exoneree/1"
        ]
        
        results = {}
        
        for page in pages:
            load_times = []
            
            # Make multiple requests to get average load time
            for _ in range(10):
                start_time = time.time()
                response = requests.get(f"{self.BASE_URL}{page}")
                end_time = time.time()
                
                self.assertEqual(response.status_code, 200, f"Page {page} should return 200 status code")
                
                load_time = end_time - start_time
                load_times.append(load_time)
            
            # Calculate statistics
            avg_load_time = statistics.mean(load_times)
            median_load_time = statistics.median(load_times)
            min_load_time = min(load_times)
            max_load_time = max(load_times)
            
            results[page] = {
                "avg": avg_load_time,
                "median": median_load_time,
                "min": min_load_time,
                "max": max_load_time
            }
            
            print(f"Page {page} load times (seconds):")
            print(f"  Average: {avg_load_time:.4f}")
            print(f"  Median: {median_load_time:.4f}")
            print(f"  Min: {min_load_time:.4f}")
            print(f"  Max: {max_load_time:.4f}")
            
            # Assert that average load time is under threshold
            self.assertLess(avg_load_time, 1.0, f"Average load time for {page} should be under 1 second")
        
        # Generate load time chart
        self.generate_load_time_chart(results)
    
    def test_api_response_times(self):
        """Test API endpoint response times"""
        endpoints = [
            "/api/exonerees",
            "/api/media",
            "/api/organizations"
        ]
        
        results = {}
        
        for endpoint in endpoints:
            response_times = []
            
            # Make multiple requests to get average response time
            for _ in range(10):
                start_time = time.time()
                response = requests.get(f"{self.BASE_URL}{endpoint}")
                end_time = time.time()
                
                self.assertEqual(response.status_code, 200, f"API endpoint {endpoint} should return 200 status code")
                
                response_time = end_time - start_time
                response_times.append(response_time)
            
            # Calculate statistics
            avg_response_time = statistics.mean(response_times)
            median_response_time = statistics.median(response_times)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
            
            results[endpoint] = {
                "avg": avg_response_time,
                "median": median_response_time,
                "min": min_response_time,
                "max": max_response_time
            }
            
            print(f"API endpoint {endpoint} response times (seconds):")
            print(f"  Average: {avg_response_time:.4f}")
            print(f"  Median: {median_response_time:.4f}")
            print(f"  Min: {min_response_time:.4f}")
            print(f"  Max: {max_response_time:.4f}")
            
            # Assert that average response time is under threshold
            self.assertLess(avg_response_time, 0.5, f"Average response time for {endpoint} should be under 0.5 seconds")
        
        # Generate response time chart
        self.generate_api_response_chart(results)
    
    def test_concurrent_requests(self):
        """Test handling of concurrent requests"""
        num_requests = 50
        url = f"{self.BASE_URL}/organizations"
        
        response_times = []
        successful_requests = 0
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            # Submit concurrent requests
            futures = [executor.submit(self.make_request, url) for _ in range(num_requests)]
            
            # Process results as they complete
            for future in tqdm(concurrent.futures.as_completed(futures), total=num_requests, desc="Concurrent requests"):
                result = future.result()
                if result["success"]:
                    response_times.append(result["time"])
                    successful_requests += 1
        
        success_rate = (successful_requests / num_requests) * 100
        
        print(f"Concurrent requests test results:")
        print(f"  Success rate: {success_rate:.2f}%")
        if response_times:
            print(f"  Average response time: {statistics.mean(response_times):.4f} seconds")
            print(f"  Median response time: {statistics.median(response_times):.4f} seconds")
            print(f"  Min response time: {min(response_times):.4f} seconds")
            print(f"  Max response time: {max(response_times):.4f} seconds")
        
        # Assert that success rate is high
        self.assertGreaterEqual(success_rate, 95.0, "Success rate should be at least 95%")
        
        # Generate concurrent requests chart
        self.generate_concurrent_requests_chart(response_times)
    
    def make_request(self, url):
        """Make a request and return success status and response time"""
        try:
            start_time = time.time()
            response = requests.get(url)
            end_time = time.time()
            
            return {
                "success": response.status_code == 200,
                "time": end_time - start_time
            }
        except Exception:
            return {
                "success": False,
                "time": 0
            }
    
    def generate_load_time_chart(self, results):
        """Generate a chart of page load times"""
        try:
            plt.figure(figsize=(10, 6))
            
            pages = list(results.keys())
            avg_times = [results[page]["avg"] for page in pages]
            min_times = [results[page]["min"] for page in pages]
            max_times = [results[page]["max"] for page in pages]
            
            x = np.arange(len(pages))
            width = 0.25
            
            plt.bar(x - width, avg_times, width, label='Average')
            plt.bar(x, min_times, width, label='Min')
            plt.bar(x + width, max_times, width, label='Max')
            
            plt.xlabel('Pages')
            plt.ylabel('Load Time (seconds)')
            plt.title('Page Load Times')
            plt.xticks(x, [page if page != "/" else "/home" for page in pages])
            plt.legend()
            
            plt.tight_layout()
            plt.savefig('page_load_times.png')
            print("Page load times chart saved as 'page_load_times.png'")
        except Exception as e:
            print(f"Error generating chart: {e}")
    
    def generate_api_response_chart(self, results):
        """Generate a chart of API response times"""
        try:
            plt.figure(figsize=(10, 6))
            
            endpoints = list(results.keys())
            avg_times = [results[endpoint]["avg"] for endpoint in endpoints]
            min_times = [results[endpoint]["min"] for endpoint in endpoints]
            max_times = [results[endpoint]["max"] for endpoint in endpoints]
            
            x = np.arange(len(endpoints))
            width = 0.25
            
            plt.bar(x - width, avg_times, width, label='Average')
            plt.bar(x, min_times, width, label='Min')
            plt.bar(x + width, max_times, width, label='Max')
            
            plt.xlabel('API Endpoints')
            plt.ylabel('Response Time (seconds)')
            plt.title('API Response Times')
            plt.xticks(x, endpoints)
            plt.legend()
            
            plt.tight_layout()
            plt.savefig('api_response_times.png')
            print("API response times chart saved as 'api_response_times.png'")
        except Exception as e:
            print(f"Error generating chart: {e}")
    
    def generate_concurrent_requests_chart(self, response_times):
        """Generate a histogram of response times for concurrent requests"""
        try:
            if not response_times:
                return
            
            plt.figure(figsize=(10, 6))
            
            plt.hist(response_times, bins=20, alpha=0.7, color='blue')
            plt.axvline(statistics.mean(response_times), color='red', linestyle='dashed', linewidth=1, label=f'Mean: {statistics.mean(response_times):.4f}s')
            plt.axvline(statistics.median(response_times), color='green', linestyle='dashed', linewidth=1, label=f'Median: {statistics.median(response_times):.4f}s')
            
            plt.xlabel('Response Time (seconds)')
            plt.ylabel('Frequency')
            plt.title('Response Time Distribution for Concurrent Requests')
            plt.legend()
            
            plt.tight_layout()
            plt.savefig('concurrent_requests.png')
            print("Concurrent requests chart saved as 'concurrent_requests.png'")
        except Exception as e:
            print(f"Error generating chart: {e}")

if __name__ == '__main__':
    unittest.main()
