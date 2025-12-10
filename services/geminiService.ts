
import { GoogleGenAI, Modality, Type, Schema } from "@google/genai";
import type { AspectRatio, ImageQuality, AIConfig } from '../types';
import { fileToBase64 } from '../utils/fileUtils';

// Helper to initialize AI with specific config
const getAIClient = (aiConfig?: AIConfig) => {
    // Ưu tiên Key người dùng nhập, nếu không có thì dùng Key của Server
    const key = aiConfig?.apiKey || process.env.API_KEY;
    if (!key) {
        throw new Error("Vui lòng nhập API Key hoặc thiết lập biến môi trường API_KEY.");
    }
    return new GoogleGenAI({ apiKey: key });
};

// This function handles both text-to-image and image-and-text-to-image for the "Generate" tab
export const generateImage = async (
    prompt: string,
    aspectRatio: AspectRatio,
    sourceImages?: { data: string, mimeType: string }[],
    faceConsistency?: boolean,
    aiConfig?: AIConfig
): Promise<string> => {
    const ai = getAIClient(aiConfig);
    const modelName = aiConfig?.model || 'gemini-2.5-flash-image';

    try {
        if (sourceImages && sourceImages.length > 0) {
            const imageParts = sourceImages.map(image => ({
                inlineData: {
                    data: image.data,
                    mimeType: image.mimeType,
                },
            }));

            let finalPrompt = prompt;
            if (faceConsistency) {
                finalPrompt = `${prompt}. QUAN TRỌNG: Hãy chú ý kỹ đến khuôn mặt trong ảnh gốc. Hình ảnh được tạo ra phải giữ lại chính xác các đặc điểm, biểu cảm và trạng thái cảm xúc của khuôn mặt gốc. Không thay đổi hình dạng, đặc điểm hoặc biểu cảm của khuôn mặt.`;
            }

            const response = await ai.models.generateContent({
                model: modelName,
                contents: {
                    parts: [ ...imageParts, { text: finalPrompt } ],
                },
                // Removed responseModalities to avoid 403 errors
            });

            const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
            if (imagePart && imagePart.inlineData) {
                return imagePart.inlineData.data;
            } else {
                 const textPart = response.candidates?.[0]?.content?.parts.find(part => part.text);
                if(textPart?.text) {
                     throw new Error(`API không trả về ảnh. Phản hồi: ${textPart.text}`);
                }
                throw new Error("Không nhận được hình ảnh từ API.");
            }
        } else {
            const isGeminiModel = modelName.includes('gemini');

            if (isGeminiModel) {
                 const response = await ai.models.generateContent({
                    model: modelName,
                    contents: {
                        parts: [{ text: prompt }]
                    },
                    config: {
                         // Optional image config if supported by the model version
                         imageConfig: {
                             aspectRatio: aspectRatio
                         }
                    }
                });
                const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
                if (imagePart && imagePart.inlineData) {
                    return imagePart.inlineData.data;
                }
                // Fallback: check if text contains an error or refusal
                const textPart = response.candidates?.[0]?.content?.parts.find(part => part.text);
                if (textPart?.text) {
                    console.warn("Text response instead of image:", textPart.text);
                }
                throw new Error("Không nhận được hình ảnh từ Gemini. Vui lòng thử lại hoặc kiểm tra API Key.");

            } else {
                // Imagen Fallback
                const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: prompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: aspectRatio,
                    },
                });

                if (response.generatedImages && response.generatedImages.length > 0) {
                    return response.generatedImages[0].image.imageBytes;
                } else {
                    throw new Error("Không nhận được hình ảnh từ API.");
                }
            }
        }
    } catch (error: any) {
        console.error("Lỗi khi tạo ảnh:", error);
        if (error.status === 403) {
            throw new Error("Lỗi quyền truy cập (403): API Key không có quyền sử dụng model này hoặc dự án chưa kích hoạt API.");
        }
        throw new Error(error.message || "Không thể tạo ảnh. Vui lòng thử lại.");
    }
};

interface ImageInput {
    data: string;
    mimeType: string;
}

// Function to generate a single composition
const generateSingleComposition = async (
    parts: any[],
    finalPrompt: string,
    ai: GoogleGenAI,
    modelName: string
): Promise<string> => {
    const response = await ai.models.generateContent({
        model: modelName,
        contents: {
            parts: [...parts, { text: finalPrompt }],
        },
        // Removed responseModalities
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
    if (imagePart && imagePart.inlineData) {
        return imagePart.inlineData.data;
    }
     const textPart = response.candidates?.[0]?.content?.parts.find(part => part.text);
    if(textPart?.text) throw new Error(textPart.text);
    throw new Error("No image generated");
};


export const editImage = async (
    characterImage: ImageInput | null,
    productImage: ImageInput | null,
    contextImage: ImageInput | null,
    prompt: string,
    imageCount: number = 3,
    quality: ImageQuality = 'Standard',
    faceConsistency: boolean = false,
    baseImage: string | null = null,
    designRefImage: ImageInput | null = null,
    autoRemoveBackground: boolean = false,
    aiConfig?: AIConfig,
    posterReferenceImage: ImageInput | null = null
): Promise<string[]> => {
    const ai = getAIClient(aiConfig);
    const modelName = aiConfig?.model || 'gemini-2.5-flash-image';

    try {
        const parts: any[] = [];
        
        // Construct prompt based on quality and inputs
        let detailedPrompt = prompt;
        const qualityKeywords = {
            'Standard': 'high quality, professional lighting, commercial photography',
            '4K': '4k resolution, highly detailed, sharp focus, cinematic lighting, master quality',
            '8K Ultra': '8k ultra photorealistic, hyper-realistic, masterpiece, incredibly detailed, raw photo, ray tracing',
        };

        detailedPrompt += `\n\nStyle: ${qualityKeywords[quality]}. `;
        
        // Strict Rules for Composition
        detailedPrompt += `
        \n*** CRITICAL COMPOSITION & ANATOMY RULES ***
        1. PHYSICS & GRAVITY: The product MUST look physically present. It CANNOT float in mid-air. It must be resting on a surface or held firmly by a hand.
        2. NATURAL GRIP: If the character is holding the product, fingers must wrap AROUND it realistically. No "magnetic hands" where the object just sticks to the palm flatly. The grasp must look secure and natural.
        3. BODY PROPORTIONS (EXTREMELY IMPORTANT): 
           - If the '[Input 1: Character Reference]' is a headshot or portrait, you MUST generate a full body or upper body that is PROPORTIONATE to the head size.
           - Head-to-body ratio must be realistic (approx 1:7 or 1:8).
           - DO NOT generate a tiny body with a large head (no bobblehead effect). 
           - The generated body physique should fit a professional model aesthetic (fit, well-proportioned) unless specified otherwise.
        4. SCALE: The product size must be realistic relative to the person (e.g., a small jar fits in a palm; it is NOT the size of a head).
        5. LIGHTING MATCH: The product's lighting and shadows MUST match the scene's light source direction and intensity.
        `;

        if (baseImage) {
            // REFINEMENT MODE
            const cleanBaseImage = baseImage.replace(/^data:image\/\w+;base64,/, "");
            parts.push({ inlineData: { data: cleanBaseImage, mimeType: 'image/png' } });
            detailedPrompt += "\n[Input: Base Image] - This is the PRIMARY subject and composition source. Keep the character and product exactly as they are here, but update the background/poster elements.";
            
            if (posterReferenceImage) {
                parts.push({ inlineData: { data: posterReferenceImage.data, mimeType: posterReferenceImage.mimeType } });
                detailedPrompt += "\n[Input: Poster Layout Reference] - CRITICAL: Copy the LAYOUT, TEXT PLACEMENT (Simulated), and GRAPHIC ELEMENTS from this poster image. Combine the Base Image subject into this poster layout.";
                detailedPrompt += "\nTask: Create a professional Advertising Poster. Use the [Base Image] as the central visual, but wrap it in the design aesthetic and layout of the [Poster Layout Reference].";
            }

            if (designRefImage) {
                parts.push({ inlineData: { data: designRefImage.data, mimeType: designRefImage.mimeType } });
                detailedPrompt += "\n[Input: Design Style Reference] - Use the Color Grading and Lighting from this image.";
            }

            if (productImage) {
                parts.push({ inlineData: { data: productImage.data, mimeType: productImage.mimeType } });
                detailedPrompt += "\n[Input: Product Detail Reference] - Use this for high-fidelity product details if needed.";
            }
            
            if (!posterReferenceImage) {
                 detailedPrompt += "\nTask: Refine the Base Image based on the user prompt.";
            }

        } else {
            // STANDARD CREATION MODE
            if (faceConsistency && characterImage) {
                detailedPrompt += "\nCRITICAL: Keep the character's face exactly as shown in the character image. Maintain facial features, expression, and identity absolutely.";
            }

            if (characterImage) {
                parts.push({ inlineData: { data: characterImage.data, mimeType: characterImage.mimeType } });
                detailedPrompt += "\n[Input 1: Character Reference] - Use the face/identity from this image.";
            }
            if (productImage) {
                parts.push({ inlineData: { data: productImage.data, mimeType: productImage.mimeType } });
                detailedPrompt += "\n[Input 2: Product Reference] - Use this object. Keep its label/branding clear.";
            }
            if (contextImage) {
                parts.push({ inlineData: { data: contextImage.data, mimeType: contextImage.mimeType } });
                detailedPrompt += "\n[Input 3: Context/Background Reference] - Use this environment.";
            }

            detailedPrompt += "\nTask: Create a seamless, professional product advertisement compositing the product and character into the scene.";
        }

        const promises = Array(imageCount).fill(null).map(() => 
            generateSingleComposition(parts, detailedPrompt, ai, modelName)
        );

        const results = await Promise.all(promises);
        return results;

    } catch (error: any) {
        console.error("Lỗi khi chỉnh sửa ảnh:", error);
        if (error.status === 403) {
            throw new Error("Lỗi quyền truy cập (403): Vui lòng kiểm tra API Key hoặc Model được chọn.");
        }
        throw new Error(error.message || "Không thể chỉnh sửa ảnh. Vui lòng thử lại.");
    }
};

export const extractProductFromImage = async (file: File, aiConfig?: AIConfig): Promise<string> => {
    const ai = getAIClient(aiConfig);
    const modelName = aiConfig?.model || 'gemini-2.5-flash-image';
    
    try {
        const base64 = await fileToBase64(file);
        // Updated prompt to strictly request transparency
        const prompt = "TASK: Extract and isolate the main subject from this image. \n\nINSTRUCTIONS:\n1. Identify the main subject (product, person, or object).\n2. REMOVE the background completely. \n3. Output an image where the background is a solid, distinct color (like pure white) that is easy to remove programmatically, or ideally return a transparent PNG if the model supports it. \n4. Maintain high fidelity of edges.";

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    { inlineData: { data: base64, mimeType: file.type } },
                    { text: prompt }
                ]
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
        if (imagePart && imagePart.inlineData) {
            return imagePart.inlineData.data;
        }
        throw new Error("Không thể tách sản phẩm.");
    } catch (error) {
        console.error("Extraction error:", error);
        throw new Error("Lỗi khi tách sản phẩm.");
    }
};

export const analyzeProductImage = async (file: File, aiConfig?: AIConfig): Promise<string> => {
    const ai = getAIClient(aiConfig);

    try {
        const base64 = await fileToBase64(file);
        
        const systemInstruction = `**TASK:** You are a marketing expert AI. Analyze the product in the provided image.

**INSTRUCTIONS:**
1. Identify the product's name, primary function (công dụng), unique selling proposition (USP), and the target customer demographic.
2. Format the output as a bulleted list.

**OUTPUT FORMATTING (CRITICAL):**
- You MUST return a single string.
- Each piece of information MUST be on a new line, starting with a hyphen and a space (e.g., "- tên: ...").
- The string MUST strictly follow this exact structure:
- tên: [product name]
- công dụng: [product function]
- usp: [unique selling proposition]
- khách hàng mục tiêu: [target customer]
- Do NOT include any additional text, labels, or explanations before or after the list.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: {
                parts: [
                    { inlineData: { data: base64, mimeType: file.type } },
                    { text: systemInstruction }
                ]
            }
        });
        return response.text || "Không thể phân tích ảnh.";
    } catch (error) {
        console.error("Analysis error:", error);
        return "Lỗi khi phân tích ảnh sản phẩm.";
    }
};

export const analyzePosterStyle = async (file: File, aiConfig?: AIConfig): Promise<string> => {
    const ai = getAIClient(aiConfig);

    try {
        const base64 = await fileToBase64(file);
        const prompt = `You are a Creative Director. Analyze this advertising poster.
        
        Break down the "Visual Concept" into a concise instruction for an AI image generator to replicate this exact layout and vibe for a new product.
        
        Focus on:
        1. Layout: Where is the product? Where is the text? (e.g., "Centered product with large bold typography overhead")
        2. Background: Elements, scenery, or abstract shapes.
        3. Mood/Lighting: (e.g., "Fresh, sunny, nature-inspired" or "Dark, neon, premium")
        4. Text Style: Font style description (e.g., "Gold 3D lettering").
        
        Output format: Return ONLY the description paragraph in Vietnamese. Start with "Thiết kế Poster theo phong cách: ..."`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: base64, mimeType: file.type } },
                    { text: prompt }
                ]
            }
        });
        return response.text || "";
    } catch (error) {
        console.error("Poster analysis error:", error);
        return "";
    }
};

export const generatePromptIdeas = async (
    productDescription: string, 
    characterFile: File | null,
    aiConfig?: AIConfig
): Promise<string[]> => {
    const ai = getAIClient(aiConfig);

    try {
        const parts: any[] = [];
        
        if (characterFile) {
            const base64 = await fileToBase64(characterFile);
            parts.push({ inlineData: { data: base64, mimeType: characterFile.type } });
            parts.push({ text: "Reference Character Image" });
        }

        parts.push({ 
            text: `Based on the following product analysis, generate 3 distinct, high-end advertising photography prompts in Vietnamese.

Product Analysis:
${productDescription}

Rules:
1. ALWAYS refer to the person in the prompt as "**nhân vật trong ảnh tôi tải lên**" (the character in my uploaded photo). DO NOT use terms like "người đàn ông" (man), "người phụ nữ" (woman), "cô gái" (girl), or "chàng trai" (boy). This is mandatory.
2. The prompts must describe a scene where the "**nhân vật trong ảnh tôi tải lên**" is interacting naturally with the product.
3. CRITICAL: Explicitly describe HOW the product is supported (e.g., "tay cầm chắc thân chai", "đặt ngay ngắn trên bàn"). Avoid vague placement that causes floating objects.
4. Ensure the setting matches the "khách hàng mục tiêu" (target audience) and "công dụng" (function).
5. Specify lighting and mood suitable for the "usp".
6. Prompts must be detailed (40-60 words each).

Output JSON format: { "prompts": ["Prompt 1...", "Prompt 2...", "Prompt 3..."] }` 
        });

        // Use standard flash for text generation
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompts: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        const json = JSON.parse(response.text || "{}");
        return json.prompts || [];
    } catch (error) {
        console.error("Prompt generation error:", error);
        return [];
    }
};
