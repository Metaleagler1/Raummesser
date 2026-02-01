
import { WallSegment } from '../types';

/**
 * Generiert einen einfachen DXF-String für einen geschlossenen oder offenen Polygonzug.
 */
export const generateDXF = (segments: WallSegment[]): string => {
  let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1006
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  let currentX = 0;
  let currentY = 0;
  let angleTotal = 0;

  segments.forEach((seg, index) => {
    // In many room scanning contexts, the first wall is 0 deg.
    // Angles are usually cumulative (turning 90 deg relative to previous).
    angleTotal += seg.angle;
    const rad = (angleTotal * Math.PI) / 180;
    
    const nextX = currentX + seg.length * Math.cos(rad);
    const nextY = currentY + seg.length * Math.sin(rad);

    dxf += `0
LINE
8
WALLS
10
${currentX.toFixed(4)}
20
${currentY.toFixed(4)}
30
0.0
11
${nextX.toFixed(4)}
21
${nextY.toFixed(4)}
31
0.0
`;
    currentX = nextX;
    currentY = nextY;
  });

  dxf += `0
ENDSEC
0
EOF`;
  return dxf;
};

export const downloadBlob = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
