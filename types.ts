export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type ImageQuality = "Standard" | "4K" | "8K Ultra";

export interface AIConfig {
    model: string;
    apiKey?: string | null;
}

export interface GenerateImageData {
    prompt: string;
    aspectRatio: AspectRatio;
    sourceImages: File[];
    faceConsistency: boolean;
    stylePrompts?: string[]; // Array of style descriptions to generate multiple images
}

export interface EditImageData {
    prompt: string;
    characterImage: File | null;
    productImage: File | null;
    contextImage: File | null;
    imageCount: number;
    quality: ImageQuality;
    faceConsistency: boolean;
    // New fields for refinement
    baseImage?: string | null; // Base64 string of the selected generated image
    designRefImage?: File | null; // Optional design reference image
    posterReferenceImage?: File | null; // New: Poster layout reference
    // New field for background removal
    autoRemoveBackground?: boolean;
}