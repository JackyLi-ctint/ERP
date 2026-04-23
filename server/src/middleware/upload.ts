import multer from "multer";
import config from "../config";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: config.uploadMaxBytes },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});
