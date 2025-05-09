import React from 'react';
import { ExternalLink, ChevronRight, Book, Film, Mic, Info, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';

// Gets the appropriate icon based on media type
const getTypeIcon = (type) => {
  switch (type) {
    case 'Book': return <Book size={24} className="mr-2" />;
    case 'Film': return <Film size={24} className="mr-2" />;
    case 'Podcast Series': return <Mic size={24} className="mr-2" />;
    case 'Podcast Episode': return <Mic size={14} className="mr-2 flex-shrink-0" />;
    case 'Newspaper Article': return <Newspaper size={14} className="mr-2 flex-shrink-0" />;
    default: return <Info size={24} className="mr-2" />;
  }
};
export default getTypeIcon;