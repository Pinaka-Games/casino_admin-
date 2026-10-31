export interface WaitlistEntry {
    id: string | number;
    name: string;
    email: string;
    mobileNo: string;
    referralCode: string;
    referralCount: number;
    isConverted: boolean;
    createdAt: string;
    status: "pending" | "verified" | "approved" | "rejected" | "converted" | "blocked";
}

export interface UpdateWaitlistStatusDto {
    status: "pending" | "verified" | "approved" | "rejected" | "converted" | "blocked";
}
