
export interface RunData {
  timeHours: string;
  timeMinutes: string;
  timeSeconds: string;
  distance: string;
  heartRate: string;
  temperature: string;
  showEmojis: boolean;
  filter: string;
}

export interface CanvasState {
  image: HTMLImageElement | null;
  processedUrl: string | null;
}

export type FilterType = {
  id: string;
  name: string;
  cssFilter: string;
};
