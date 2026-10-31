export interface BannerPack {
  id: string;

  title: string;
  description: string;

  coverImage: string;

  packSize: string;

  isActive: boolean;

  // computed from API
  folderCount: number;
  fileCount: number;

  files: BannerPackFile[];
  folders: BannerFolder[];

  createdAt: string;
  updatedAt: string;
}

export interface BannerFolder {
  id: string;
  name: string;
  isDefault: boolean;
  files: BannerPackFile[];
  createdAt: string;
}

export interface BannerPackFile {
  id: string;
  fileUrl: string;
  fileName: string;
  folderId?: string;
  size: number;
  createdAt: string;
}

export interface CreateBannerPackDto {
  title: string;
  description: string;
  coverImage: string;
}

export interface UpdateBannerPackDto {
  title?: string;
  description?: string;
  coverImage?: string;
  isActive?: boolean;
}