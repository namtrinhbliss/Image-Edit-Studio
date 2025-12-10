
import React, { useState, useRef } from 'react';
import { Button } from './ui/Button';
import type { AspectRatio, GenerateImageData } from '../types';
import { GenerateIcon, UploadIcon, PaletteIcon } from './ui/Icon';

interface ImageGeneratorProps {
    onGenerate: (data: GenerateImageData) => void;
    isLoading: boolean;
}

const aspectRatios: { label: string; value: AspectRatio }[] = [
    { label: 'Vuông (1:1)', value: '1:1' },
    { label: 'Ngang (16:9)', value: '16:9' },
    { label: 'Dọc (9:16)', value: '9:16' },
];

interface StyleOption {
    id: string;
    label: string;
    promptSuffix: string;
    colorClass: string;
}

// Updated color classes for dark mode compatibility (using generic backgrounds but maintaining border/text distinctness)
const PREDEFINED_STYLES: StyleOption[] = [
    { id: 'korea', label: 'Du lịch Hàn Quốc', promptSuffix: 'Style: Korean travel photography, soft natural lighting, Seoul street background, romantic vibes, K-drama aesthetic.', colorClass: 'border-pink-200 text-pink-700 dark:text-pink-300 dark:border-pink-800 bg-pink-50 dark:bg-pink-900/20' },
    { id: 'studio', label: 'Studio Chuyên Nghiệp', promptSuffix: 'Style: Professional studio photography, high-key lighting, solid neutral background, sharp focus, fashion magazine quality.', colorClass: 'border-gray-200 text-gray-700 dark:text-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/40' },
    { id: 'cyberpunk', label: 'Cyberpunk', promptSuffix: 'Style: Cyberpunk city, neon lights, futuristic vibes, blue and purple color palette, night time, cinematic lighting.', colorClass: 'border-indigo-200 text-indigo-700 dark:text-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20' },
    { id: 'vintage', label: 'Vintage 90s', promptSuffix: 'Style: 90s film photography, grainy texture, warm retro colors, nostalgic atmosphere, analog film look.', colorClass: 'border-orange-200 text-orange-700 dark:text-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20' },
    { id: 'business', label: 'Doanh Nhân', promptSuffix: 'Style: Business professional, modern office background, confident pose, wearing suit, success vibes, glass walls.', colorClass: 'border-slate-200 text-slate-700 dark:text-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40' },
    { id: 'christmas', label: 'Giáng Sinh', promptSuffix: 'Style: Christmas atmosphere, snow, pine trees, warm fairy lights, red and green tones, cozy holiday vibe.', colorClass: 'border-red-200 text-red-700 dark:text-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20' },
    { id: 'nature', label: 'Rừng Nhiệt Đới', promptSuffix: 'Style: Tropical forest, lush green plants, sunlight filtering through leaves, fresh and organic atmosphere.', colorClass: 'border-green-200 text-green-700 dark:text-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20' },
    { id: 'beach', label: 'Biển Mùa Hè', promptSuffix: 'Style: Summer beach, white sand, blue ocean, bright sunlight, vacation vibes, clear sky.', colorClass: 'border-blue-200 text-blue-700 dark:text-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20' },
    { id: 'cinematic', label: 'Điện Ảnh', promptSuffix: 'Style: Cinematic movie shot, dramatic lighting, shallow depth of field, emotional atmosphere, anamorphic lens look.', colorClass: 'border-zinc-200 text-zinc-700 dark:text-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/40' },
    { id: 'anime', label: 'Anime 2D', promptSuffix: 'Style: Japanese Anime art style, vibrant colors, 2D cell shading, expressive, Studio Ghibli inspired.', colorClass: 'border-purple-200 text-purple-700 dark:text-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20' },
    { id: 'minimalist', label: 'Tối Giản', promptSuffix: 'Style: Minimalist photography, clean lines, pastel colors, uncluttered composition, soft lighting, modern art.', colorClass: 'border-teal-200 text-teal-700 dark:text-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20' },
    { id: 'luxury', label: 'Sang Trọng (Luxury)', promptSuffix: 'Style: High-end luxury, gold and marble textures, sophisticated interior, elegant atmosphere, wealthy lifestyle.', colorClass: 'border-yellow-200 text-yellow-700 dark:text-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20' },
    { id: 'street', label: 'Đường Phố', promptSuffix: 'Style: High fashion street style, urban graffiti background, candid shot, dynamic pose, trendy outfit.', colorClass: 'border-stone-200 text-stone-700 dark:text-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/40' },
    { id: 'dreamy', label: 'Mộng Mơ', promptSuffix: 'Style: Dreamy aesthetic, soft focus, clouds and mist, pastel purple and pink tones, ethereal atmosphere.', colorClass: 'border-rose-200 text-rose-700 dark:text-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20' },
    { id: 'coffee', label: 'Quán Cà Phê', promptSuffix: 'Style: Cozy coffee shop, wooden furniture, warm latte art, relaxing weekend vibes, soft indoor lighting.', colorClass: 'border-amber-200 text-amber-700 dark:text-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20' },
    { id: 'gym', label: 'Phòng Gym', promptSuffix: 'Style: Fitness center, workout equipment, energetic atmosphere, sweat and determination, dramatic gym lighting.', colorClass: 'border-neutral-200 text-neutral-700 dark:text-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/40' },
    { id: 'magazine', label: 'Bìa Tạp Chí', promptSuffix: 'Style: Vogue magazine cover style, bold fashion, studio lighting, high contrast, typography layout ready.', colorClass: 'border-fuchsia-200 text-fuchsia-700 dark:text-fuchsia-300 dark:border-fuchsia-800 bg-fuchsia-50 dark:bg-fuchsia-900/20' },
    { id: 'neon', label: 'Phản Quang (Neon)', promptSuffix: 'Style: Blacklight photography, glowing neon makeup and clothes, dark background, artistic lighting.', colorClass: 'border-violet-200 text-violet-700 dark:text-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20' },
    { id: 'oil', label: 'Tranh Sơn Dầu', promptSuffix: 'Style: Classic oil painting, visible brush strokes, textured canvas, artistic interpretation, museum quality.', colorClass: 'border-emerald-200 text-emerald-700 dark:text-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20' },
    { id: 'ancient', label: 'Cổ Trang', promptSuffix: 'Style: Ancient Asian historical drama, traditional clothing (Hanfu/Ao Dai), lotus pond, wooden architecture.', colorClass: 'border-cyan-200 text-cyan-700 dark:text-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20' },
];

const PROMPT_MAX_LENGTH = 1000;

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onGenerate, isLoading }) => {
    const [prompt, setPrompt] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [sourceImages, setSourceImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [faceConsistency, setFaceConsistency] = useState<boolean>(false);
    
    // New state for styles
    const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const files = Array.from(event.target.files);
            setSourceImages(prev => [...prev, ...files]);

            files.forEach((file: File) => {
                const reader = new FileReader();
                reader.onload = (e: ProgressEvent<FileReader>) => {
                    if (e.target?.result && typeof e.target.result === 'string') {
                        setPreviews(prev => [...prev, e.target.result]);
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };
    
    const removeImage = (indexToRemove: number) => {
        setSourceImages(prev => prev.filter((_, index) => index !== indexToRemove));
        setPreviews(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const toggleStyle = (styleId: string) => {
        setSelectedStyles(prev => {
            if (prev.includes(styleId)) {
                return prev.filter(id => id !== styleId);
            } else {
                return [...prev, styleId];
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let stylePrompts: string[] = [];
        if (selectedStyles.length > 0) {
            stylePrompts = selectedStyles.map(id => {
                const style = PREDEFINED_STYLES.find(s => s.id === id);
                return style ? style.promptSuffix : '';
            }).filter(p => p !== '');
        }

        if (prompt.trim() || stylePrompts.length > 0) {
            onGenerate({ 
                prompt, 
                aspectRatio, 
                sourceImages, 
                faceConsistency,
                stylePrompts 
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div>
                 <label htmlFor="source-images-upload" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                    Tải ảnh gốc (Tùy chọn)
                </label>
                <input
                    type="file"
                    id="source-images-upload"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />
                 <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex justify-center items-center px-4 py-3 border-2 border-gray-300 dark:border-slate-600 border-dashed rounded-xl shadow-sm text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-amber-400 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                >
                    <UploadIcon className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"/>
                    Chọn ảnh để sáng tạo từ ảnh gốc
                </button>

                 {previews.length > 0 && (
                    <>
                        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {previews.map((src, index) => (
                                <div key={index} className="relative group aspect-square">
                                    <img src={src} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-md shadow-md" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(index)}
                                        className="absolute top-1 right-1 bg-black bg-opacity-70 text-white rounded-full p-1 leading-none text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={`Xóa ảnh ${index + 1}`}
                                    >
                                        &#x2715;
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <label htmlFor="face-consistency" className="flex items-center cursor-pointer">
                                <input
                                    id="face-consistency"
                                    type="checkbox"
                                    checked={faceConsistency}
                                    onChange={(e) => setFaceConsistency(e.target.checked)}
                                    className="h-4 w-4 rounded text-amber-600 border-gray-300 focus:ring-amber-500"
                                />
                                <span className="ml-3 text-sm font-bold text-gray-800 dark:text-gray-200">Giữ nguyên khuôn mặt (Face Consistency)</span>
                            </label>
                            <p className="ml-7 mt-1 text-xs text-gray-600 dark:text-gray-400">
                                Khi được chọn, AI sẽ cố gắng giữ nguyên các đặc điểm, cảm xúc và chi tiết trên khuôn mặt từ ảnh gốc.
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Styles Section */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                    <PaletteIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <label className="block text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
                        Chọn Phong cách / Bối cảnh mẫu (Chọn nhiều)
                    </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Chọn các phong cách bạn muốn. AI sẽ tạo ra 1 ảnh cho mỗi phong cách được chọn (Ví dụ: Chọn 3 phong cách sẽ tạo 3 ảnh).
                </p>
                <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                    {PREDEFINED_STYLES.map((style) => {
                        const isSelected = selectedStyles.includes(style.id);
                        return (
                            <button
                                key={style.id}
                                type="button"
                                onClick={() => toggleStyle(style.id)}
                                className={`
                                    px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200
                                    flex items-center gap-1 shadow-sm
                                    ${isSelected 
                                        ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-500 text-amber-800 dark:text-amber-300 scale-105' 
                                        : `${style.colorClass} border-transparent hover:border-gray-300 dark:hover:border-gray-600 opacity-90 hover:opacity-100`
                                    }
                                `}
                            >
                                {isSelected && <span>✓</span>}
                                {style.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <label htmlFor="prompt-generate" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                    Mô tả hình ảnh (Prompt) {selectedStyles.length > 0 && <span className="font-normal text-gray-500 dark:text-gray-400 normal-case">(Kết hợp với phong cách đã chọn)</span>}
                </label>
                <textarea
                    id="prompt-generate"
                    rows={4}
                    className="w-full px-4 py-3 text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-sm"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={selectedStyles.length > 0 
                        ? "Ví dụ: Một cô gái đang cười rạng rỡ (Phong cách sẽ tự động áp dụng theo lựa chọn ở trên)..." 
                        : "Ví dụ: Chân dung điện ảnh của một chàng trai trẻ trong bộ vest đen..."}
                    maxLength={PROMPT_MAX_LENGTH}
                />
                 <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>Mô tả càng chi tiết, kết quả càng chính xác.</span>
                     <span className={prompt.length > PROMPT_MAX_LENGTH - 100 ? 'text-red-500' : ''}>
                        {prompt.length}/{PROMPT_MAX_LENGTH}
                    </span>
                 </div>
            </div>

            {sourceImages.length === 0 && (
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                        Tỷ lệ khung hình
                    </label>
                    <div className="flex flex-wrap gap-3">
                        {aspectRatios.map((ratio) => (
                            <label key={ratio.value} className="flex items-center space-x-2 cursor-pointer group">
                                <input
                                    type="radio"
                                    name="aspectRatio"
                                    value={ratio.value}
                                    checked={aspectRatio === ratio.value}
                                    onChange={() => setAspectRatio(ratio.value)}
                                    className="h-4 w-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                                />
                                <span className={`text-sm group-hover:text-amber-600 transition-colors ${aspectRatio === ratio.value ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {ratio.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="pt-2">
                <Button type="submit" disabled={isLoading || (!prompt.trim() && selectedStyles.length === 0)} className="w-full py-4 text-lg shadow-lg shadow-amber-200 dark:shadow-amber-900/20">
                    <GenerateIcon className="w-6 h-6 mr-2" />
                    {isLoading 
                        ? 'Đang tạo...' 
                        : (selectedStyles.length > 0 ? `Tạo ${selectedStyles.length} ảnh theo phong cách đã chọn` : 'Tạo Tác Phẩm')
                    }
                </Button>
            </div>
        </form>
    );
};
