#!/usr/bin/env python3
"""
Test script for Wrongfully Convicted Americans website functionality
This script tests various components of the website to ensure they work correctly
"""

import os
import sys
import unittest
import sqlite3
import json
import requests
from flask import Flask
from flask_testing import TestCase

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app

class WebsiteTestCase(TestCase):
    """Test case for the website functionality"""
    
    def create_app(self):
        """Create and configure a Flask app for testing"""
        app.config['TESTING'] = True
        app.config['DATABASE'] = 'test_wrongfully_convicted.db'
        return app
    
    def setUp(self):
        """Set up test database and client"""
        # Create test database
        self.db_conn = sqlite3.connect('test_wrongfully_convicted.db')
        self.create_test_database()
        
        # Create test client
        self.client = self.app.test_client()
    
    def tearDown(self):
        """Clean up after tests"""
        self.db_conn.close()
        os.remove('test_wrongfully_convicted.db')
    
    def create_test_database(self):
        """Create test database with sample data"""
        cursor = self.db_conn.cursor()
        
        # Execute schema.sql
        with open('../database/schema.sql', 'r') as f:
            schema_sql = f.read()
            cursor.executescript(schema_sql)
        
        # Execute schema_update.sql
        with open('../database/schema_update.sql', 'r') as f:
            schema_update_sql = f.read()
            cursor.executescript(schema_update_sql)
        
        # Insert test data
        self.insert_test_data()
        
        self.db_conn.commit()
    
    def insert_test_data(self):
        """Insert test data into the database"""
        cursor = self.db_conn.cursor()
        
        # Insert test exonerees
        cursor.executemany(
            """INSERT INTO exonerees 
               (first_name, last_name, state, county, worst_crime, convicted_year, exonerated_year) 
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [
                ('John', 'Doe', 'Texas', 'Harris', 'Murder', 1995, 2010),
                ('Jane', 'Smith', 'New York', 'Kings', 'Sexual Assault', 2000, 2015),
                ('Robert', 'Johnson', 'California', 'Los Angeles', 'Robbery', 1998, 2008),
                ('Mary', 'Williams', 'Illinois', 'Cook', 'Drug Possession', 2005, 2012),
                ('James', 'Brown', 'Florida', 'Miami-Dade', 'Murder', 1990, 2020)
            ]
        )
        
        # Insert test organizations
        cursor.executemany(
            """INSERT INTO organizations
               (name, description, website, phone, email, address, focus_area, year_founded)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                ('Innocence Project', 'Works to exonerate the wrongfully convicted through DNA testing.', 
                 'https://innocenceproject.org', '212-364-5340', 'info@innocenceproject.org', 
                 '40 Worth Street, Suite 701, New York, NY 10013', 'Legal Advocacy', 1992),
                ('Center on Wrongful Convictions', 'Dedicated to identifying and rectifying wrongful convictions.', 
                 'https://www.law.northwestern.edu/legalclinic/wrongfulconvictions/', '312-503-2391', 
                 'cwc@law.northwestern.edu', '375 E. Chicago Avenue, Chicago, IL 60611', 'Legal Advocacy', 1998),
                ('After Innocence', 'Provides reentry support and advocacy for exonerees.', 
                 'https://www.after-innocence.org', '415-307-3386', 'info@after-innocence.org', 
                 'Oakland, CA 94612', 'Support Services', 2004)
            ]
        )
        
        # Insert test media resources
        cursor.executemany(
            """INSERT INTO media_resources
               (title, media_type_id, creator, publication_date, url, description)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                ('When Justice Fails', 1, 'Sarah Johnson', '2020-05-15', 
                 'https://example.com/podcast1', 'A podcast about wrongful convictions'),
                ('Innocent Behind Bars', 2, 'Michael Roberts', '2018-10-20', 
                 'https://example.com/book1', 'A book examining cases of wrongful conviction'),
                ('The Exoneration Files', 4, 'HBO', '2021-03-10', 
                 'https://example.com/documentary1', 'Documentary series on wrongful convictions')
            ]
        )
        
        # Insert test relationships
        cursor.executemany(
            """INSERT INTO exoneree_organizations
               (exoneree_id, organization_id, assistance_type, assistance_year)
               VALUES (?, ?, ?, ?)""",
            [
                (1, 1, 'Legal Representation', 2008),
                (2, 1, 'Legal Representation', 2012),
                (3, 2, 'Legal Representation', 2006),
                (4, 3, 'Reentry Support', 2012),
                (5, 2, 'Legal Representation', 2018)
            ]
        )
        
        cursor.executemany(
            """INSERT INTO exoneree_media
               (exoneree_id, media_id)
               VALUES (?, ?)""",
            [
                (1, 1),
                (1, 3),
                (2, 2),
                (3, 1),
                (5, 3)
            ]
        )
    
    def test_home_page(self):
        """Test that the home page loads correctly"""
        response = self.client.get('/')
        self.assert200(response)
        self.assert_template_used('home.html')
    
    def test_browse_page(self):
        """Test that the browse page loads correctly"""
        response = self.client.get('/browse')
        self.assert200(response)
        self.assert_template_used('browse.html')
    
    def test_exoneree_detail_page(self):
        """Test that the exoneree detail page loads correctly"""
        response = self.client.get('/exoneree/1')
        self.assert200(response)
        self.assert_template_used('exoneree_detail.html')
        
        # Test invalid exoneree ID
        response = self.client.get('/exoneree/999')
        self.assert404(response)
    
    def test_resources_page(self):
        """Test that the resources page loads correctly"""
        response = self.client.get('/resources')
        self.assert200(response)
        self.assert_template_used('resources.html')
        
        # Check that media types are passed to the template
        self.assertIn('media_types', response.get_data(as_text=True))
        
        # Check that featured resources are displayed
        self.assertIn('featured_resources', response.get_data(as_text=True))
    
    def test_organizations_page(self):
        """Test that the organizations page loads correctly"""
        response = self.client.get('/organizations')
        self.assert200(response)
        self.assert_template_used('organizations.html')
        
        # Check that organization types are passed to the template
        self.assertIn('organization_types', response.get_data(as_text=True))
        
        # Check that featured organizations are displayed
        self.assertIn('featured_organizations', response.get_data(as_text=True))
    
    def test_api_exonerees(self):
        """Test the exonerees API endpoint"""
        response = self.client.get('/api/exonerees')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        
        # Check that we get a list of exonerees
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        
        # Check filtering by name
        response = self.client.get('/api/exonerees?name=John')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['first_name'], 'John')
        
        # Check filtering by state
        response = self.client.get('/api/exonerees?state=Texas')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['state'], 'Texas')
    
    def test_api_media(self):
        """Test the media API endpoint"""
        response = self.client.get('/api/media')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        
        # Check that we get a list of media resources
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        
        # Check filtering by title
        response = self.client.get('/api/media?title=Justice')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        self.assertEqual(len(data), 1)
        self.assertIn('Justice', data[0]['title'])
        
        # Check sorting
        response = self.client.get('/api/media?sort=date-desc')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        self.assertGreater(len(data), 1)
        # Verify dates are in descending order
        for i in range(len(data) - 1):
            if data[i]['publication_date'] and data[i+1]['publication_date']:
                self.assertGreaterEqual(data[i]['publication_date'], data[i+1]['publication_date'])
    
    def test_api_organizations(self):
        """Test the organizations API endpoint"""
        response = self.client.get('/api/organizations')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        
        # Check that we get organizations data
        self.assertIsInstance(data, dict)
        self.assertIn('organizations', data)
        self.assertIn('total', data)
        self.assertGreater(data['total'], 0)
        
        # Check filtering by name
        response = self.client.get('/api/organizations?name=Innocence')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        self.assertEqual(len(data['organizations']), 1)
        self.assertIn('Innocence', data['organizations'][0]['name'])
        
        # Check filtering by organization type
        response = self.client.get('/api/organizations?org_type=Legal Advocacy')
        self.assert200(response)
        data = json.loads(response.get_data(as_text=True))
        self.assertGreater(len(data['organizations']), 0)
        for org in data['organizations']:
            self.assertEqual(org['org_type'], 'Legal Advocacy')
    
    def test_static_files(self):
        """Test that static files are served correctly"""
        # Test CSS file
        response = self.client.get('/static/css/styles.css')
        self.assert200(response)
        self.assertEqual(response.content_type, 'text/css; charset=utf-8')
        
        # Test JavaScript files
        response = self.client.get('/static/js/organizations.js')
        self.assert200(response)
        self.assertEqual(response.content_type, 'application/javascript; charset=utf-8')
        
        response = self.client.get('/static/js/data-analysis.js')
        self.assert200(response)
        self.assertEqual(response.content_type, 'application/javascript; charset=utf-8')
    
    def test_error_handling(self):
        """Test error handling for invalid routes"""
        response = self.client.get('/nonexistent-page')
        self.assert404(response)

if __name__ == '__main__':
    unittest.main()
