// types/sponsorship.ts

export type SponsorshipBlock =
  | { type: "paragraph"; content: string }
  | { type: "numbered_list"; items: string[] };

export type ContentBlock = SponsorshipBlock;

export interface SponsorshipSection {
  heading: string;
  blocks: SponsorshipBlock[];
}

export type ContentSection = SponsorshipSection;

export interface Sponsorship {
  id: string;

  sectionsEn: SponsorshipSection[];
  sectionsEs: SponsorshipSection[];

  imageUrl: string;
  imageKey: string;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateSponsorshipDto {
  sectionsEn: SponsorshipSection[];
  sectionsEs: SponsorshipSection[];

  imageUrl: string;
  imageKey: string;

  isActive?: boolean;
}

export interface UpdateSponsorshipDto extends Partial<CreateSponsorshipDto> {}

export interface SetSponsorshipActiveDto {
  isActive: boolean;
}
