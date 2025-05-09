import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="py-6 px-4 md:px-8 border-t border-gray-700 text-center text-xs text-gray-400">
    <div className="space-x-4 mb-2">
      <a href="#" className="hover:text-amber-500">About</a>
      <a href="#" className="hover:text-amber-500">Contact</a>
      <a href="#" className="hover:text-amber-500">Privacy Policy</a>
      <a href="#" className="hover:text-amber-500">License (MIT)</a>
    </div>
    <p>&copy; {new Date().getFullYear()} The Innocence Archive. All rights reserved.</p>
  </footer>
);

export default Footer;