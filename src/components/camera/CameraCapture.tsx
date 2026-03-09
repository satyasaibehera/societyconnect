import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, SwitchCamera, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  capturedImage: string | null;
  onClear: () => void;
  required?: boolean;
  className?: string;
}

export function CameraCapture({ onCapture, capturedImage, onClear, required, className }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for multiple cameras
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setHasMultipleCameras(videoDevices.length > 1);
    }).catch(() => {});
  }, []);

  // CRITICAL: Must be called directly from user gesture (button click)
  const startCamera = useCallback(async () => {
    setError(null);
    try {
      console.log("Starting camera with facingMode:", facingMode);
      const constraints: MediaStreamConstraints = {
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera stream obtained:", mediaStream.getTracks());
      
      setStream(mediaStream);
      setCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log("Stream attached to video element");
        // Explicitly play the video - this is critical for preview
        try {
          await videoRef.current.play();
          console.log("Video playback started");
        } catch (playError) {
          console.error("Error playing video:", playError);
        }
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera permission in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not access camera. Please check permissions and try again.");
      }
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const switchCamera = useCallback(async () => {
    // Stop existing stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    
    // Toggle facing mode
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    
    // Start camera with new mode
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: newMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Error switching camera:", err);
      setError("Could not switch camera. Please try again.");
    }
  }, [stream, facingMode]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      console.error("Video or canvas ref not available");
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error("Video dimensions not ready");
      setError("Camera preview not ready. Please wait a moment and try again.");
      return;
    }
    
    console.log("Capturing photo, video dimensions:", video.videoWidth, "x", video.videoHeight);
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Could not get canvas context");
      return;
    }

    // Mirror for front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log("Photo captured successfully, size:", blob.size);
          onCapture(blob);
        } else {
          console.error("Failed to create blob from canvas");
          setError("Failed to capture photo. Please try again.");
        }
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  }, [facingMode, onCapture, stopCamera]);

  const handleRetake = () => {
    onClear();
    startCamera();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">
          Live Photo {required && <span className="text-destructive">*</span>}
        </label>
      </div>

      {/* Captured Image Preview */}
      {capturedImage && !cameraActive && (
        <div className="relative">
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full max-w-[280px] rounded-lg border object-cover aspect-[4/3]"
          />
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRetake}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Retake
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <X className="h-3.5 w-3.5 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* Camera View */}
      {cameraActive && (
        <div className="relative max-w-[280px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full rounded-lg border bg-black aspect-[4/3] object-cover",
              facingMode === "user" && "scale-x-[-1]"
            )}
          />
          <div className="flex gap-2 mt-2">
            <Button type="button" size="sm" onClick={capturePhoto}>
              <Camera className="h-3.5 w-3.5 mr-1" />
              Capture
            </Button>
            {hasMultipleCameras && (
              <Button type="button" variant="outline" size="sm" onClick={switchCamera}>
                <SwitchCamera className="h-3.5 w-3.5 mr-1" />
                Flip
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={stopCamera}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Start Camera Button */}
      {!cameraActive && !capturedImage && (
        <Button type="button" variant="outline" size="sm" onClick={startCamera} className="w-fit">
          <Camera className="h-4 w-4 mr-2" />
          Open Camera
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
