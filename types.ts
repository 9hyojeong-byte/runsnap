
export interface RunData {
  timeHours: string;
  timeMinutes: string;
  timeSeconds: string;
  distance: string;
  paceMinutes: string;
  paceSeconds: string;
}

export interface CanvasState {
  image: HTMLImageElement | null;
  processedUrl: string | null;
}
