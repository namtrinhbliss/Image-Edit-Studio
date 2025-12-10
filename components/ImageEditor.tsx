
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import type { EditImageData, ImageQuality } from '../types';
import { EditIcon, UploadIcon, XMarkIcon, RobotIcon, SparklesIcon, MagicWandIcon, PosterIcon } from './ui/Icon';
import { analyzeProductImage, generatePromptIdeas, extractProductFromImage, analyzePosterStyle } from '../services/geminiService';
import { Spinner } from './ui/Spinner';
import { base64ToFile } from '../utils/fileUtils';

interface ImageEditorProps {
    onEdit: (data: EditImageData) => void;
    isLoading: boolean;
    selectedImage?: string | null;
    onCancelSelect?: () => void;
    mode?: 'studio' | 'poster';
}

const ImageUpload: React.FC<{
    id: string;
    label: string;
    subLabel?: string;
    onFileSelect: (file: File | null) => void;
    preview: string | null;
    isOptional?: boolean;
    children?: React.ReactNode;
    className?: string;
}> = ({ id, label, subLabel, onFileSelect, preview, isOptional, children, className }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (inputRef.current) inputRef.current.value = '';
        onFileSelect(null);
    };

    return (
        <div className={`flex flex-col group w-full ${className || ''}`}>
            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {label} {isOptional && <span className="text-gray-400 dark:text-gray-500 font-normal normal-case">(tùy chọn)</span>}
                </label>
            </div>
            <div
                className={`relative flex-1 min-h-[160px] border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition-all bg-white dark:bg-slate-800 ${preview ? 'border-amber-500 dark:border-amber-500' : 'border-gray-300 dark:border-slate-600'}`}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    type="file"
                    id={id}
                    ref={inputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
                {preview ? (
                    <div className="relative w-full h-full p-2">
                         <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                         <button 
                            onClick={handleClear}
                            className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full p-1 hover:bg-red-500 transition-colors"
                         >
                            <XMarkIcon className="w-4 h-4" />
                         </button>
                    </div>
                ) : (
                    <div className="text-center text-gray-400 dark:text-gray-500 p-4">
                        <UploadIcon className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500 group-hover:text-amber-500 transition-colors" />
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Tải tệp lên</p>
                        <p className="text-xs mt-1">hoặc kéo và thả</p>
                    </div>
                )}
            </div>
             {subLabel && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">{subLabel}</p>}
             {children && <div className="mt-2">{children}</div>}
        </div>
    );
};


export const ImageEditor: React.FC<ImageEditorProps> = ({ onEdit, isLoading, selectedImage, onCancelSelect, mode = 'studio' }) => {
    const [prompt, setPrompt] = useState<string>('Nhân vật trong ảnh tải lên đang sử dụng sản phẩm trong ảnh sản phẩm tải lên trong bối cảnh phù hợp.');
    
    const [characterImage, setCharacterImage] = useState<File | null>(null);
    const [characterPreview, setCharacterPreview] = useState<string | null>(null);
    
    const [productImage, setProductImage] = useState<File | null>(null);
    const [productPreview, setProductPreview] = useState<string | null>(null);
    
    const [contextImage, setContextImage] = useState<File | null>(null);
    const [contextPreview, setContextPreview] = useState<string | null>(null);

    const [designRefImage, setDesignRefImage] = useState<File | null>(null);
    const [designRefPreview, setDesignRefPreview] = useState<string | null>(null);

    const [posterRefImage, setPosterRefImage] = useState<File | null>(null);
    const [posterRefPreview, setPosterRefPreview] = useState<string | null>(null);

    const [quality, setQuality] = useState<ImageQuality>('Standard');
    const [imageCount, setImageCount] = useState<number>(3);
    const [faceConsistency, setFaceConsistency] = useState<boolean>(true);

    const [productDescription, setProductDescription] = useState<string>('');
    const [isAnalyzingProduct, setIsAnalyzingProduct] = useState<boolean>(false);
    const [isGeneratingIdeas, setIsGeneratingIdeas] = useState<boolean>(false);
    const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
    
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [isAnalyzingPoster, setIsAnalyzingPoster] = useState<boolean>(false);

    useEffect(() => {
        if (mode === 'poster') {
             if (!prompt || prompt.includes("Nhân vật trong")) {
                 setPrompt("Thiết kế poster quảng cáo chuyên nghiệp cho hình ảnh này.");
             }
        } else if (selectedImage) {
            if (!prompt || prompt.includes("Nhân vật trong")) {
                setPrompt("Chỉnh sửa ánh sáng chuyên nghiệp, thêm chi tiết sắc nét, phối màu điện ảnh, giữ nguyên bố cục.");
            }
        } else {
            if (!prompt) {
                 setPrompt('Nhân vật trong ảnh tải lên đang sử dụng sản phẩm trong ảnh sản phẩm tải lên trong bối cảnh phù hợp.');
            }
        }
    }, [selectedImage, mode]);

    const handleFileSelect = async (file: File | null, type: 'character' | 'product' | 'context' | 'design' | 'poster') => {
        if (!file) {
            if (type === 'character') { setCharacterImage(null); setCharacterPreview(null); }
            if (type === 'product') { 
                setProductImage(null); 
                setProductPreview(null); 
                setProductDescription('');
                setSuggestedPrompts([]);
            }
            if (type === 'context') { setContextImage(null); setContextPreview(null); }
            if (type === 'design') { setDesignRefImage(null); setDesignRefPreview(null); }
            if (type === 'poster') { setPosterRefImage(null); setPosterRefPreview(null); }
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            if (type === 'character') {
                setCharacterImage(file);
                setCharacterPreview(reader.result as string);
            } else if (type === 'product') {
                setProductImage(file);
                setProductPreview(reader.result as string);
            } else if (type === 'context') {
                setContextImage(file);
                setContextPreview(reader.result as string);
            } else if (type === 'design') {
                setDesignRefImage(file);
                setDesignRefPreview(reader.result as string);
            } else if (type === 'poster') {
                setPosterRefImage(file);
                setPosterRefPreview(reader.result as string);
                
                // Auto Analyze Poster
                setIsAnalyzingPoster(true);
                setPrompt("Đang phân tích Concept Poster...");
                try {
                    const concept = await analyzePosterStyle(file);
                    setPrompt(concept);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsAnalyzingPoster(false);
                }
            }
        };
        reader.readAsDataURL(file);
    };

    const handleExtractProduct = async () => {
        if (!productImage) return;

        setIsExtracting(true);
        try {
            const extractedBase64 = await extractProductFromImage(productImage);
            
            const previewStr = `data:image/png;base64,${extractedBase64}`;
            setProductPreview(previewStr);
            
            const newFile = base64ToFile(extractedBase64, "extracted_product.png", "image/png");
            setProductImage(newFile);
            
            setProductDescription('');
            setSuggestedPrompts([]);

        } catch (error) {
            console.error(error);
            alert("Không thể tách sản phẩm. Vui lòng thử lại với ảnh khác.");
        } finally {
            setIsExtracting(false);
        }
    };

    const handleAnalyzeProduct = async () => {
        if (!productImage) return;
        
        setIsAnalyzingProduct(true);
        setProductDescription('Đang phân tích sản phẩm...');
        setSuggestedPrompts([]);
        try {
            const desc = await analyzeProductImage(productImage);
            setProductDescription(desc);
            
            if (desc && !desc.startsWith("Lỗi")) {
                handleGenerateIdeas(desc);
            }
        } catch (error) {
            setProductDescription('Không thể phân tích ảnh sản phẩm.');
        } finally {
            setIsAnalyzingProduct(false);
        }
    };

    const handleGenerateIdeas = async (descOverride?: string) => {
        const descToUse = descOverride || productDescription;
        if (!descToUse) return;
        
        setIsGeneratingIdeas(true);
        setSuggestedPrompts([]);
        try {
            const ideas = await generatePromptIdeas(descToUse, characterImage);
            setSuggestedPrompts(ideas);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGeneratingIdeas(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onEdit({ 
            prompt, 
            characterImage, 
            productImage, 
            contextImage,
            imageCount,
            quality,
            faceConsistency,
            baseImage: selectedImage,
            designRefImage: designRefImage,
            posterReferenceImage: posterRefImage,
            autoRemoveBackground: false 
        });
    };

    const isStudioMode = mode === 'studio' && !selectedImage;
    const isRefineMode = selectedImage !== null;
    const isPosterMode = mode === 'poster';

    return (
        <form onSubmit={handleSubmit} className="space-y-8 pb-12">
            
            {/* 1. SELECTED IMAGE BANNER (REFINE MODE) */}
            {selectedImage && (
                <div className="w-full mb-8">
                    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-4 animate-fade-in relative shadow-md">
                        <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-amber-300 dark:border-amber-700 bg-white dark:bg-black">
                            <img src={selectedImage} alt="Selected" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 pr-8">
                            <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                <MagicWandIcon className="w-5 h-5" />
                                Chế độ Chỉnh sửa & Nâng cấp ảnh (VIP)
                            </h3>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                AI sẽ sử dụng ảnh này làm nền tảng. Bạn có thể thiết kế lại Poster hoặc thay đổi phong cách dựa trên ảnh mẫu.
                            </p>
                        </div>
                        <button 
                            type="button"
                            onClick={onCancelSelect}
                            className="absolute top-2 right-2 text-amber-500 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-full p-2 transition-colors"
                            title="Hủy chọn"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* 2. MAIN LAYOUT */}
            <div className="flex flex-col lg:flex-row gap-8">
                
                {/* LEFT COLUMN: UPLOADS */}
                <div className="flex-1 flex flex-col gap-8">
                    
                    {/* A. STUDIO MODE INPUTS (Hidden in Poster/Refine Mode) */}
                    {isStudioMode && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ImageUpload 
                                id="char-upload" 
                                label="Ảnh nhân vật" 
                                isOptional
                                onFileSelect={(file) => handleFileSelect(file, 'character')} 
                                preview={characterPreview}
                                className="h-full"
                            />
                            <ImageUpload 
                                id="prod-upload" 
                                label="Ảnh sản phẩm" 
                                onFileSelect={(file) => handleFileSelect(file, 'product')} 
                                preview={productPreview}
                                className="h-full"
                            >
                                {/* Extract Product Button */}
                                {productPreview && !isExtracting && (
                                    <button
                                        type="button"
                                        onClick={handleExtractProduct}
                                        className="mt-2 w-full flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm8.486-.486a5 5 0 010 7.071 5 5 0 01-7.071 0l-1.414-1.414m1.414-1.414L12 12m-2.828-2.828l-1.414-1.414a5 5 0 117.071-7.071 5 5 0 010 7.071z" />
                                        </svg>
                                        Tách trang phục/Sản phẩm (AI)
                                    </button>
                                )}
                                {isExtracting && (
                                    <div className="mt-2 w-full flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-semibold">
                                        <Spinner />
                                        <span>Đang tách...</span>
                                    </div>
                                )}
                            </ImageUpload>
                            <ImageUpload 
                                id="ctx-upload" 
                                label="Ảnh Bối cảnh / Vật thể" 
                                isOptional
                                onFileSelect={(file) => handleFileSelect(file, 'context')} 
                                preview={contextPreview}
                                className="h-full"
                            />
                        </div>
                    )}

                    {/* B. POSTER CREATION & REFINE MODE INPUTS */}
                    {(isRefineMode || isPosterMode) && (
                        <div className="space-y-8 animate-fade-in">
                            {isPosterMode && (
                                <div className="bg-white dark:bg-slate-800 p-1 rounded-xl">
                                     <ImageUpload 
                                        id="prod-upload-poster" 
                                        label="Ảnh sản phẩm / Ảnh gốc cần tạo Poster" 
                                        subLabel="Tải lên hình ảnh bạn muốn chuyển thành Poster quảng cáo"
                                        onFileSelect={(file) => handleFileSelect(file, 'product')} 
                                        preview={productPreview} 
                                    />
                                </div>
                            )}

                            {/* Specialized Poster Creation Box */}
                            <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <PosterIcon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                                    <h4 className="font-bold text-violet-800 dark:text-violet-200 uppercase tracking-wide text-sm">
                                        Tham chiếu thiết kế Poster (AI Copywriter & Designer)
                                    </h4>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <ImageUpload 
                                        id="poster-upload" 
                                        label="1. Ảnh Poster Mẫu (Layout)" 
                                        subLabel="AI sẽ học Bố cục & Nội dung từ ảnh này"
                                        onFileSelect={(file) => handleFileSelect(file, 'poster')} 
                                        preview={posterRefPreview}
                                        className="h-full"
                                    />
                                    <ImageUpload 
                                        id="design-upload" 
                                        label="2. Ảnh Style Màu (Tùy chọn)" 
                                        subLabel="AI sẽ học Ánh sáng & Màu sắc từ ảnh này"
                                        isOptional
                                        onFileSelect={(file) => handleFileSelect(file, 'design')} 
                                        preview={designRefPreview}
                                        className="h-full"
                                    />
                                </div>
                                <div className="mt-3 text-xs text-violet-600 dark:text-violet-400 italic">
                                    *Mẹo: Tải lên một poster bạn thích. AI sẽ tự động phân tích bố cục và viết lại mô tả cho bạn.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: CONTROLS */}
                <div className="w-full lg:w-80 flex flex-col gap-6">
                    <div className="p-6 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 h-fit sticky top-24">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Chất lượng ảnh</label>
                            <div className="flex flex-wrap gap-2">
                                {(['Standard', '4K', '8K Ultra'] as ImageQuality[]).map((q) => (
                                    <button
                                        key={q}
                                        type="button"
                                        onClick={() => setQuality(q)}
                                        className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                                            quality === q 
                                            ? 'bg-amber-600 dark:bg-amber-500 text-white border-amber-600 dark:border-amber-500 shadow-sm' 
                                            : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:border-amber-400'
                                        }`}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Số lượng ảnh: {imageCount}</label>
                            <input 
                                type="range" 
                                min="1" 
                                max="4" 
                                value={imageCount} 
                                onChange={(e) => setImageCount(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-amber-600 dark:accent-amber-500"
                            />
                             <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2 font-mono">
                                <span>1 ảnh</span>
                                <span>4 ảnh</span>
                            </div>
                        </div>

                        {/* Hide Face Consistency in Poster/Refine Mode to simplify UI */}
                        {isStudioMode && (
                            <div className="mt-6 flex items-center justify-between">
                                <label htmlFor="face-consistency-edit" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                                    Giữ lại khuôn mặt tuyệt đối
                                </label>
                                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input 
                                        type="checkbox" 
                                        name="toggle" 
                                        id="face-consistency-edit" 
                                        checked={faceConsistency}
                                        onChange={(e) => setFaceConsistency(e.target.checked)}
                                        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-5 checked:border-amber-600 dark:checked:border-amber-500 border-gray-300 dark:border-slate-500 transition-all duration-300"
                                    />
                                    <label htmlFor="face-consistency-edit" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${faceConsistency ? 'bg-amber-600 dark:bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'}`}></label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. AI ANALYSIS (STUDIO MODE ONLY) */}
            {isStudioMode && productImage && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 bg-blue-50 dark:bg-indigo-900/20 rounded-2xl border border-blue-100 dark:border-indigo-900/50 shadow-inner mt-8">
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-2">
                             <label className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 uppercase tracking-wide">
                                <RobotIcon className="w-4 h-4" />
                                Phân tích sản phẩm
                            </label>
                            {isAnalyzingProduct && <span className="text-xs text-blue-500 dark:text-blue-400 animate-pulse">Đang phân tích...</span>}
                        </div>
                        
                        {!productDescription && !isAnalyzingProduct && (
                             <div className="flex-1 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 border border-blue-200 dark:border-indigo-800 border-dashed rounded-lg min-h-[120px]">
                                <button
                                    type="button"
                                    onClick={handleAnalyzeProduct}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                >
                                    <SparklesIcon className="w-4 h-4" />
                                    Phân tích & Gợi ý Ý tưởng
                                </button>
                             </div>
                        )}

                        {(productDescription || isAnalyzingProduct) && (
                            <textarea 
                                value={productDescription}
                                onChange={(e) => setProductDescription(e.target.value)}
                                className="w-full flex-1 text-sm p-3 rounded-lg border border-blue-200 dark:border-indigo-800 bg-white/80 dark:bg-slate-900/80 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono min-h-[120px]"
                                placeholder="Thông tin phân tích sẽ hiện ở đây..."
                            />
                        )}
                        <p className="text-xs text-blue-400 dark:text-blue-300 mt-1">Thông tin: Tên, Công dụng, USP, Khách hàng mục tiêu.</p>
                    </div>

                    <div className="flex flex-col">
                         <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 uppercase tracking-wide">
                                <SparklesIcon className="w-4 h-4 text-amber-500" />
                                Gợi ý ý tưởng (Tự động)
                            </label>
                            <button 
                                type="button"
                                onClick={() => handleGenerateIdeas()}
                                disabled={isGeneratingIdeas || !productDescription || isAnalyzingProduct}
                                className="text-xs bg-amber-500 text-white px-3 py-1 rounded-full hover:bg-amber-600 disabled:opacity-50 transition-colors"
                            >
                                {isGeneratingIdeas ? 'Đang tạo...' : 'Làm mới gợi ý'}
                            </button>
                        </div>
                        
                        <div className="flex-1 space-y-2 overflow-y-auto max-h-[160px] custom-scrollbar">
                            {!isAnalyzingProduct && suggestedPrompts.length === 0 && !productDescription && (
                                <div className="h-full flex items-center justify-center text-xs text-amber-700/50 dark:text-amber-400/50 italic p-2 border border-dashed border-amber-200 dark:border-amber-800/50 rounded-lg">
                                    Vui lòng nhấn nút "Phân tích" bên trái để bắt đầu.
                                </div>
                            )}

                             {isAnalyzingProduct && (
                                <div className="h-full flex items-center justify-center text-xs text-blue-500 dark:text-blue-400 animate-pulse p-2">
                                    <Spinner />
                                    <span className="ml-2">Đang phân tích ảnh...</span>
                                </div>
                            )}
                            
                            {suggestedPrompts.map((idea, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setPrompt(idea)}
                                    className="w-full text-left text-xs p-3 rounded border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-slate-700 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                >
                                    <span className="font-bold mr-1 text-amber-600 dark:text-amber-400">#{idx + 1}</span> {idea}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. PROMPT AREA */}
            <div className="relative mt-8">
                <label htmlFor="prompt-edit" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide flex justify-between">
                    <span>
                        {(isRefineMode || isPosterMode) ? "Mô tả ý tưởng / Concept Poster (AI Tự viết)" : "Mô tả ý tưởng của bạn"}
                    </span>
                    {isAnalyzingPoster && <span className="text-violet-500 animate-pulse text-xs lowercase italic">Đang học Concept Poster...</span>}
                </label>
                <div className="relative">
                    <textarea
                        id="prompt-edit"
                        rows={5}
                        className={`w-full p-4 text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-sm resize-none ${isAnalyzingPoster ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/10' : 'border-gray-300 dark:border-slate-600'}`}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={(isRefineMode || isPosterMode)
                            ? (posterRefImage ? "Mô tả concept poster sẽ hiện ở đây sau khi AI phân tích..." : "Ví dụ: Làm sáng da, thêm hiệu ứng ánh sáng neon, thay đổi màu nền sang xanh dương...")
                            : "Nhân vật trong ảnh tải lên đang sử dụng sản phẩm trong ảnh sản phẩm tải lên trong bối cảnh phù hợp."}
                    />
                    <EditIcon className="absolute bottom-3 right-3 w-4 h-4 text-gray-400" />
                </div>
                 {posterRefImage && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        * Bạn có thể chỉnh sửa lại mô tả trên để thêm/bớt các chi tiết cho Poster mới.
                    </p>
                )}
            </div>

            {/* 5. SUBMIT BUTTON */}
            <div className="pt-2">
                <Button type="submit" disabled={isLoading || (!productImage && !selectedImage) || isExtracting || isAnalyzingPoster} className="w-full py-4 text-lg shadow-lg shadow-amber-200 dark:shadow-amber-900/20">
                    {isPosterMode || posterRefImage ? <PosterIcon className="w-6 h-6 mr-2"/> : <EditIcon className="w-6 h-6 mr-2"/>}
                    {isLoading ? 'Đang xử lý...' : ((isRefineMode || isPosterMode) ? 'Chỉnh sửa & Tạo Poster Mới' : 'Tạo Tác Phẩm')}
                </Button>
                {(!productImage && !selectedImage) && (
                    <p className="text-center text-red-500 dark:text-red-400 text-sm mt-2">
                        {isPosterMode ? 'Vui lòng tải lên ảnh gốc cần tạo Poster.' : 'Vui lòng tải lên ảnh sản phẩm.'}
                    </p>
                )}
            </div>
        </form>
    );
};
