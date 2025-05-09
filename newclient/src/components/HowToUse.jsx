// How to Use Section
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import {BRONZE_COLOR} from './themeconstants';
const HowToUse = () => (
  <section aria-labelledby="how-to-use-title" className="py-8 px-4 md:px-8 bg-gray-800 border-t border-gray-700">
     <h2 id="how-to-use-title" className="text-xl font-semibold text-gray-50 mb-4 text-center">How to Use This Archive</h2>
     <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm">
       <div>
         <h3 className={`font-medium ${BRONZE_COLOR} mb-1`}>For Journalists</h3>
         <p className="text-gray-300">Find background info, case summaries, and leads on underreported stories.</p>
       </div>
       <div>
         <h3 className={`font-medium ${BRONZE_COLOR} mb-1`}>For Researchers</h3>
         <p className="text-gray-300">Explore case details, contributing factors, and access structured data (API coming soon).</p>
       </div>
       <div>
         <h3 className={`font-medium ${BRONZE_COLOR} mb-1`}>For Students & Public</h3>
         <p className="text-gray-300">Learn through individual narratives, media analysis, and explore systemic issues.</p>
       </div>
     </div>
  </section>
);

export default HowToUse;