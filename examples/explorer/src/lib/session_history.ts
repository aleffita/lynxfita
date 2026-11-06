/**
 * Super-App Session Telemetry & Event History
 */

export interface TelemetryLogEvent {
  timestamp: number;
  category: 'navigation' | 'cordis' | 'dma' | 'ffi' | 'wasi' | 'mtls' | 'genui';
  message: string;
  data?: any;
}

export class SessionHistoryManager {
  private events: TelemetryLogEvent[] = [];
  private maxEvents = 100;

  public log(category: TelemetryLogEvent['category'], message: string, data?: any): void {
    const ev: TelemetryLogEvent = {
      timestamp: Date.now(),
      category,
      message,
      data
    };
    this.events.push(ev);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  public getEvents(): readonly TelemetryLogEvent[] {
    return this.events;
  }

  public clear(): void {
    this.events = [];
  }
}
