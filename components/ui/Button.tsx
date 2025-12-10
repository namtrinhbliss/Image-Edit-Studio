
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    className?: string;
}

export const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => {
    return (
        <button
            {...props}
            className={`
                inline-flex items-center justify-center px-6 py-3 border border-transparent 
                text-base font-medium rounded-md shadow-sm text-white 
                bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 
                focus:ring-offset-2 focus:ring-amber-500 transition-all duration-300
                disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105
                ${className}
            `}
        >
            {children}
        </button>
    );
};
