export interface DeviceInfo {
    userAgent?: string;
    ip?: string;
    platform?: string;
    browser?: string;
    version?: string;
    os?: string;
    device?: string;
    manufacturer?: string;
    model?: string;
    isBot?: boolean;
    isMobile?: boolean;
}


export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    id: string;
}
