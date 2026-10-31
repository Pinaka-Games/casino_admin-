export interface Announcement {
  id: string;
  title: string;
  description: string;
  titleEs: string;
  descriptionEs: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementDto {
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  imageUrl: string;
  isActive?: boolean;
}

export interface UpdateAnnouncementDto
  extends Partial<CreateAnnouncementDto> {}

  export interface SetAnnouncementActiveDto {
  isActive: boolean;
}