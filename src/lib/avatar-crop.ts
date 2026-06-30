export type CropTransform = {
  /** 1 = cover crop area; up to 3 = zoom in */
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const CROP_OUTPUT_SIZE = 512;
export const CROP_VIEWPORT = 280;

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function baseScale(img: HTMLImageElement, viewport: number) {
  return viewport / Math.min(img.width, img.height);
}

export function initialTransform(_img: HTMLImageElement): CropTransform {
  return { scale: 1, offsetX: 0, offsetY: 0 };
}

export function drawCropPreview(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  transform: CropTransform,
  viewport: number,
) {
  ctx.clearRect(0, 0, viewport, viewport);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, viewport, viewport);

  const eff = baseScale(img, viewport) * transform.scale;
  const drawW = img.width * eff;
  const drawH = img.height * eff;
  const x = (viewport - drawW) / 2 + transform.offsetX;
  const y = (viewport - drawH) / 2 + transform.offsetY;

  ctx.save();
  ctx.beginPath();
  ctx.arc(viewport / 2, viewport / 2, viewport / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.restore();
}

export async function cropToCircularBlob(
  img: HTMLImageElement,
  transform: CropTransform,
  outputSize = CROP_OUTPUT_SIZE,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  drawCropPreview(ctx, img, transform, outputSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not export image"))),
      "image/jpeg",
      0.92,
    );
  });
}

export function validateAvatarFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file";
  if (file.size > 8 * 1024 * 1024) return "Image must be under 8 MB";
  return null;
}