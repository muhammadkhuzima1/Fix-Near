import React from 'react';
import { ServiceCategory } from '../../types';
import {
  Droplets,
  Zap,
  Wind,
  Tv,
  Hammer,
  Wrench,
} from 'lucide-react';

interface CategoryIconProps {
  category: ServiceCategory | string;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = 'w-4 h-4',
}) => {
  switch (category) {
    case 'plumbing':
      return <Droplets className={className} />;
    case 'electrical':
      return <Zap className={className} />;
    case 'hvac':
      return <Wind className={className} />;
    case 'appliance':
      return <Tv className={className} />;
    case 'carpentry':
      return <Hammer className={className} />;
    default:
      return <Wrench className={className} />;
  }
};
