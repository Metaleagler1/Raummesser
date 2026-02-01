
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type EdgeType = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'CENTER';

export interface DeviceSettings {
  lengthCm: number;
  widthCm: number;
  thicknessCm: number;
  startEdge: EdgeType;
  endEdge: EdgeType;
}

export interface WallSegment {
  length: number;
  angle: number; // relative to first wall or compass heading
}

export interface RoomScan {
  id: string;
  name: string;
  timestamp: number;
  segments: WallSegment[];
}

export interface MeasurementRecord {
  id: string;
  timestamp: number;
  distance: number;
  duration: number;
  settings: DeviceSettings;
}

export enum SensorStatus {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  DENIED = 'DENIED'
}

export type AppMode = 'DISTANCE' | 'ROOM_SCAN';
