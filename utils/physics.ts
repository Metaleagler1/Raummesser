
/**
 * Wendet einen einfachen Low-Pass Filter an, um Rauschen zu reduzieren.
 */
export const lowPassFilter = (value: number, previousValue: number, alpha: number): number => {
  return alpha * value + (1 - alpha) * previousValue;
};

/**
 * Berechnet die Magnitude eines 3D Vektors.
 */
export const getMagnitude = (x: number, y: number, z: number): number => {
  return Math.sqrt(x * x + y * y + z * z);
};

/**
 * Schwellenwert-Logik: Wenn die Beschleunigung zu gering ist, setzen wir sie auf 0,
 * um Drift im Stillstand zu vermeiden (Zero Velocity Update - ZUPT light).
 */
export const deadZone = (value: number, threshold: number): number => {
  return Math.abs(value) < threshold ? 0 : value;
};
