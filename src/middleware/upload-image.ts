import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { AppError } from "../errors/app-error.js";

export const uploadsDirectory = resolve(process.cwd(), "uploads");

mkdirSync(uploadsDirectory, { recursive: true });

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: uploadsDirectory,
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  },
});

export const uploadProductImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new AppError(400, "Image must be JPEG, PNG, or WebP"));
      return;
    }

    callback(null, true);
  },
}).single("image");
