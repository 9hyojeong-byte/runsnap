
export interface RunData {
  timeHours: string;
  timeMinutes: string;
  timeSeconds: string;
  distance: string;
  heartRate: string;
  temperature: string;
}

export interface CanvasState {
  image: HTMLImageElement | null;
  processedUrl: string | null;
}
