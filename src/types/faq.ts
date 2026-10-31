export interface FAQ {
  id: string;

  questionEn: string;
  answerEn: string;

  questionEs: string;
  answerEs: string;

  displayOrder: number;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

/* ✅ NEW: status toggle DTO */
export interface SetFaqActiveDto {
  isActive: boolean;
}