import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraDeviceOption {
  deviceId: string;
  label: string;
}

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
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stopStreamTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopStreamTracks();
    setCameraActive(false);
  }, [stopStreamTracks]);

  const refreshDevices = useCallback(async (): Promise<CameraDeviceOption[]> => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return [];
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all
        .filter((d) => d.kind === "videoinput")
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label?.trim() || `Camera ${index + 1}`,
        }));

      setDevices(videoInputs);

      setSelectedDeviceId((current) => {
        if (current && videoInputs.some((d) => d.deviceId === current)) return current;
        return videoInputs[0]?.deviceId ?? "";
      });

      return videoInputs;
    } catch (err) {
      console.warn("[CameraCapture] enumerateDevices failed:", err);
      setDevices([]);
      return [];
    }
  }, []);

  // Initial device enumeration (labels may be empty until permission is granted)
  useEffect(() => {
    refreshDevices().catch(() => {});
  }, [refreshDevices]);

  useEffect(() => {
    return () => {
      stopStreamTracks();
    };
  }, [stopStreamTracks]);

  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch((err) => {
        console.error("[CameraCapture] video.play failed:", err);
      });
    }
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera API is not supported in this browser.");
        return;
      }

      setError(null);
      setStarting(true);

      try {
        // Stop any existing stream before opening a new one
        stopStreamTracks();

        const preferredId = deviceId || selectedDeviceId;
        const videoConstraints: MediaTrackConstraints = preferredId
          ? {
              deviceId: { exact: preferredId },
              width: { ideal: 640 },
              height: { ideal: 480 },
            }
          : {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            };

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        } catch (exactErr) {
          // Fallback if exact deviceId fails (e.g. stale id / Bluetooth camera)
          console.warn("[CameraCapture] exact deviceId failed, falling back:", exactErr);
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
        }

        streamRef.current = mediaStream;
        setCameraActive(true);

        // Re-enumerate so labels become available after permission grant
        const nextDevices = await refreshDevices();
        const activeTrack = mediaStream.getVideoTracks()[0];
        const activeSettings = activeTrack?.getSettings?.();
        if (activeSettings?.deviceId) {
          setSelectedDeviceId(activeSettings.deviceId);
        } else if (!preferredId && nextDevices[0]) {
          setSelectedDeviceId(nextDevices[0].deviceId);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch((err) => {
            console.error("[CameraCapture] video.play failed:", err);
            setError("Camera stream started but preview failed to play. Try another camera.");
          });
        }
      } catch (err: unknown) {
        console.error("[CameraCapture] getUserMedia error:", err);
        stopStreamTracks();
        setCameraActive(false);

        const name = err instanceof DOMException ? err.name : "";
        const message = err instanceof Error ? err.message : "Unknown camera error";

        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError("Camera access denied. Please allow camera permission in your browser settings.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setError("No camera found on this device.");
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          setError("Camera is busy or unavailable. Close other apps using it, or pick another device.");
        } else if (name === "OverconstrainedError") {
          setError("Selected camera could not be opened. Try another device from the list.");
        } else {
          setError(`Could not access camera: ${message}`);
        }
      } finally {
        setStarting(false);
      }
    },
    [refreshDevices, selectedDeviceId, stopStreamTracks],
  );

  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (cameraActive) {
        await startCamera(deviceId);
      }
    },
    [cameraActive, startCamera],
  );

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera preview not ready yet. Please wait a moment or switch cameras.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not prepare image canvas.");
      return;
    }

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
          stopCamera();
        } else {
          setError("Failed to capture photo. Please try again.");
        }
      },
      "image/jpeg",
      0.85,
    );
  }, [onCapture, stopCamera]);

  const handleRetake = () => {
    onClear();
    startCamera(selectedDeviceId || undefined);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">
          Live Photo {required && <span className="text-destructive">*</span>}
        </label>
      </div>

      {devices.length > 1 && (
        <div className="space-y-1 max-w-[280px]">
          <Label className="text-xs text-muted-foreground">Camera</Label>
          <Select
            value={selectedDeviceId || undefined}
            onValueChange={handleDeviceChange}
            disabled={starting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select camera" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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

      {cameraActive && (
        <div className="relative max-w-[280px]">
          <video
            ref={videoCallbackRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg border bg-black aspect-[4/3] object-cover"
          />
          <div className="flex gap-2 mt-2">
            <Button type="button" size="sm" onClick={capturePhoto} disabled={starting}>
              <Camera className="h-3.5 w-3.5 mr-1" />
              Capture
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={stopCamera}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!cameraActive && !capturedImage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => startCamera(selectedDeviceId || undefined)}
          disabled={starting}
          className="w-fit"
        >
          <Camera className="h-4 w-4 mr-2" />
          {starting ? "Starting…" : "Open Camera"}
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
