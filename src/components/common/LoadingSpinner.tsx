import { motion } from 'motion/react';

export default function LoadingSpinner({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center p-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ width: size, height: size }}
        className="rounded-full border-4 border-gray-200 border-t-primary"
      />
    </div>
  );
}
