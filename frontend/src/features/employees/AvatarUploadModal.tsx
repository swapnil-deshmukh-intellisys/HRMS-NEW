import { useEffect, useRef, useState } from "react";
import { Camera, Upload, ZoomIn, ArrowLeft } from "lucide-react";
import Modal from "../../components/common/Modal";
import "./AvatarUploadModal.css";

type AvatarUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (file: File) => void | Promise<void>;
  uploading: boolean;
};

export default function AvatarUploadModal({ open, onClose, onSave, uploading }: AvatarUploadModalProps) {
  const [source, setSource] = useState<"file" | "camera" | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  
  // Crop States
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [aspectRatio, setAspectRatio] = useState(1);
  
  // Camera State
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeSourceRef = useRef<"file" | "camera" | null>(null);
  const isOpenRef = useRef(open);

  // Sync refs with state
  useEffect(() => {
    activeSourceRef.current = source;
  }, [source]);

  useEffect(() => {
    isOpenRef.current = open;
  }, [open]);

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setSource(null);
      setImageSrc(null);
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setCameraError(null);
      setAspectRatio(1);
    } else {
      stopCamera();
    }
  }, [open]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Start webcam stream
  async function startCamera() {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: "user" },
        audio: false,
      });

      // Avoid race conditions if user closed or changed source while waiting
      if (!isOpenRef.current || activeSourceRef.current !== "camera") {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      setStream(mediaStream);
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Webcam access error:", err);
      if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setCameraError("Webcam is already in use by another application or browser tab.");
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Webcam access denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No webcam device found on this system.");
      } else {
        setCameraError("Could not access camera. Please check permissions.");
      }
    }
  }

  // Stop webcam stream
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }

  // Handle source changes
  useEffect(() => {
    if (source === "camera") {
      void startCamera();
    } else {
      stopCamera();
    }
  }, [source]);

  // Handle file selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Handle image element loading to retrieve natural aspect ratio
  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  }

  // Capture image frame from live video
  function handleCapture() {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    
    // Capture square snapshot
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Center-crop snapshot from video stream
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL("image/webp");
    setImageSrc(dataUrl);
    stopCamera();
  }

  // Drag-to-pan handlers
  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!imageSrc) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleMouseUpOrLeave() {
    setIsDragging(false);
  }

  // Touch support for dragging
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!imageSrc || e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPanOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  }

  // Perform Crop & Upload
  async function handleCropAndSave() {
    if (!imageRef.current || !containerRef.current) return;

    const image = imageRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get exact layout bounding rects
    const containerRect = container.getBoundingClientRect();
    const imgRect = image.getBoundingClientRect();

    // Map container coords to canvas coords
    const scaleFactor = 256 / containerRect.width;

    const dx = (imgRect.left - containerRect.left) * scaleFactor;
    const dy = (imgRect.top - containerRect.top) * scaleFactor;
    const dw = imgRect.width * scaleFactor;
    const dh = imgRect.height * scaleFactor;

    // Clear and draw image on canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(image, dx, dy, dw, dh);

    // Convert canvas to file blob
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "avatar.webp", { type: "image/webp" });
      void onSave(file);
    }, "image/webp", 0.9);
  }

  function handleBack() {
    if (imageSrc) {
      setImageSrc(null);
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      if (source === "camera") {
        void startCamera();
      }
    } else {
      setSource(null);
      stopCamera();
    }
  }

  return (
    <Modal open={open} title="Update Profile Picture" onClose={onClose} className="avatar-upload-modal">
      <div className="avatar-upload-modal__content">
        {/* VIEW 1: Choose source */}
        {!source && !imageSrc && (
          <div className="avatar-upload-modal__options">
            <button
              type="button"
              className="avatar-upload-modal__option-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} />
              <span>Upload Photo File</span>
            </button>
            <button
              type="button"
              className="avatar-upload-modal__option-btn"
              onClick={() => setSource("camera")}
            >
              <Camera size={24} />
              <span>Take Photo with Camera</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* VIEW 2: Webcam Stream */}
        {source === "camera" && !imageSrc && (
          <div className="avatar-upload-modal__camera-view">
            {cameraError ? (
              <p className="avatar-upload-modal__error">{cameraError}</p>
            ) : (
              <div className="avatar-upload-modal__video-wrapper">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="avatar-upload-modal__video"
                />
                <div className="avatar-upload-modal__video-overlay-mask" />
              </div>
            )}
            <div className="avatar-upload-modal__actions-row">
              <button type="button" className="avatar-upload-modal__btn-secondary" onClick={handleBack}>
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="avatar-upload-modal__btn-primary"
                onClick={handleCapture}
                disabled={!!cameraError || !stream}
              >
                <Camera size={16} /> Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: Crop Zoom and Pan */}
        {imageSrc && (
          <div className="avatar-upload-modal__crop-view">
            <div
              ref={containerRef}
              className="avatar-upload-modal__crop-container"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUpOrLeave}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Source preview"
                className="avatar-upload-modal__crop-image"
                onLoad={handleImageLoad}
                style={{
                  width: `${aspectRatio > 1 ? 250 * aspectRatio : 250}px`,
                  height: `${aspectRatio < 1 ? 250 / aspectRatio : 250}px`,
                  left: `${aspectRatio > 1 ? (250 - 250 * aspectRatio) / 2 : 0}px`,
                  top: `${aspectRatio < 1 ? (250 - 250 / aspectRatio) / 2 : 0}px`,
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                  cursor: isDragging ? "grabbing" : "grab",
                }}
                draggable={false}
              />
              <div className="avatar-upload-modal__crop-overlay" />
            </div>

            {/* Zoom Slider */}
            <div className="avatar-upload-modal__zoom-control">
              <ZoomIn size={14} className="muted" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="avatar-upload-modal__zoom-slider"
              />
              <span className="avatar-upload-modal__zoom-label">{Math.round(zoom * 100)}%</span>
            </div>

            {/* Actions */}
            <div className="avatar-upload-modal__actions-row">
              <button type="button" className="avatar-upload-modal__btn-secondary" onClick={handleBack} disabled={uploading}>
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="avatar-upload-modal__btn-primary"
                onClick={handleCropAndSave}
                disabled={uploading}
              >
                {uploading ? "Saving..." : "Crop & Save"}
              </button>
            </div>
          </div>
        )}

        {/* Hidden Canvas for Cropping */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </Modal>
  );
}
