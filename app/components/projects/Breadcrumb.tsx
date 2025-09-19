import { motion } from 'framer-motion';

interface BreadcrumbProps {
  items: Array<{
    label: string;
    onClick?: () => void;
  }>;
}

export const Breadcrumb = ({ items }: BreadcrumbProps) => {
  return (
    <nav className="flex items-center space-x-2 text-sm mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <span className="text-bolt-elements-textTertiary mx-2">{'>'}</span>}
          {item.onClick ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={item.onClick}
              className="text-blue-500 hover:text-blue-600 hover:underline transition-colors bg-transparent px-2 py-1 rounded"
            >
              {item.label}
            </motion.button>
          ) : (
            <span className="text-bolt-elements-textSecondary font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
};
