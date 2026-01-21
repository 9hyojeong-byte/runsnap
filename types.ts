
export interface RunData {
  timeHours: string;
  timeMinutes: string;
  timeSeconds: string;
  distance: string;
  heartRate: string;
  temperature: string;
  showEmojis: boolean;
}

export interface CanvasState {
  image: HTMLImageElement | null;
  processedUrl: string | null;
}
