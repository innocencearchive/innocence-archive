// Statistics Module
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import {  BarChart3} from 'lucide-react';
import ModuleCard from './ModuleCard'; // Assuming it's in the same directory

const StatsModule = ({ stats }) => (
  <ModuleCard title="By the Numbers" icon={BarChart3} seeMoreLink="#" seeMoreText="More Statistics">
    <ul className="space-y-2">
      {stats.map(stat => (
        <li key={stat.id}>{stat.text}</li>
      ))}
    </ul>
  </ModuleCard>
);

export default StatsModule;