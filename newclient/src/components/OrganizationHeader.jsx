import React from 'react';

import { Building, MapPin} from 'lucide-react';

import { BRONZE_COLOR } from './themeconstants.js';

const OrganizationHeader = ({ name, type, location }) => (
  <div className="mb-6 text-center border-b border-gray-700 pb-6">
     <div className={`inline-flex items-center justify-center ${BRONZE_COLOR} mb-2`}>
        <Building size={20} className="mr-2" />
        <span className="text-sm uppercase tracking-wider">{type}</span>
     </div>
    <h1 className="text-3xl md:text-4xl font-bold text-gray-50 mb-2">{name}</h1>
    {location && (
        <p className="text-md text-gray-400 flex items-center justify-center">
            <MapPin size={16} className="mr-1" /> {location}
        </p>
    )}
  </div>
);

export default OrganizationHeader;