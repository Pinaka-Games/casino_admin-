import axios from "axios";

// Remove /admin from the base URL for upload endpoints
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1/admin").replace(/\/admin$/, '');

const uploadAPI = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token interceptor
uploadAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    key: string;
    url: string;
    signedUrl: string;
  };
}

/**
 * Upload a single file to /upload/single
 * @param file - The file to upload
 * @param folder - Optional folder path (default: 'uploads')
 * @returns Upload response with file URL
 */
export const uploadSingle = async (
  file: File,
  folder?: string
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  if (folder) {
    formData.append("folder", folder);
  }

  const response = await uploadAPI.post("/upload/single", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Upload multiple files to /upload/multiple
 * @param files - Array of files to upload
 * @param folder - Optional folder path (default: 'uploads')
 */
export const uploadMultiple = async (
  files: File[],
  folder?: string
): Promise<{
  success: boolean;
  message: string;
  data: Array<{
    key: string;
    url: string;
    signedUrl: string;
  }>;
}> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });
  if (folder) {
    formData.append("folder", folder);
  }

  const response = await uploadAPI.post("/upload/multiple", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Delete a file from S3
 * @param key - The S3 key of the file to delete
 */
export const deleteFile = async (key: string): Promise<void> => {
  await uploadAPI.delete(`/upload/${encodeURIComponent(key)}`);
};
