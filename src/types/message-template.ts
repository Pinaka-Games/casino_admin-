export type MessageType = "welcome" | "promo" | "alert" | string;

export interface MessageTemplate {
  id: string;
  title: string;
  contents: string;
  messageType: MessageType;
  isActive: boolean;
  imageUrl?: string;
  displayDurationDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageTemplateDto {
  title: string;
  contents: string;
  messageType: MessageType;
  isActive?: boolean;
  imageUrl?: string;
  displayDurationDays?: number;
}

export interface UpdateMessageTemplateDto {
  title?: string;
  contents?: string;
  messageType?: MessageType;
  isActive?: boolean;
  imageUrl?: string;
  displayDurationDays?: number;
}