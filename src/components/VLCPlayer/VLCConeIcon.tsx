import React from "react";

interface VLCConeIconProps {
  className?: string;
  size?: number;
}

export const VLCConeIcon: React.FC<VLCConeIconProps> = ({ className = "w-6 h-6", size }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      {/* Base shadow */}
      <ellipse cx="24" cy="43" rx="18" ry="3.5" fill="rgba(0, 0, 0, 0.4)" />
      
      {/* Base Platform */}
      <path
        d="M6 42C6 40.5 8 39 24 39C40 39 42 40.5 42 42C42 43.5 40 45 24 45C8 45 6 43.5 6 42Z"
        fill="#E65100"
      />
      <path
        d="M8 41.5C9.5 40.5 15 39.8 24 39.8C33 39.8 38.5 40.5 40 41.5C38.5 42.5 33 43.2 24 43.2C15 43.2 9.5 42.5 8 41.5Z"
        fill="#FF8F00"
      />

      {/* Cone Body Bottom Section (Orange) */}
      <path
        d="M12.5 39L15.5 30H32.5L35.5 39C32 40.5 27 41 24 41C21 41 16 40.5 12.5 39Z"
        fill="#FF6D00"
      />
      {/* Cone Body Lower-Middle Stripe (White) */}
      <path
        d="M15.5 30L18 22.5H30L32.5 30C29.8 31 26 31.4 24 31.4C22 31.4 18.2 31 15.5 30Z"
        fill="#F5F5F5"
      />
      {/* Stripe shadow */}
      <path
        d="M16 29L18 23H30L32 29C29.5 29.8 26.5 30.2 24 30.2C21.5 30.2 18.5 29.8 16 29Z"
        fill="#E0E0E0"
      />

      {/* Cone Body Upper-Middle Section (Orange) */}
      <path
        d="M18 22.5L20 15H28L30 22.5C28 23.3 25.5 23.6 24 23.6C22.5 23.6 20 23.3 18 22.5Z"
        fill="#FF7A00"
      />

      {/* Cone Body Top Stripe (White) */}
      <path
        d="M20 15L21.8 8.5H26.2L28 15C26.7 15.6 25.2 15.8 24 15.8C22.8 15.8 21.3 15.6 20 15Z"
        fill="#FFFFFF"
      />

      {/* Cone Tip (Orange Rounded Top) */}
      <path
        d="M21.8 8.5C22.4 6.2 23.1 5 24 5C24.9 5 25.6 6.2 26.2 8.5C25.4 8.8 24.6 9 24 9C23.4 9 22.6 8.8 21.8 8.5Z"
        fill="#FF9E1B"
      />

      {/* Highlights for 3D realism */}
      <path
        d="M20.5 9.5L16.5 22L13.8 31L11.5 39C10.5 38.6 9.8 38.2 9.5 37.8L19.5 6.5C20.5 6.8 21.2 7.8 21.8 9.5H20.5Z"
        fill="white"
        fillOpacity="0.25"
      />
    </svg>
  );
};
