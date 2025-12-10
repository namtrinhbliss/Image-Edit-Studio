
import React, { useState, useEffect } from 'react';
import { ImageGenerator } from './components/ImageGenerator';
import { ImageEditor } from './components/ImageEditor';
import { ImageDisplay } from './components/ImageDisplay';
import { SettingsBar } from './components/SettingsBar';
import { SimpleEditor } from './components/SimpleEditor';
import { Tabs } from './components/ui/Tabs';
import { generateImage, editImage } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { SunIcon, MoonIcon } from './components/ui/Icon';
import type { EditImageData, GenerateImageData, AIConfig } from './types';

type Tab = 'generate' | 'edit' | 'poster' | 'simple_editor';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('edit');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState<number>(0);
    
    // Initialize Dark Mode from localStorage or System Preference
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                return savedTheme === 'dark';
            }
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // AI Configuration State
    const [aiModel, setAiModel] = useState<string>('gemini-2.5-flash-image');
    // Custom API Key Management
    const [useCustomKey, setUseCustomKey] = useState<boolean>(false);
    const [customApiKey, setCustomApiKey] = useState<string>('');

    const getAIConfig = (): AIConfig => ({
        model: aiModel,
        apiKey: useCustomKey && customApiKey ? customApiKey : null
    });

    // Effect to apply Dark Mode class to HTML tag
    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isLoading) {
            interval = setInterval(() => {
                setTimer(prevTimer => prevTimer + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isLoading]);

    const handleGenerateImage = async (data: GenerateImageData) => {
        setTimer(0);
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        setSelectedImage(null); 
        
        const hasStyles = data.stylePrompts && data.stylePrompts.length > 0;
        const count = hasStyles ? data.stylePrompts!.length : 1;

        setLoadingMessage(
            hasStyles
                ? `Đang sáng tạo ${count} tác phẩm nghệ thuật (${aiModel})...`
                : (data.sourceImages && data.sourceImages.length > 0
                    ? `AI đang biến tấu từ ảnh gốc (${aiModel})...`
                    : `AI đang vẽ tác phẩm (${aiModel}), vui lòng đợi...`)
        );

        try {
            let sourceImagesB64;
            if (data.sourceImages && data.sourceImages.length > 0) {
                sourceImagesB64 = await Promise.all(
                    data.sourceImages.map(async (file) => ({
                        data: await fileToBase64(file),
                        mimeType: file.type,
                    }))
                );
            }

            const aiConfig = getAIConfig();

            if (hasStyles && data.stylePrompts) {
                const promises = data.stylePrompts.map(async (stylePrompt) => {
                    const fullPrompt = `${data.prompt}. \n\n${stylePrompt}`;
                    const imageB64 = await generateImage(fullPrompt, data.aspectRatio, sourceImagesB64, data.faceConsistency, aiConfig);
                    const mimeType = sourceImagesB64 ? 'png' : 'jpeg';
                    return `data:image/${mimeType};base64,${imageB64}`;
                });

                const results = await Promise.all(promises);
                setGeneratedImages(results);

            } else {
                const imageB64 = await generateImage(data.prompt, data.aspectRatio, sourceImagesB64, data.faceConsistency, aiConfig);
                const mimeType = sourceImagesB64 ? 'png' : 'jpeg';
                setGeneratedImages([`data:image/${mimeType};base64,${imageB64}`]);
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi không mong muốn.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditImage = async (data: EditImageData) => {
        if (!data.baseImage && !data.productImage) {
            setError('Vui lòng tải lên ảnh để xử lý.');
            return;
        }

        setTimer(0);
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]); 
        
        const isPosterMode = activeTab === 'poster';
        
        setLoadingMessage(
            (data.baseImage || isPosterMode)
            ? (data.posterReferenceImage ? `AI đang thiết kế Poster quảng cáo theo mẫu (${aiModel})...` : `Đang tinh chỉnh và nâng cấp ảnh (${aiModel})...`)
            : `Đang sản xuất ${data.imageCount} phiên bản thương mại (${aiModel})...`
        );

        try {
            const processFile = async (file: File | null) => {
                if (!file) return null;
                return {
                    data: await fileToBase64(file),
                    mimeType: file.type
                };
            };

            let effectiveBaseImage = data.baseImage;
            let effectiveProductPart = await processFile(data.productImage);

            if (isPosterMode && data.productImage && !effectiveBaseImage) {
                 const base64Main = await fileToBase64(data.productImage);
                 effectiveBaseImage = `data:${data.productImage.type};base64,${base64Main}`;
            }

            const [characterPart, contextPart, designRefPart, posterRefPart] = await Promise.all([
                processFile(data.characterImage),
                processFile(data.contextImage),
                processFile(data.designRefImage || null),
                processFile(data.posterReferenceImage || null)
            ]);

            const aiConfig = getAIConfig();

            const imagesB64 = await editImage(
                characterPart, 
                effectiveProductPart, 
                contextPart, 
                data.prompt,
                data.imageCount,
                data.quality,
                data.faceConsistency,
                effectiveBaseImage,
                designRefPart,
                data.autoRemoveBackground || false,
                aiConfig,
                posterRefPart
            );
            
            const formattedImages = imagesB64.map(b64 => `data:image/png;base64,${b64}`);
            setGeneratedImages(formattedImages);
            setSelectedImage(null);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi tạo ảnh.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectImage = (src: string) => {
        setSelectedImage(src);
        setActiveTab('edit'); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const tabs = [
        { id: 'edit', label: 'Studio Sản Phẩm (VIP)' },
        { id: 'poster', label: 'Tạo Poster Quảng Cáo' },
        { id: 'generate', label: 'Sáng Tạo Nghệ Thuật' },
        { id: 'simple_editor', label: 'Thiết Kế Nhanh' },
    ];

    return (
        <div className="min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans">
            
            <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors duration-300">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <a 
                            href="https://tuanlamviec4h.com/checkvar" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 group transition-opacity hover:opacity-90"
                        >
                            <img 
                                src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/76jwxJS0DcAVoeVK00Z6/media/65019a9df30a7212a2e4c1d0.png" 
                                alt="Logo" 
                                className="h-12 w-auto rounded-lg shadow-sm"
                            />
                            <div className="flex flex-col">
                                <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-yellow-500 dark:from-amber-400 dark:to-yellow-300">
                                    Digital CEO - Tuần Làm Việc 4h
                                </h1>
                                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    By Nam Trịnh
                                </p>
                            </div>
                        </a>

                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="p-2.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            aria-label="Toggle Dark Mode"
                        >
                            {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
                
                {/* Chỉ hiện SettingsBar khi không ở tab Simple Editor, hoặc giữ lại nếu muốn */}
                {activeTab !== 'simple_editor' && (
                    <SettingsBar 
                        model={aiModel} 
                        onModelChange={setAiModel}
                        useCustomKey={useCustomKey}
                        setUseCustomKey={setUseCustomKey}
                        customApiKey={customApiKey}
                        setCustomApiKey={setCustomApiKey}
                    />
                )}

                <div className="flex flex-col gap-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                        <Tabs tabs={tabs} activeTab={activeTab} setActiveTab={(id) => setActiveTab(id as Tab)} />
                        <div className="mt-8">
                            {activeTab === 'generate' && <ImageGenerator onGenerate={handleGenerateImage} isLoading={isLoading} />}
                            {(activeTab === 'edit' || activeTab === 'poster') && (
                                <ImageEditor 
                                    mode={activeTab === 'poster' ? 'poster' : 'studio'}
                                    onEdit={handleEditImage} 
                                    isLoading={isLoading} 
                                    selectedImage={selectedImage}
                                    onCancelSelect={() => setSelectedImage(null)}
                                />
                            )}
                            {activeTab === 'simple_editor' && <SimpleEditor />}
                        </div>
                    </div>

                    {activeTab !== 'simple_editor' && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-800 min-h-[400px] transition-colors duration-300">
                                <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span className="w-1.5 h-8 bg-amber-500 rounded-full inline-block"></span>
                                Kết Quả Sáng Tạo
                                </h2>
                            <ImageDisplay
                                isLoading={isLoading}
                                loadingMessage={loadingMessage}
                                imageSrcs={generatedImages}
                                error={error}
                                timer={timer}
                                onSelectImage={handleSelectImage}
                                selectedImageSrc={selectedImage}
                            />
                        </div>
                    )}
                </div>

                <footer className="mt-16 pb-8 text-center">
                    <div className="w-24 h-1 bg-gradient-to-r from-amber-500 to-yellow-300 mx-auto rounded-full mb-6 opacity-50"></div>
                    <a 
                        href="https://tuanlamviec4h.com/checkvar" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 font-medium transition-colors"
                    >
                        Digital CEO - Tuần Làm Việc 4h
                    </a>
                </footer>
            </div>
        </div>
    );
};

export default App;
