'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    X,
    Crop,
    Move,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Check,
    Link2,
    Upload,
    Lock,
    Unlock,
    Type,
    Image as ImageIcon,
    Maximize2,
} from 'lucide-react';

interface ImageEditorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (imageData: ImageData) => void;
    initialImage?: string;
    initialCaption?: string;
    initialWidth?: number;
    initialHeight?: number;
}

export interface ImageData {
    src: string;
    alt: string;
    caption: string;
    width?: number;
    height?: number;
}

type Mode = 'upload' | 'url' | 'edit';

export function ImageEditorDialog({
    isOpen,
    onClose,
    onInsert,
    initialImage,
    initialCaption = '',
    initialWidth,
    initialHeight,
}: ImageEditorDialogProps) {
    const [mode, setMode] = useState<Mode>(initialImage ? 'edit' : 'upload');
    const [imageSrc, setImageSrc] = useState(initialImage || '');
    const [imageUrl, setImageUrl] = useState('');
    const [caption, setCaption] = useState(initialCaption);
    const [altText, setAltText] = useState('');
    const [width, setWidth] = useState<number | undefined>(initialWidth);
    const [height, setHeight] = useState<number | undefined>(initialHeight);
    const [originalWidth, setOriginalWidth] = useState<number>(0);
    const [originalHeight, setOriginalHeight] = useState<number>(0);
    const [aspectLocked, setAspectLocked] = useState(true);
    const [aspectRatio, setAspectRatio] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Crop state
    const [isCropping, setIsCropping] = useState(false);
    const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
    const [cropEnd, setCropEnd] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cropContainerRef = useRef<HTMLDivElement>(null);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (initialImage) {
                setImageSrc(initialImage);
                setMode('edit');
            } else {
                setImageSrc('');
                setMode('upload');
            }
            setCaption(initialCaption);
            setWidth(initialWidth);
            setHeight(initialHeight);
            setIsCropping(false);
        }
    }, [isOpen, initialImage, initialCaption, initialWidth, initialHeight]);

    // Load image dimensions when src changes
    useEffect(() => {
        if (imageSrc) {
            const img = new window.Image();
            img.onload = () => {
                setOriginalWidth(img.naturalWidth);
                setOriginalHeight(img.naturalHeight);
                if (!width) setWidth(img.naturalWidth);
                if (!height) setHeight(img.naturalHeight);
                setAspectRatio(img.naturalWidth / img.naturalHeight);
            };
            img.src = imageSrc;
        }
    }, [imageSrc]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, selecione uma imagem');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('Imagem muito grande. Máximo: 10MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setImageSrc(result);
            setMode('edit');
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, []);

    const handleUrlSubmit = useCallback(() => {
        if (!imageUrl.trim()) {
            toast.error('Digite uma URL válida');
            return;
        }

        setIsLoading(true);
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            setImageSrc(imageUrl);
            setMode('edit');
            setIsLoading(false);
        };
        img.onerror = () => {
            toast.error('Não foi possível carregar a imagem');
            setIsLoading(false);
        };
        img.src = imageUrl;
    }, [imageUrl]);

    const handleWidthChange = useCallback((newWidth: number) => {
        setWidth(newWidth);
        if (aspectLocked && aspectRatio) {
            setHeight(Math.round(newWidth / aspectRatio));
        }
    }, [aspectLocked, aspectRatio]);

    const handleHeightChange = useCallback((newHeight: number) => {
        setHeight(newHeight);
        if (aspectLocked && aspectRatio) {
            setWidth(Math.round(newHeight * aspectRatio));
        }
    }, [aspectLocked, aspectRatio]);

    const resetSize = useCallback(() => {
        setWidth(originalWidth);
        setHeight(originalHeight);
    }, [originalWidth, originalHeight]);

    // Crop handlers
    const startCrop = useCallback((e: React.MouseEvent) => {
        if (!isCropping || !cropContainerRef.current) return;

        const rect = cropContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setCropStart({ x, y });
        setCropEnd({ x, y });
        setIsDragging(true);
    }, [isCropping]);

    const updateCrop = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !cropContainerRef.current) return;

        const rect = cropContainerRef.current.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
        const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);

        setCropEnd({ x, y });
    }, [isDragging]);

    const endCrop = useCallback(() => {
        setIsDragging(false);
    }, []);

    const applyCrop = useCallback(() => {
        if (!imageRef.current || !canvasRef.current) return;

        const img = imageRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate crop area relative to actual image size
        const displayWidth = img.clientWidth;
        const displayHeight = img.clientHeight;
        const scaleX = img.naturalWidth / displayWidth;
        const scaleY = img.naturalHeight / displayHeight;

        const cropX = Math.min(cropStart.x, cropEnd.x) * scaleX;
        const cropY = Math.min(cropStart.y, cropEnd.y) * scaleY;
        const cropWidth = Math.abs(cropEnd.x - cropStart.x) * scaleX;
        const cropHeight = Math.abs(cropEnd.y - cropStart.y) * scaleY;

        if (cropWidth < 10 || cropHeight < 10) {
            toast.error('Área de corte muito pequena');
            return;
        }

        canvas.width = cropWidth;
        canvas.height = cropHeight;

        ctx.drawImage(
            img,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );

        const croppedImage = canvas.toDataURL('image/png');
        setImageSrc(croppedImage);
        setWidth(Math.round(cropWidth));
        setHeight(Math.round(cropHeight));
        setAspectRatio(cropWidth / cropHeight);
        setIsCropping(false);
        toast.success('Imagem cortada!');
    }, [cropStart, cropEnd]);

    const cancelCrop = useCallback(() => {
        setIsCropping(false);
        setCropStart({ x: 0, y: 0 });
        setCropEnd({ x: 0, y: 0 });
    }, []);

    const handleInsert = useCallback(() => {
        if (!imageSrc) {
            toast.error('Nenhuma imagem selecionada');
            return;
        }

        onInsert({
            src: imageSrc,
            alt: altText || caption || 'Imagem',
            caption,
            width,
            height,
        });
        onClose();
    }, [imageSrc, altText, caption, width, height, onInsert, onClose]);

    if (!isOpen) return null;

    const cropRect = {
        left: Math.min(cropStart.x, cropEnd.x),
        top: Math.min(cropStart.y, cropEnd.y),
        width: Math.abs(cropEnd.x - cropStart.x),
        height: Math.abs(cropEnd.y - cropStart.y),
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">
                            {mode === 'upload' ? 'Inserir Imagem' : mode === 'url' ? 'Imagem por URL' : 'Editar Imagem'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Mode: Upload */}
                    {mode === 'upload' && (
                        <div className="space-y-4">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {/* Upload Area */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                                <div className="p-4 rounded-full bg-primary/10 mb-4">
                                    <Upload className="w-8 h-8 text-primary" />
                                </div>
                                <p className="text-lg font-medium">Clique para selecionar uma imagem</p>
                                <p className="text-sm text-muted-foreground mt-1">ou arraste e solte aqui</p>
                                <p className="text-xs text-muted-foreground mt-4">PNG, JPG, GIF, WebP (max. 10MB)</p>
                            </div>

                            {/* URL Option */}
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-sm text-muted-foreground">ou</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <button
                                onClick={() => setMode('url')}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border hover:bg-muted transition-colors"
                            >
                                <Link2 className="w-4 h-4" />
                                <span>Inserir por URL</span>
                            </button>
                        </div>
                    )}

                    {/* Mode: URL */}
                    {mode === 'url' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setMode('upload')}
                                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                                ← Voltar para upload
                            </button>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">URL da Imagem</label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        placeholder="https://exemplo.com/imagem.jpg"
                                        className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                        onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                                    />
                                    <button
                                        onClick={handleUrlSubmit}
                                        disabled={isLoading}
                                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        {isLoading ? 'Carregando...' : 'Carregar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mode: Edit */}
                    {mode === 'edit' && imageSrc && (
                        <div className="space-y-6">
                            {/* Back button */}
                            {!initialImage && (
                                <button
                                    onClick={() => {
                                        setImageSrc('');
                                        setMode('upload');
                                    }}
                                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                                >
                                    ← Escolher outra imagem
                                </button>
                            )}

                            {/* Image Preview with Crop */}
                            <div className="relative">
                                <div
                                    ref={cropContainerRef}
                                    className={cn(
                                        "relative rounded-lg overflow-hidden bg-muted flex items-center justify-center",
                                        isCropping && "cursor-crosshair"
                                    )}
                                    style={{ maxHeight: '400px' }}
                                    onMouseDown={startCrop}
                                    onMouseMove={updateCrop}
                                    onMouseUp={endCrop}
                                    onMouseLeave={endCrop}
                                >
                                    <img
                                        ref={imageRef}
                                        src={imageSrc}
                                        alt="Preview"
                                        className="max-w-full max-h-[400px] object-contain"
                                        style={{
                                            width: width ? `${Math.min(width, 600)}px` : 'auto',
                                        }}
                                    />

                                    {/* Crop Overlay */}
                                    {isCropping && (
                                        <>
                                            <div className="absolute inset-0 bg-black/50 pointer-events-none" />
                                            {cropRect.width > 0 && cropRect.height > 0 && (
                                                <div
                                                    className="absolute border-2 border-white bg-transparent pointer-events-none"
                                                    style={{
                                                        left: cropRect.left,
                                                        top: cropRect.top,
                                                        width: cropRect.width,
                                                        height: cropRect.height,
                                                    }}
                                                >
                                                    {/* Clear crop area */}
                                                    <div
                                                        className="absolute inset-0"
                                                        style={{
                                                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Hidden canvas for crop */}
                                <canvas ref={canvasRef} className="hidden" />

                                {/* Crop Controls */}
                                {isCropping && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur rounded-lg p-2 shadow-lg">
                                        <button
                                            onClick={applyCrop}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm"
                                        >
                                            <Check className="w-4 h-4" />
                                            Aplicar Corte
                                        </button>
                                        <button
                                            onClick={cancelCrop}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded bg-muted text-sm"
                                        >
                                            <X className="w-4 h-4" />
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Tools */}
                            {!isCropping && (
                                <div className="flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setIsCropping(true)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted transition-colors"
                                    >
                                        <Crop className="w-4 h-4" />
                                        Cortar
                                    </button>
                                    <button
                                        onClick={resetSize}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted transition-colors"
                                    >
                                        <Maximize2 className="w-4 h-4" />
                                        Tamanho Original
                                    </button>
                                </div>
                            )}

                            {/* Size Controls */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Largura (px)</label>
                                    <input
                                        type="number"
                                        value={width || ''}
                                        onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                                        className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Altura (px)</label>
                                        <button
                                            onClick={() => setAspectLocked(!aspectLocked)}
                                            className={cn(
                                                "p-1 rounded transition-colors",
                                                aspectLocked ? "text-primary" : "text-muted-foreground"
                                            )}
                                            title={aspectLocked ? "Proporção bloqueada" : "Proporção livre"}
                                        >
                                            {aspectLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        value={height || ''}
                                        onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                                        className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            {/* Caption & Alt Text */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Type className="w-4 h-4" />
                                        Legenda
                                    </label>
                                    <input
                                        type="text"
                                        value={caption}
                                        onChange={(e) => setCaption(e.target.value)}
                                        placeholder="Adicione uma legenda para a imagem..."
                                        className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        A legenda aparecerá abaixo da imagem
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Texto Alternativo (Alt)</label>
                                    <input
                                        type="text"
                                        value={altText}
                                        onChange={(e) => setAltText(e.target.value)}
                                        placeholder="Descrição da imagem para acessibilidade..."
                                        className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/30">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border hover:bg-muted transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleInsert}
                        disabled={!imageSrc || isCropping}
                        className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Inserir Imagem
                    </button>
                </div>
            </div>
        </div>
    );
}
