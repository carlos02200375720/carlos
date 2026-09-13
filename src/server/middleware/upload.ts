import multer from "multer";

// Configure multer for memory storage (200MB limit for high-definition video/image uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max limit
  }
});

// Safe Multer middleware wrapper that catches errors and always returns clean JSON
const uploadSingleSafe = (fieldName: string) => (req: any, res: any, next: any) => {
  upload.single(fieldName)(req, res, (err: any) => {
    if (err) {
      console.error(`❌ Multer upload error on field '${fieldName}':`, err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: "El archivo seleccionado supera el límite permitido de 200MB. Por favor, selecciona un archivo más liviano.",
          code: "LIMIT_FILE_SIZE"
        });
      }
      return res.status(400).json({
        error: `Error al procesar el archivo: ${err.message || err}`,
        code: err.code || "UPLOAD_ERROR"
      });
    }
    next();
  });
};

