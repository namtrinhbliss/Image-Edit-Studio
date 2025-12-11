
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/Button';
import { 
    DownloadIcon, UploadIcon, TypeIcon, LayersIcon, 
    RotateIcon, TrashIcon, PaletteIcon, PlusIcon, XMarkIcon,
    ImageIcon, SquareIcon, CircleIcon, ArrowUpIcon, ArrowDownIcon,
    ChevronDoubleUpIcon, ChevronDoubleDownIcon, EditIcon, CropIcon,
    MagicWandIcon, SparklesIcon
} from './ui/Icon';
import { fileToBase64, base64ToFile } from '../utils/fileUtils';
import { extractProductFromImage } from '../services/geminiService';
import { Spinner } from './ui/Spinner';

type AspectRatio = '1:1' | '16:9' | '9:16';

// Unified Element Types
type ElementType = 'text' | 'image' | 'shape';

interface CropData {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface BorderData {
    width: number;
    style: 'solid' | 'dashed' | 'dotted';
    color: string;
}

interface ShadowData {
    color: string;
    opacity: number;
    x: number;
    y: number;
    blur: number;
}

interface BaseElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    rotation: number;
    zIndex: number;
    crop?: CropData;
    border?: BorderData;
    shadow?: ShadowData;
    opacity?: number;
}

interface TextElement extends BaseElement {
    type: 'text';
    content: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    align: 'left' | 'center' | 'right';
    shadowEnabled: boolean; 
}

interface ImageElement extends BaseElement {
    type: 'image';
    src: string;
    width: number;
    height: number;
    aspectRatio: number; // width / height
    borderRadius?: number;
}

interface ShapeElement extends BaseElement {
    type: 'shape';
    shapeType: 'rectangle' | 'circle';
    width: number;
    height: number;
    color: string;
    borderRadius?: number; // Only for rectangle
}

type EditorElement = TextElement | ImageElement | ShapeElement;

interface BackgroundState {
    type: 'image' | 'solid' | 'gradient';
    image?: {
        src: string;
        x: number;
        y: number;
        scale: number;
    };
    color?: string;
    gradient?: {
        type: 'linear' | 'radial';
        direction: string; // e.g., "to right", "45deg"
        colors: string[]; // [startColor, endColor]
    };
}

const FONTS = [
    { name: 'Roboto', value: 'font-roboto' },
    { name: 'Open Sans', value: 'font-opensans' },
    { name: 'Montserrat', value: 'font-montserrat' },
    { name: 'Playfair Display', value: 'font-playfair' },
    { name: 'Oswald', value: 'font-oswald' },
    { name: 'Lobster', value: 'font-lobster' },
    { name: 'Dancing Script', value: 'font-dancing' },
];

// Helper to convert Hex to RGBA for CSS/Canvas
const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper to remove white background from image data
const removeWhiteBackground = (img: HTMLImageElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img.src;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Threshold for "White" - adjusting to 240 allows for slight off-white/noise
        if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; // Set alpha to 0
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
};

export const SimpleEditor: React.FC = () => {
    // Canvas State
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [background, setBackground] = useState<BackgroundState>({ type: 'solid', color: '#ffffff' });
    const [overlay, setOverlay] = useState({ color: '#000000', opacity: 0 });
    
    // Unified Elements State
    const [elements, setElements] = useState<EditorElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | 'bg' | null>(null);

    // Canvas Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 500, height: 500 });

    // Interaction State
    const isDragging = useRef(false);
    const isResizing = useRef(false);
    const isRotating = useRef(false);
    
    // Cropping State
    const [isCropping, setIsCropping] = useState(false);
    const isCroppingDrag = useRef<'lt' | 'rt' | 'lb' | 'rb' | null>(null);

    // Eraser / Masking State
    const [isErasing, setIsErasing] = useState(false);
    const [eraserBrushSize, setEraserBrushSize] = useState(20);
    const [eraserHardness, setEraserHardness] = useState(1.0); // 0 to 1
    const [eraserOpacity, setEraserOpacity] = useState(1.0); // 0 to 1 (New: Opacity control)
    const eraserCanvasRef = useRef<HTMLCanvasElement>(null);
    const eraserLastPos = useRef<{x: number, y: number} | null>(null);
    const [isProcessingRemoveBg, setIsProcessingRemoveBg] = useState(false);

    const dragStart = useRef({ x: 0, y: 0 });
    const initialElementState = useRef<any>(null);

    // Initialize Canvas Size
    useEffect(() => {
        const updateSize = () => {
            if (!containerRef.current) return;
            const containerWidth = containerRef.current.offsetWidth;
            let width = containerWidth;
            let height = containerWidth; // Default 1:1

            if (aspectRatio === '16:9') height = width * (9 / 16);
            if (aspectRatio === '9:16') {
                // Limit height to view, adjust width
                const maxHeight = window.innerHeight * 0.7;
                height = maxHeight;
                width = height * (9 / 16);
            }

            setCanvasDimensions({ width, height });
        };

        window.addEventListener('resize', updateSize);
        updateSize();
        setTimeout(updateSize, 100);
        
        return () => window.removeEventListener('resize', updateSize);
    }, [aspectRatio]);

    // Paste Handler
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    if (file) {
                        const base64 = await fileToBase64(file);
                        addImageElement(`data:${file.type};base64,${base64}`);
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            setBackground({ 
                type: 'image', 
                image: { src: `data:${file.type};base64,${base64}`, x: 0, y: 0, scale: 1 } 
            });
            setSelectedId('bg');
        }
    };

    const handleDecoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            addImageElement(`data:${file.type};base64,${base64}`);
        }
    };

    const addImageElement = (src: string) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const aspectRatio = img.width / img.height;
            const baseSize = 200;
            const width = aspectRatio >= 1 ? baseSize : baseSize * aspectRatio;
            const height = aspectRatio >= 1 ? baseSize / aspectRatio : baseSize;

            const newEl: ImageElement = {
                id: Date.now().toString(),
                type: 'image',
                x: canvasDimensions.width / 2,
                y: canvasDimensions.height / 2,
                rotation: 0,
                zIndex: elements.length,
                src,
                width,
                height,
                aspectRatio,
                crop: { top: 0, right: 0, bottom: 0, left: 0 },
                borderRadius: 0,
                border: { width: 0, style: 'solid', color: '#000000' },
                shadow: { color: '#000000', opacity: 0.5, x: 0, y: 0, blur: 0 }
            };
            setElements([...elements, newEl]);
            setSelectedId(newEl.id);
        }
    };

    const addText = () => {
        const newText: TextElement = {
            id: Date.now().toString(),
            type: 'text',
            content: 'Nhập văn bản...',
            x: canvasDimensions.width / 2,
            y: canvasDimensions.height / 2,
            rotation: 0,
            zIndex: elements.length,
            fontSize: 24,
            fontFamily: 'font-roboto',
            color: '#ffffff',
            align: 'center',
            shadowEnabled: true,
            shadow: { color: '#000000', opacity: 0.8, x: 2, y: 2, blur: 4 }
        };
        setElements([...elements, newText]);
        setSelectedId(newText.id);
    };

    const addShape = (shapeType: 'rectangle' | 'circle') => {
        const newShape: ShapeElement = {
            id: Date.now().toString(),
            type: 'shape',
            shapeType,
            x: canvasDimensions.width / 2,
            y: canvasDimensions.height / 2,
            rotation: 0,
            zIndex: elements.length,
            width: 150,
            height: 150,
            color: '#3b82f6',
            crop: { top: 0, right: 0, bottom: 0, left: 0 },
            borderRadius: 0,
            shadow: { color: '#000000', opacity: 0.5, x: 5, y: 5, blur: 10 }
        };
        setElements([...elements, newShape]);
        setSelectedId(newShape.id);
    };

    // --- Background Removal ---
    const handleRemoveBackground = async () => {
        const el = elements.find(e => e.id === selectedId) as ImageElement;
        if (!el || el.type !== 'image') return;

        setIsProcessingRemoveBg(true);
        try {
            const file = base64ToFile(el.src.split(',')[1], 'temp.png', 'image/png');
            const newBase64 = await extractProductFromImage(file);
            const tempImg = new Image();
            tempImg.src = `data:image/png;base64,${newBase64}`;
            await new Promise((resolve) => { tempImg.onload = resolve; });
            const transparentSrc = removeWhiteBackground(tempImg);

            updateElement('src', transparentSrc);
        } catch (error) {
            console.error("Remove BG failed", error);
            alert("Không thể xóa nền. Vui lòng thử lại.");
        } finally {
            setIsProcessingRemoveBg(false);
        }
    };

    // --- Eraser Logic ---
    const startErasing = () => {
        if (!selectedId || selectedId === 'bg') return;
        setIsErasing(true);
        eraserLastPos.current = null;
    };

    const saveEraserResult = () => {
        const canvas = eraserCanvasRef.current;
        if (canvas && selectedId) {
            const newSrc = canvas.toDataURL('image/png');
            updateElement('src', newSrc);
        }
        setIsErasing(false);
    };

    // --- Layer Management ---
    const moveLayer = (direction: 'up' | 'down' | 'top' | 'bottom') => {
        if (!selectedId || selectedId === 'bg') return;
        const index = elements.findIndex(e => e.id === selectedId);
        if (index === -1) return;

        const newElements = [...elements];
        const el = newElements[index];

        if (direction === 'up' && index < elements.length - 1) {
            newElements[index] = newElements[index + 1];
            newElements[index + 1] = el;
        } else if (direction === 'down' && index > 0) {
            newElements[index] = newElements[index - 1];
            newElements[index - 1] = el;
        } else if (direction === 'top') {
            newElements.splice(index, 1);
            newElements.push(el);
        } else if (direction === 'bottom') {
            newElements.splice(index, 1);
            newElements.unshift(el);
        }
        setElements(newElements);
    };

    // --- Interaction Handlers ---

    const getClientCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if ('touches' in e) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    };

    const startCropping = () => {
        if (selectedId && selectedId !== 'bg') {
            setIsCropping(true);
        }
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, id: string, type: 'move' | 'resize' | 'rotate' | 'crop', cropHandle?: 'lt' | 'rt' | 'lb' | 'rb') => {
        if (isErasing) return; 
        e.stopPropagation();
        e.preventDefault(); 
        
        if (isCropping && id !== selectedId) {
            setIsCropping(false);
            return;
        }

        setSelectedId(id);
        const { x, y } = getClientCoords(e);
        dragStart.current = { x, y };

        if (id === 'bg') {
            if (background.type === 'image' && background.image) {
                initialElementState.current = { ...background.image };
            }
        } else {
            const el = elements.find(t => t.id === id);
            initialElementState.current = { ...el };
        }

        if (type === 'crop' && cropHandle) {
            isCroppingDrag.current = cropHandle;
        } else {
            if (type === 'move') isDragging.current = true;
            if (type === 'resize') isResizing.current = true;
            if (type === 'rotate') isRotating.current = true;
        }
    };

    const handleCanvasClick = () => {
        if (!isErasing) {
            setSelectedId(null);
            setIsCropping(false);
        }
    }

    const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging.current && !isResizing.current && !isRotating.current && !isCroppingDrag.current) return;
        if (!selectedId) return;

        const { x, y } = getClientCoords(e);
        const dx = x - dragStart.current.x;
        const dy = y - dragStart.current.y;

        if (selectedId === 'bg' && background.type === 'image' && background.image) {
            if (isDragging.current) {
                setBackground(prev => ({
                    ...prev,
                    image: {
                        ...prev.image!,
                        x: initialElementState.current.x + dx,
                        y: initialElementState.current.y + dy
                    }
                }));
            } else if (isResizing.current) {
                const scaleDelta = dx * 0.005; 
                setBackground(prev => ({
                    ...prev,
                    image: {
                        ...prev.image!,
                        scale: Math.max(0.1, initialElementState.current.scale + scaleDelta)
                    }
                }));
            }
        } else {
            setElements(prevElements => prevElements.map(el => {
                if (el.id !== selectedId) return el;

                // CROP
                if (isCroppingDrag.current) {
                    const currentCrop = el.crop || { top: 0, right: 0, bottom: 0, left: 0 };
                    const initialW = (el.type === 'shape' || el.type === 'image') ? (el as any).width : 100;
                    const initialH = (el.type === 'shape' || el.type === 'image') ? (el as any).height : 100;
                    
                    const percentX = (dx / initialW) * 100;
                    const percentY = (dy / initialH) * 100;

                    let newCrop = { ...currentCrop };

                    if (isCroppingDrag.current === 'lt') {
                        newCrop.left = Math.min(Math.max(0, initialElementState.current.crop.left + percentX), 100 - newCrop.right - 5);
                        newCrop.top = Math.min(Math.max(0, initialElementState.current.crop.top + percentY), 100 - newCrop.bottom - 5);
                    } else if (isCroppingDrag.current === 'rt') {
                        newCrop.right = Math.min(Math.max(0, initialElementState.current.crop.right - percentX), 100 - newCrop.left - 5);
                        newCrop.top = Math.min(Math.max(0, initialElementState.current.crop.top + percentY), 100 - newCrop.bottom - 5);
                    } else if (isCroppingDrag.current === 'lb') {
                        newCrop.left = Math.min(Math.max(0, initialElementState.current.crop.left + percentX), 100 - newCrop.right - 5);
                        newCrop.bottom = Math.min(Math.max(0, initialElementState.current.crop.bottom - percentY), 100 - newCrop.top - 5);
                    } else if (isCroppingDrag.current === 'rb') {
                        newCrop.right = Math.min(Math.max(0, initialElementState.current.crop.right - percentX), 100 - newCrop.left - 5);
                        newCrop.bottom = Math.min(Math.max(0, initialElementState.current.crop.bottom - percentY), 100 - newCrop.top - 5);
                    }

                    return { ...el, crop: newCrop };
                }

                if (isDragging.current) {
                    return { ...el, x: initialElementState.current.x + dx, y: initialElementState.current.y + dy };
                }
                
                if (isResizing.current) {
                    const delta = dx;
                    if (el.type === 'text') {
                        return { ...el, fontSize: Math.max(10, initialElementState.current.fontSize + (delta * 0.5)) };
                    } else if (el.type === 'image') {
                        const newWidth = Math.max(20, initialElementState.current.width + delta);
                        return { ...el, width: newWidth, height: newWidth / initialElementState.current.aspectRatio };
                    } else if (el.type === 'shape') {
                         return { 
                            ...el, 
                            width: Math.max(20, initialElementState.current.width + delta), 
                            height: Math.max(20, initialElementState.current.height + delta * (el.shapeType === 'circle' ? 1 : 1)) 
                        };
                    }
                }

                if (isRotating.current) {
                    return { ...el, rotation: initialElementState.current.rotation + (dx * 0.5) };
                }

                return el;
            }));
        }
    }, [selectedId, background, elements]);

    const handleMouseUp = () => {
        isDragging.current = false;
        isResizing.current = false;
        isRotating.current = false;
        isCroppingDrag.current = null;
        initialElementState.current = null;
        eraserLastPos.current = null;
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleMouseMove, { passive: false });
        window.addEventListener('touchend', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [handleMouseMove]);

    // Canvas Download
    const handleDownload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvasDimensions.width;
        canvas.height = canvasDimensions.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });

        const render = async () => {
            if (background.type === 'solid') {
                ctx.fillStyle = background.color || '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (background.type === 'gradient' && background.gradient) {
                const { direction, colors } = background.gradient;
                let grad;
                if (direction.includes('right')) grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
                else if (direction.includes('bottom')) grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
                else if (direction.includes('radial')) grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 10, canvas.width/2, canvas.height/2, canvas.width/2);
                else grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                
                grad.addColorStop(0, colors[0]);
                grad.addColorStop(1, colors[1]);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (background.type === 'image' && background.image) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                try {
                    const img = await loadImage(background.image.src);
                    const w = img.width * background.image.scale;
                    const h = img.height * background.image.scale;
                    ctx.drawImage(img, background.image.x, background.image.y, w, h);
                } catch (e) { console.error("Could not load background", e); }
            }

            if (overlay.opacity > 0) {
                ctx.fillStyle = overlay.color;
                ctx.globalAlpha = overlay.opacity;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1.0;
            }

            for (const el of elements) {
                ctx.save();
                ctx.translate(el.x, el.y);
                ctx.rotate((el.rotation * Math.PI) / 180);

                if (el.type === 'text') {
                    const textEl = el as TextElement;
                    if (textEl.shadowEnabled && textEl.shadow) {
                         const color = hexToRgba(textEl.shadow.color, textEl.shadow.opacity);
                         ctx.shadowColor = color;
                         ctx.shadowBlur = textEl.shadow.blur;
                         ctx.shadowOffsetX = textEl.shadow.x;
                         ctx.shadowOffsetY = textEl.shadow.y;
                    }
                    const fontName = FONTS.find(f => f.value === textEl.fontFamily)?.name || 'Arial';
                    ctx.font = `${textEl.fontSize}px "${fontName}"`;
                    ctx.fillStyle = textEl.color;
                    ctx.textAlign = textEl.align;
                    ctx.textBaseline = 'middle';
                    const lines = textEl.content.split('\n');
                    const lineHeight = textEl.fontSize * 1.2;
                    const totalHeight = lines.length * lineHeight;
                    const startY = -(totalHeight / 2) + (lineHeight / 2);
                    lines.forEach((line, i) => {
                        ctx.fillText(line, 0, startY + (i * lineHeight));
                    });
                } else if (el.type === 'image') {
                    const imgEl = el as ImageElement;
                    try {
                        const img = await loadImage(imgEl.src);
                        const radius = imgEl.borderRadius || 0;
                        const crop = imgEl.crop || { top: 0, right: 0, bottom: 0, left: 0 };
                        const shadow = imgEl.shadow;

                        // FIX: Apply shadow to context before clipping
                        // But standard canvas clip() clips the shadow too if not handled carefully
                        // Strategy: Draw shadow first, then clip and draw image?
                        // Actually, drop-shadow filter on canvas context is supported in modern browsers
                        
                        if (shadow && shadow.opacity > 0) {
                            const shadowColor = hexToRgba(shadow.color, shadow.opacity);
                            ctx.filter = `drop-shadow(${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadowColor})`;
                        } else {
                            ctx.filter = 'none';
                        }

                        const cropL = imgEl.width * (crop.left / 100);
                        const cropT = imgEl.height * (crop.top / 100);
                        const cropR = imgEl.width * (crop.right / 100);
                        const cropB = imgEl.height * (crop.bottom / 100);
                        const visibleW = imgEl.width - cropL - cropR;
                        const visibleH = imgEl.height - cropT - cropB;
                        const drawX = -imgEl.width / 2 + cropL;
                        const drawY = -imgEl.height / 2 + cropT;

                        ctx.beginPath();
                        ctx.roundRect(drawX, drawY, visibleW, visibleH, radius);
                        ctx.save(); // Save state before clip
                        ctx.clip();
                        
                        ctx.drawImage(img, -imgEl.width / 2, -imgEl.height / 2, imgEl.width, imgEl.height);
                        ctx.restore(); // Restore clip
                        
                        // Reset filter for border
                        ctx.filter = 'none';

                        if (imgEl.border && imgEl.border.width > 0) {
                            ctx.beginPath();
                            ctx.roundRect(drawX, drawY, visibleW, visibleH, radius);
                            ctx.lineWidth = imgEl.border.width;
                            ctx.strokeStyle = imgEl.border.color;
                            if (imgEl.border.style === 'dashed') ctx.setLineDash([10, 5]);
                            if (imgEl.border.style === 'dotted') ctx.setLineDash([2, 2]);
                            ctx.stroke();
                        }

                    } catch (e) { console.error("Could not load image element", e); }
                } else if (el.type === 'shape') {
                    const shapeEl = el as ShapeElement;
                    const radius = shapeEl.borderRadius || 0;
                    const shadow = shapeEl.shadow;

                    if (shadow && shadow.opacity > 0) {
                        const shadowColor = hexToRgba(shadow.color, shadow.opacity);
                         ctx.shadowColor = shadowColor;
                         ctx.shadowBlur = shadow.blur;
                         ctx.shadowOffsetX = shadow.x;
                         ctx.shadowOffsetY = shadow.y;
                    }

                    ctx.fillStyle = shapeEl.color;
                    ctx.beginPath();
                    if (shapeEl.shapeType === 'circle') {
                        ctx.ellipse(0, 0, shapeEl.width / 2, shapeEl.height / 2, 0, 0, 2 * Math.PI);
                    } else {
                         ctx.roundRect(-shapeEl.width / 2, -shapeEl.height / 2, shapeEl.width, shapeEl.height, radius);
                    }
                    ctx.fill();

                    ctx.shadowColor = 'transparent';

                    if (shapeEl.border && shapeEl.border.width > 0) {
                         ctx.lineWidth = shapeEl.border.width;
                         ctx.strokeStyle = shapeEl.border.color;
                         if (shapeEl.border.style === 'dashed') ctx.setLineDash([10, 5]);
                         if (shapeEl.border.style === 'dotted') ctx.setLineDash([2, 2]);
                         ctx.stroke();
                    }
                }
                ctx.restore();
            }

            const link = document.createElement('a');
            link.download = `design-${Date.now()}.png`;
            link.href = ctx.canvas.toDataURL('image/png');
            link.click();
        };

        render();
    };

    const deleteSelected = () => {
        if (selectedId === 'bg') {
            setBackground({ type: 'solid', color: '#ffffff' });
            setSelectedId(null);
        } else {
            setElements(elements.filter(t => t.id !== selectedId));
            setSelectedId(null);
            setIsCropping(false);
        }
    };

    const updateElement = (key: string, value: any) => {
        if (!selectedId || selectedId === 'bg') return;
        setElements(elements.map(el => {
             if (el.id === selectedId) {
                 if (key.includes('.')) {
                     const [parent, child] = key.split('.');
                     return { 
                         ...el, 
                         [parent]: { ...(el as any)[parent], [child]: value } 
                     };
                 }
                 return { ...el, [key]: value };
             }
             return el;
        }));
    };

    const selectedElement = elements.find(t => t.id === selectedId);

    // --- Eraser Modal Renderer ---
    useEffect(() => {
        if (isErasing && eraserCanvasRef.current && selectedElement && selectedElement.type === 'image') {
            const canvas = eraserCanvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = (selectedElement as ImageElement).src;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
            };
        }
    }, [isErasing, selectedElement]);

    const handleEraserDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.buttons !== 1) return; 
        const canvas = eraserCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.globalCompositeOperation = 'destination-out';
        
        const drawPoint = (pX: number, pY: number) => {
            ctx.beginPath();
            const radgrad = ctx.createRadialGradient(pX, pY, 0, pX, pY, eraserBrushSize);
            // Center is full strength of eraser opacity (e.g., 0.5 opacity removes 50% of color)
            // But 'destination-out' uses alpha to determine how much to remove.
            // If Opacity is 100%, we want alpha 1. If 50%, we want alpha 0.5.
            radgrad.addColorStop(0, `rgba(0,0,0,${eraserOpacity})`); 
            radgrad.addColorStop(eraserHardness, `rgba(0,0,0,${eraserOpacity})`); 
            radgrad.addColorStop(1, `rgba(0,0,0,0)`);
            ctx.fillStyle = radgrad;
            ctx.arc(pX, pY, eraserBrushSize, 0, Math.PI * 2);
            ctx.fill();
        }

        if (eraserLastPos.current) {
            const dist = Math.hypot(x - eraserLastPos.current.x, y - eraserLastPos.current.y);
            const steps = Math.ceil(dist / (eraserBrushSize * 0.2)); 
            
            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                const interpX = eraserLastPos.current.x + (x - eraserLastPos.current.x) * t;
                const interpY = eraserLastPos.current.y + (y - eraserLastPos.current.y) * t;
                drawPoint(interpX, interpY);
            }
        }
        
        drawPoint(x, y);
        eraserLastPos.current = { x, y };
        
        ctx.globalCompositeOperation = 'source-over';
    };


    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in pb-12 relative">
            
            {/* --- ERASER MODAL --- */}
            {isErasing && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-2xl flex items-center gap-4 mb-4 z-[101]">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Chế độ Tẩy Xóa</span>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <div className="flex items-center gap-2">
                             <span className="text-xs">Kích thước: {eraserBrushSize}px</span>
                             <input type="range" min="5" max="100" value={eraserBrushSize} onChange={(e) => setEraserBrushSize(Number(e.target.value))} className="w-24"/>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-xs">Độ cứng: {(eraserHardness * 100).toFixed(0)}%</span>
                             <input type="range" min="0.1" max="1" step="0.1" value={eraserHardness} onChange={(e) => setEraserHardness(Number(e.target.value))} className="w-24"/>
                        </div>
                         <div className="flex items-center gap-2">
                             <span className="text-xs">Độ mờ: {(eraserOpacity * 100).toFixed(0)}%</span>
                             <input type="range" min="0.05" max="1" step="0.05" value={eraserOpacity} onChange={(e) => setEraserOpacity(Number(e.target.value))} className="w-24"/>
                        </div>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <Button onClick={saveEraserResult} className="py-1 px-4 text-sm bg-green-500 hover:bg-green-600 border-none">Lưu lại</Button>
                        <button onClick={() => setIsErasing(false)} className="text-red-500 hover:text-red-600"><XMarkIcon className="w-6 h-6"/></button>
                    </div>
                    
                    <div className="relative overflow-auto max-w-[90vw] max-h-[80vh] border-2 border-white/20 rounded" style={{
                         backgroundImage: 'conic-gradient(#ccc 90deg, #fff 90deg 180deg, #ccc 180deg 270deg, #fff 270deg)',
                         backgroundSize: '20px 20px'
                    }}>
                        <canvas 
                            ref={eraserCanvasRef}
                            className="cursor-crosshair block"
                            onMouseMove={handleEraserDraw}
                            onMouseDown={handleEraserDraw}
                            onMouseLeave={() => { eraserLastPos.current = null; }}
                        />
                    </div>
                </div>
            )}


            {/* LEFT: CANVAS AREA */}
            <div className="flex-1 flex flex-col items-center bg-gray-100 dark:bg-slate-900/50 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 min-h-[600px] justify-center relative overflow-hidden">
                
                {/* Canvas Container */}
                <div 
                    ref={containerRef}
                    className="relative bg-white shadow-2xl overflow-hidden cursor-crosshair group transition-all duration-300"
                    style={{ 
                        width: aspectRatio === '9:16' ? canvasDimensions.width : '100%', 
                        height: canvasDimensions.height,
                        maxWidth: aspectRatio === '9:16' ? 'none' : '100%',
                    }}
                    onMouseDown={handleCanvasClick}
                >
                    {background.type === 'solid' && background.color === '#ffffff' && elements.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 pointer-events-none z-0">
                            <UploadIcon className="w-16 h-16 mb-4" />
                            <p className="text-xl font-bold">Dán ảnh (Ctrl+V) hoặc Tải lên</p>
                        </div>
                    )}

                    {/* 1. Background Layer */}
                    <div 
                        className={`absolute inset-0 pointer-events-none z-0`}
                        style={{
                            background: background.type === 'solid' 
                                ? background.color 
                                : (background.type === 'gradient' && background.gradient 
                                    ? `${background.gradient.type}-gradient(${background.gradient.direction}${background.gradient.type === 'linear' ? ',' : ', circle, '} ${background.gradient.colors[0]}, ${background.gradient.colors[1]})` 
                                    : 'transparent')
                        }}
                    />
                    
                    {background.type === 'image' && background.image && (
                        <div
                            className={`absolute origin-top-left ${selectedId === 'bg' ? 'ring-2 ring-amber-500 z-10' : 'z-0'}`}
                            style={{
                                transform: `translate(${background.image.x}px, ${background.image.y}px) scale(${background.image.scale})`,
                                touchAction: 'none'
                            }}
                            onMouseDown={(e) => handleMouseDown(e, 'bg', 'move')}
                            onTouchStart={(e) => handleMouseDown(e, 'bg', 'move')}
                        >
                            <img 
                                src={background.image.src} 
                                alt="Background" 
                                draggable={false}
                                className="max-w-none pointer-events-none"
                            />
                        </div>
                    )}

                    {/* 2. Overlay Layer */}
                    {overlay.opacity > 0 && (
                        <div 
                            className="absolute inset-0 pointer-events-none z-[1]"
                            style={{ backgroundColor: overlay.color, opacity: overlay.opacity }}
                        />
                    )}

                    {/* 3. Render Elements */}
                    {elements.map((el, index) => {
                        const crop = el.crop || { top: 0, right: 0, bottom: 0, left: 0 };
                        const radius = (el.type === 'image' || el.type === 'shape') ? (el as any).borderRadius || 0 : 0;
                        const clipPath = `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}% round ${radius}px)`;
                        
                        const isSelected = selectedId === el.id;
                        const croppingThis = isCropping && isSelected;
                        
                        const border = el.border;
                        const shadow = el.shadow;
                        
                        let filterStyle = 'none';
                        let textShadowStyle = 'none';

                        if (shadow && shadow.opacity > 0) {
                             const shadowColor = hexToRgba(shadow.color, shadow.opacity);
                             if (el.type === 'text') {
                                textShadowStyle = `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadowColor}`;
                             } else {
                                // Important: Apply drop-shadow here (on the parent wrapper's internal filter div)
                                filterStyle = `drop-shadow(${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadowColor})`;
                             }
                        }

                        return (
                        <div
                            key={el.id}
                            className={`absolute group cursor-move select-none`}
                            style={{
                                transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg) translate(-50%, -50%)`,
                                top: 0, left: 0,
                                zIndex: index + 10 
                            }}
                            onMouseDown={(e) => handleMouseDown(e, el.id, 'move')}
                            onTouchStart={(e) => handleMouseDown(e, el.id, 'move')}
                        >
                            {/* Layer 1: Shadow Wrapper (Not Clipped) */}
                            <div style={{ filter: filterStyle, transition: 'filter 0.1s' }}>
                                
                                {/* Layer 2: Clipped Content */}
                                <div className={`relative ${isSelected && !croppingThis ? 'ring-2 ring-amber-500 ring-dashed' : 'hover:ring-1 hover:ring-gray-300'}`}
                                     style={{ 
                                        clipPath: clipPath,
                                        // Apply border here so it gets clipped with the shape
                                        border: (border && border.width > 0) ? `${border.width}px ${border.style} ${border.color}` : 'none',
                                        borderRadius: `${radius}px`,
                                     }}
                                >
                                    {el.type === 'text' && (() => {
                                        const textEl = el as TextElement;
                                        return (
                                            <div 
                                                className="px-2 py-1 min-w-[20px]"
                                                style={{
                                                    fontSize: `${textEl.fontSize}px`,
                                                    color: textEl.color,
                                                    textAlign: textEl.align,
                                                    textShadow: textEl.shadowEnabled ? textShadowStyle : 'none',
                                                    fontFamily: FONTS.find(f => f.value === textEl.fontFamily)?.name,
                                                    lineHeight: 1.2
                                                }}
                                            >
                                                <div className={`${isSelected ? 'opacity-0' : 'opacity-100'}`} style={{ whiteSpace: 'pre', minHeight: '1.2em' }}>
                                                    {textEl.content || ' '}
                                                </div>
                                                {isSelected && (
                                                    <textarea
                                                        autoFocus
                                                        value={textEl.content}
                                                        onChange={(e) => updateElement('content', e.target.value)}
                                                        className="absolute inset-0 w-full h-full bg-transparent outline-none resize-none overflow-hidden px-2 py-1"
                                                        style={{ 
                                                            color: textEl.color, 
                                                            textAlign: textEl.align,
                                                            fontFamily: 'inherit',
                                                            fontSize: 'inherit',
                                                            lineHeight: 1.2,
                                                            textShadow: 'none' 
                                                        }}
                                                        spellCheck={false}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {el.type === 'image' && (() => {
                                        const imgEl = el as ImageElement;
                                        return (
                                            <img 
                                                src={imgEl.src} 
                                                alt="element" 
                                                draggable={false}
                                                style={{ width: imgEl.width, height: imgEl.height }}
                                                className="pointer-events-none block"
                                            />
                                        );
                                    })()}

                                    {el.type === 'shape' && (() => {
                                        const shapeEl = el as ShapeElement;
                                        return (
                                            <div
                                                style={{
                                                    width: shapeEl.width,
                                                    height: shapeEl.height,
                                                    backgroundColor: shapeEl.color,
                                                    borderRadius: shapeEl.shapeType === 'circle' ? '50%' : '0' 
                                                }}
                                            />
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Controls: OUTSIDE of clip-path so they are always visible */}
                            {/* Crop Overlay UI */}
                            {croppingThis && (
                                <div className="absolute inset-0 pointer-events-auto">
                                    <div 
                                        className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                                        style={{
                                            top: `${crop.top}%`,
                                            bottom: `${crop.bottom}%`,
                                            left: `${crop.left}%`,
                                            right: `${crop.right}%`,
                                        }}
                                    >
                                            {/* Handles */}
                                        {['lt','rt','lb','rb'].map(pos => (
                                            <div 
                                                key={pos}
                                                className={`absolute w-4 h-4 bg-white border border-gray-400 z-50 ${pos==='lt' ? '-top-2 -left-2 cursor-nwse-resize' : pos==='rt' ? '-top-2 -right-2 cursor-nesw-resize' : pos==='lb' ? '-bottom-2 -left-2 cursor-nesw-resize' : '-bottom-2 -right-2 cursor-nwse-resize'}`}
                                                onMouseDown={(e) => handleMouseDown(e, el.id, 'crop', pos as any)}
                                                onTouchStart={(e) => handleMouseDown(e, el.id, 'crop', pos as any)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isSelected && !croppingThis && (
                                <>
                                    <div 
                                        className="absolute -top-10 left-1/2 w-8 h-8 bg-white text-slate-800 rounded-full cursor-grab shadow-lg flex items-center justify-center hover:bg-amber-100 transform -translate-x-1/2"
                                        onMouseDown={(e) => handleMouseDown(e, el.id, 'rotate')}
                                        onTouchStart={(e) => handleMouseDown(e, el.id, 'rotate')}
                                    >
                                        <RotateIcon className="w-4 h-4" />
                                    </div>
                                    <div 
                                        className="absolute -bottom-4 -right-4 w-6 h-6 bg-amber-500 rounded-full cursor-se-resize shadow-md border-2 border-white hover:scale-110"
                                        onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')}
                                        onTouchStart={(e) => handleMouseDown(e, el.id, 'resize')}
                                    />
                                </>
                            )}
                        </div>
                    )})}
                </div>

                {/* Bottom Canvas Controls */}
                <div className="mt-6 flex gap-4">
                    <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-slate-700">
                        {['1:1', '16:9', '9:16'].map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio as AspectRatio)}
                                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${aspectRatio === ratio ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'}`}
                            >
                                {ratio}
                            </button>
                        ))}
                    </div>
                    <Button onClick={handleDownload} className="py-2 px-6">
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        Tải ảnh về
                    </Button>
                </div>
            </div>

            {/* RIGHT: TOOLBAR */}
            <div className="w-full lg:w-80 flex flex-col gap-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
                
                {/* 1. Add Content Panel */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <PaletteIcon className="w-5 h-5 text-amber-500" />
                        Công cụ
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                         <label className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-amber-400 transition-colors">
                            <UploadIcon className="w-6 h-6 mb-2 text-blue-500" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Tải ảnh nền</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                        </label>
                        <button onClick={addText} className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-amber-400 transition-colors">
                            <TypeIcon className="w-6 h-6 mb-2 text-pink-500" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Thêm chữ</span>
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                         <label className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-amber-400 transition-colors">
                            <ImageIcon className="w-5 h-5 mb-1 text-green-500" />
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Ảnh Deco</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleDecoUpload} />
                        </label>
                         <button onClick={() => addShape('rectangle')} className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-amber-400 transition-colors">
                            <SquareIcon className="w-5 h-5 mb-1 text-indigo-500" />
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Hình vuông</span>
                        </button>
                         <button onClick={() => addShape('circle')} className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-amber-400 transition-colors">
                            <CircleIcon className="w-5 h-5 mb-1 text-purple-500" />
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Hình tròn</span>
                        </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2">
                            <LayersIcon className="w-4 h-4" />
                            Lớp phủ màu (Overlay)
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input 
                                type="color" 
                                value={overlay.color}
                                onChange={(e) => setOverlay({ ...overlay, color: e.target.value })}
                                className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                            />
                            <div className="flex-1">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="0.9" 
                                    step="0.1" 
                                    value={overlay.opacity}
                                    onChange={(e) => setOverlay({ ...overlay, opacity: parseFloat(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>Trong suốt</span>
                                    <span>{(overlay.opacity * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Selection Properties Panel */}
                {selectedId && selectedId !== 'bg' && selectedElement && (
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-slide-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <EditIcon className="w-5 h-5 text-amber-500" />
                                {selectedElement.type === 'text' ? 'Chỉnh sửa Chữ' : (selectedElement.type === 'image' ? 'Chỉnh sửa Ảnh' : 'Chỉnh sửa Hình')}
                            </h3>
                            <button onClick={deleteSelected} className="text-red-500 hover:bg-red-50 p-2 rounded-full">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>

                         {/* Common Layer Controls */}
                         <div className="mb-4">
                             <div className="flex gap-1 mb-2">
                                <button onClick={() => moveLayer('bottom')} title="Dưới cùng" className="flex-1 bg-slate-100 dark:bg-slate-800 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex justify-center"><ChevronDoubleDownIcon className="w-4 h-4" /></button>
                                <button onClick={() => moveLayer('down')} title="Xuống 1 lớp" className="flex-1 bg-slate-100 dark:bg-slate-800 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex justify-center"><ArrowDownIcon className="w-4 h-4" /></button>
                                <button onClick={() => moveLayer('up')} title="Lên 1 lớp" className="flex-1 bg-slate-100 dark:bg-slate-800 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex justify-center"><ArrowUpIcon className="w-4 h-4" /></button>
                                <button onClick={() => moveLayer('top')} title="Trên cùng" className="flex-1 bg-slate-100 dark:bg-slate-800 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex justify-center"><ChevronDoubleUpIcon className="w-4 h-4" /></button>
                             </div>
                        </div>

                        {/* Special Tools for Image */}
                        {selectedElement.type === 'image' && (
                            <div className="mb-4 grid grid-cols-2 gap-2">
                                 <button 
                                    onClick={startCropping}
                                    className={`flex items-center justify-center gap-1 p-2 rounded-lg text-xs font-bold transition-colors ${isCropping ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'}`}
                                >
                                    <CropIcon className="w-4 h-4" /> Cắt (Crop)
                                </button>
                                <button 
                                    onClick={handleRemoveBackground}
                                    disabled={isProcessingRemoveBg}
                                    className="flex items-center justify-center gap-1 p-2 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
                                >
                                    {isProcessingRemoveBg ? <Spinner /> : <MagicWandIcon className="w-4 h-4" />}
                                    Tách nền AI
                                </button>
                                <button 
                                    onClick={startErasing}
                                    className="col-span-2 flex items-center justify-center gap-1 p-2 rounded-lg text-xs font-bold bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 transition-colors"
                                >
                                    <div className="w-4 h-4 bg-pink-500 rounded-full" /> Tẩy xóa (Eraser Brush)
                                </button>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* ---------- BORDER SECTION ---------- */}
                            {(selectedElement.type === 'image' || selectedElement.type === 'shape') && (
                                <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">Đường Viền (Border)</label>
                                    <div className="flex gap-2 mb-2">
                                        <input type="color" value={selectedElement.border?.color || '#000000'} onChange={(e) => updateElement('border.color', e.target.value)} className="w-8 h-8 rounded border-0" />
                                        <select value={selectedElement.border?.style || 'solid'} onChange={(e) => updateElement('border.style', e.target.value)} className="text-xs rounded border-gray-200 bg-white">
                                            <option value="solid">Solid</option>
                                            <option value="dashed">Dashed</option>
                                            <option value="dotted">Dotted</option>
                                        </select>
                                        <input type="number" min="0" max="20" value={selectedElement.border?.width || 0} onChange={(e) => updateElement('border.width', Number(e.target.value))} className="w-16 text-xs rounded border-gray-200" placeholder="px" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Bo góc (Radius)</span>
                                        <input type="range" min="0" max="100" value={selectedElement.borderRadius || 0} onChange={(e) => updateElement('borderRadius', Number(e.target.value))} className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"/>
                                    </div>
                                </div>
                            )}

                            {/* ---------- SHADOW SECTION ---------- */}
                            <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                                <label className="text-xs font-bold text-slate-500 mb-2 block">Đổ Bóng (Shadow)</label>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div className="flex items-center gap-1">
                                         <input type="color" value={selectedElement.shadow?.color || '#000000'} onChange={(e) => updateElement('shadow.color', e.target.value)} className="w-6 h-6 rounded border-0" />
                                         <span className="text-[10px] text-slate-400">Màu</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-slate-400">Mờ (Blur)</label>
                                        <input type="range" min="0" max="50" value={selectedElement.shadow?.blur || 0} onChange={(e) => updateElement('shadow.blur', Number(e.target.value))} className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"/>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                     <div className="flex flex-col">
                                        <label className="text-[10px] text-slate-400">Trục X ({selectedElement.shadow?.x || 0})</label>
                                        <input type="range" min="-100" max="100" value={selectedElement.shadow?.x || 0} onChange={(e) => updateElement('shadow.x', Number(e.target.value))} className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"/>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-slate-400">Trục Y ({selectedElement.shadow?.y || 0})</label>
                                        <input type="range" min="-100" max="100" value={selectedElement.shadow?.y || 0} onChange={(e) => updateElement('shadow.y', Number(e.target.value))} className="h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"/>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 w-12">Đậm nhạt</span>
                                    <input type="range" min="0" max="1" step="0.1" value={selectedElement.shadow?.opacity ?? 0.5} onChange={(e) => updateElement('shadow.opacity', Number(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"/>
                                </div>
                            </div>
                            
                            {/* Text Specifics */}
                            {selectedElement.type === 'text' && (
                                <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                                    <textarea 
                                        value={(selectedElement as TextElement).content}
                                        onChange={(e) => updateElement('content', e.target.value)}
                                        className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                                        rows={2}
                                    />
                                    <div className="mt-2">
                                        <select 
                                            value={(selectedElement as TextElement).fontFamily}
                                            onChange={(e) => updateElement('fontFamily', e.target.value)}
                                            className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                                        >
                                            {FONTS.map(f => (
                                                <option key={f.value} value={f.value}>{f.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <input 
                                            type="color" 
                                            value={(selectedElement as TextElement).color}
                                            onChange={(e) => updateElement('color', e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer"
                                        />
                                         <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex-1">
                                            {['left', 'center', 'right'].map((align) => (
                                                <button
                                                    key={align}
                                                    onClick={() => updateElement('align', align)}
                                                    className={`flex-1 py-1 rounded text-xs font-bold capitalize ${
                                                        (selectedElement as TextElement).align === align 
                                                        ? 'bg-white dark:bg-slate-600 shadow text-amber-600' 
                                                        : 'text-slate-500'
                                                    }`}
                                                >
                                                    {align}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Shape Specifics */}
                            {selectedElement.type === 'shape' && (
                                <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Màu hình khối</label>
                                    <input 
                                        type="color" 
                                        value={(selectedElement as ShapeElement).color}
                                        onChange={(e) => updateElement('color', e.target.value)}
                                        className="w-full h-10 rounded cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* BACKGROUND SETTINGS */}
                {(selectedId === 'bg' || !selectedId) && (
                     <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-slide-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-purple-500" />
                                Thiết kế Nền (Background)
                            </h3>
                             {background.type === 'image' && (
                                <button onClick={deleteSelected} className="text-red-500 hover:bg-red-50 p-2 rounded-full">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                             )}
                        </div>

                        <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button onClick={() => setBackground(prev => ({ ...prev, type: 'solid' }))} className={`flex-1 py-1 text-xs font-bold rounded ${background.type==='solid' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>Đơn sắc</button>
                            <button onClick={() => setBackground(prev => ({ ...prev, type: 'gradient', gradient: { type: 'linear', direction: 'to right', colors: ['#ff9a9e', '#fad0c4'] } }))} className={`flex-1 py-1 text-xs font-bold rounded ${background.type==='gradient' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>Gradient</button>
                            <button onClick={() => document.getElementById('bg-upload-trigger')?.click()} className={`flex-1 py-1 text-xs font-bold rounded ${background.type==='image' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>Ảnh</button>
                            <input type="file" id="bg-upload-trigger" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                        </div>

                        {background.type === 'solid' && (
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Màu nền</label>
                                <input type="color" value={background.color || '#ffffff'} onChange={(e) => setBackground({ type: 'solid', color: e.target.value })} className="w-full h-10 rounded cursor-pointer"/>
                            </div>
                        )}

                        {background.type === 'gradient' && background.gradient && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-500 block mb-1">Màu bắt đầu & Kết thúc</label>
                                    <div className="flex gap-2">
                                        <input type="color" value={background.gradient.colors[0]} onChange={(e) => setBackground({ ...background, gradient: { ...background.gradient!, colors: [e.target.value, background.gradient!.colors[1]] } })} className="flex-1 h-8 rounded"/>
                                        <input type="color" value={background.gradient.colors[1]} onChange={(e) => setBackground({ ...background, gradient: { ...background.gradient!, colors: [background.gradient!.colors[0], e.target.value] } })} className="flex-1 h-8 rounded"/>
                                    </div>
                                </div>
                                <div>
                                     <label className="text-xs text-slate-500 block mb-1">Hướng (Direction)</label>
                                     <select value={background.gradient.direction} onChange={(e) => setBackground({ ...background, gradient: { ...background.gradient!, direction: e.target.value } })} className="w-full text-xs p-2 rounded border border-gray-200">
                                         <option value="to right">Trái sang Phải</option>
                                         <option value="to left">Phải sang Trái</option>
                                         <option value="to bottom">Trên xuống Dưới</option>
                                         <option value="to top">Dưới lên Trên</option>
                                         <option value="45deg">Chéo 45 độ</option>
                                     </select>
                                </div>
                            </div>
                        )}

                        {background.type === 'image' && background.image && (
                            <div className="mt-4">
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Tỉ lệ Zoom: {background.image.scale.toFixed(2)}x</label>
                                <input 
                                    type="range" 
                                    min="0.1" 
                                    max="3.0" 
                                    step="0.05" 
                                    value={background.image.scale || 1}
                                    onChange={(e) => setBackground({ ...background, image: { ...background.image!, scale: parseFloat(e.target.value) } })}
                                    className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <p className="text-[10px] text-slate-400 mt-2 italic">Kéo thả ảnh trực tiếp trên khung thiết kế để di chuyển vị trí.</p>
                            </div>
                        )}
                     </div>
                )}
            </div>
        </div>
    );
};
