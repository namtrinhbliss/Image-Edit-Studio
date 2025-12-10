
import React from 'react';
import { Spinner } from './ui/Spinner';
import { DownloadIcon, ImageIcon, XMarkIcon, MagicWandIcon } from './ui/Icon';

interface ImageDisplayProps {
    isLoading: boolean;
    loadingMessage: string;
    imageSrcs: string[];
    error: string | null;
    timer: number;
    onSelectImage?: (src: string) => void;
    selectedImageSrc?: string | null;
}

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ 
    isLoading, 
    loadingMessage, 
    imageSrcs, 
    error, 
    timer,
    onSelectImage,
    selectedImageSrc 
}) => {

    return (
        <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl min-h-[400px] flex items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 transition-colors duration-300">
            {isLoading && (
                <div className="text-center text-slate-600 dark:text-slate-300">
                    <Spinner />
                    <p className="mt-4 text-lg font-medium text-slate-800 dark:text-slate-200">{loadingMessage || 'Đang xử lý...'}</p>
                    <p className="font-mono text-2xl my-2 text-amber-600 dark:text-amber-500" aria-live="assertive">{formatTime(timer)}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Quá trình xử lý nhiều ảnh có thể mất vài phút.</p>
                </div>
            )}
            
            {error && !isLoading && (
                <div className="text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-100 dark:border-red-900/30 max-w-lg">
                    <XMarkIcon className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <p className="font-bold text-lg">Đã xảy ra lỗi</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            )}

            {!isLoading && imageSrcs.length > 0 && (
                 <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {imageSrcs.map((src, index) => {
                         const isSelected = selectedImageSrc === src;
                         return (
                             <div 
                                key={index} 
                                className={`group relative bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg hover:shadow-xl transition-all border ${isSelected ? 'border-amber-500 ring-2 ring-amber-200 dark:ring-amber-900' : 'border-slate-100 dark:border-slate-700'}`}
                             >
                                 <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 dark:bg-slate-900 relative">
                                    <img 
                                        src={src} 
                                        alt={`Generated ${index + 1}`} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                    />
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                            <span className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold shadow-sm">Đang chọn</span>
                                        </div>
                                    )}
                                 </div>
                                 
                                 <div className="mt-4 flex justify-between items-center px-1">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">IMAGE #{index + 1}</span>
                                    <div className="flex gap-2">
                                        {onSelectImage && (
                                            <button
                                                onClick={() => onSelectImage(src)}
                                                className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors font-medium ${isSelected ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                                title="Chọn ảnh này để chỉnh sửa thêm"
                                            >
                                                <MagicWandIcon className="w-3 h-3" />
                                                {isSelected ? 'Đang chỉnh' : 'Chỉnh tiếp'}
                                            </button>
                                        )}
                                        <a
                                            href={src}
                                            download={`premium-ai-art-${index}-${new Date().getTime()}.png`}
                                            className="text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1 transition-opacity font-medium"
                                            title="Tải ảnh về máy"
                                        >
                                            <DownloadIcon className="w-3 h-3"/>
                                            Tải về
                                        </a>
                                    </div>
                                 </div>
                             </div>
                         );
                     })}
                </div>
            )}

            {!isLoading && imageSrcs.length === 0 && !error && (
                <div className="text-center text-slate-400 dark:text-slate-500">
                    <ImageIcon className="w-24 h-24 mx-auto mb-4 opacity-50"/>
                    <p className="text-xl font-bold text-slate-600 dark:text-slate-300">Kết quả sẽ xuất hiện ở đây</p>
                    <p className="text-sm mt-2 max-w-sm mx-auto">Tải ảnh sản phẩm và người mẫu lên, chọn cấu hình và nhấn nút Tạo ảnh để bắt đầu.</p>
                </div>
            )}
        </div>
    );
};
