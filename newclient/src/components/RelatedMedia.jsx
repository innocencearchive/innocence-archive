import React from 'react';
import { Link } from 'react-router-dom';
import getTypeIcon from './getTypeIcon';
import { BookOpen } from 'lucide-react'; // Assuming lucide-react
import { BRONZE_COLOR, BRONZE_BORDER, BRONZE_BG } from './themeConstants';

const RelatedMediaList = ({ items }) => {
    if (!items || items.length === 0) return null;
    return (
      <section aria-label="Related Media" className="mb-8">
         <h3 className={`text-lg font-semibold ${BRONZE_COLOR} mb-3 flex items-center`}>
            {/* Using BookOpen as a generic media icon here */}
           <BookOpen className="mr-2" size={20} /> Related Media
         </h3>
         <ul className="list-none text-sm text-gray-300 space-y-2 ml-1">
           {items.map(item => (
             <li key={item.id} className="flex items-center">
                {getTypeIcon(item.type)}
               {/* Link to MediaWorkPage or MediaItemPage based on item.linkType */}
               <Link to={`/${item.linkType}/${item.id}`} className="hover:text-amber-500 hover:underline">
                 {item.title} <span className="text-xs text-gray-400 ml-1">({item.type})</span>
               </Link>
             </li>
           ))}
         </ul>
      </section>
    );
  };
export default RelatedMediaList;