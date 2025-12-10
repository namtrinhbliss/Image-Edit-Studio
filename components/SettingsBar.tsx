import React, { useState } from 'react';
import { SettingsIcon, KeyIcon, TrashIcon, XMarkIcon } from './ui/Icon';

interface SettingsBarProps {
    model: string;
    onModelChange: (model: string) => void;
    useCustomKey: boolean;
    setUseCustomKey: (use: boolean) => void;
    customApiKey: string;
    setCustomApiKey: (key: string) => void;
}

const HelpModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 animate-fade-in flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-800">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <KeyIcon className="w-6 h-6 text-amber-500" />
                        Hướng dẫn lấy API Key Gemini (Miễn phí)
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-slate-700 dark:text-slate-300">
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full flex items-center justify-center font-bold">1</span>
                            <div>
                                <p className="font-semibold mb-1">Truy cập Google AI Studio</p>
                                <p className="text-sm opacity-80">Truy cập đường dẫn: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">https://aistudio.google.com/app/apikey</a></p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full flex items-center justify-center font-bold">2</span>
                            <div>
                                <p className="font-semibold mb-1">Đăng nhập & Tạo Key</p>
                                <p className="text-sm opacity-80">Đăng nhập bằng tài khoản Google. Nhấn nút <strong className="bg-gray-100 dark:bg-slate-800 px-1 rounded">Create API key</strong>.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full flex items-center justify-center font-bold">3</span>
                            <div>
                                <p className="font-semibold mb-1">Sao chép Key</p>
                                <p className="text-sm opacity-80">Chọn dự án mới hoặc có sẵn, sau đó sao chép chuỗi ký tự API Key vừa tạo.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full flex items-center justify-center font-bold">4</span>
                            <div>
                                <p className="font-semibold mb-1">Dán vào ứng dụng</p>
                                <p className="text-sm opacity-80">Quay lại đây, chọn chế độ "API Riêng" và dán Key vào ô nhập liệu.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50 text-sm">
                        <strong className="text-amber-800 dark:text-amber-400 block mb-1">Lưu ý:</strong>
                        Google cung cấp gói miễn phí khá hào phóng. Tuy nhiên, nếu bạn gặp lỗi 429 (Too Many Requests), hãy chờ một chút hoặc tạo một Key ở tài khoản Google khác.
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Đã hiểu
                    </button>
                </div>
            </div>
        </div>
    );
};

export const SettingsBar: React.FC<SettingsBarProps> = ({ 
    model, 
    onModelChange,
    useCustomKey,
    setUseCustomKey,
    customApiKey,
    setCustomApiKey
}) => {
    const [showHelp, setShowHelp] = useState(false);

    return (
        <>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 flex flex-col xl:flex-row items-center justify-between gap-4 transition-colors duration-300">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-lg whitespace-nowrap">
                    <SettingsIcon className="w-6 h-6 text-amber-500" />
                    <span>Cấu hình AI</span>
                </div>

                <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto items-center">
                    
                    {/* Model Selector */}
                    <div className="flex flex-col gap-1 w-full md:w-auto">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Công nghệ / Model</label>
                        <select 
                            value={model}
                            onChange={(e) => onModelChange(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full md:w-64 p-2.5 transition-colors"
                        >
                            <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Nhanh)</option>
                            <option value="gemini-3-pro-image-preview">Gemini 3 Pro (Chất lượng cao)</option>
                        </select>
                    </div>

                    <div className="h-8 w-px bg-gray-200 dark:bg-slate-700 hidden md:block"></div>

                    {/* API Key Section */}
                    <div className="flex flex-col gap-1 w-full md:w-auto flex-1">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nguồn tài nguyên</label>
                            <button 
                                onClick={() => setShowHelp(true)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                Hướng dẫn lấy API Key
                            </button>
                        </div>
                        
                        <div className="flex gap-2">
                            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                                <button
                                    onClick={() => setUseCustomKey(false)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!useCustomKey ? 'bg-white dark:bg-slate-600 shadow text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                >
                                    Server Miễn phí
                                </button>
                                <button
                                    onClick={() => setUseCustomKey(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${useCustomKey ? 'bg-white dark:bg-slate-600 shadow text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                >
                                    API Riêng
                                </button>
                            </div>

                            {useCustomKey && (
                                <div className="relative flex-1 min-w-[200px]">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyIcon className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="password"
                                        value={customApiKey}
                                        onChange={(e) => setCustomApiKey(e.target.value)}
                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full pl-10 p-2.5 transition-colors"
                                        placeholder="Dán API Key của bạn vào đây..."
                                    />
                                    {customApiKey && (
                                        <button
                                            onClick={() => setCustomApiKey('')}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        </>
    );
};