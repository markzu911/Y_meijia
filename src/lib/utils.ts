export const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      const mimeType = result.split(";")[0].split(":")[1];
      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const compressImage = (file: File, maxWidth: number = 1600, quality: number = 0.85): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Scale proportionally if width or height exceeds maxWidth
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));
      
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas to Blob failed'));
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = (error) => reject(error);
  });
};
