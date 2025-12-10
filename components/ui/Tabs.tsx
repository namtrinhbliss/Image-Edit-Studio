
import React from 'react';

interface Tab {
    id: string;
    label: string;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    setActiveTab: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, setActiveTab }) => {
    return (
        <div>
            <div className="border-b border-gray-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm uppercase tracking-wide
                                transition-all duration-200
                                ${
                                    activeTab === tab.id
                                        ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-600'
                                }
                            `}
                            aria-current={activeTab === tab.id ? 'page' : undefined}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
        </div>
    );
};
