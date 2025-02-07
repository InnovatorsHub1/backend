import { Request } from 'express';
import { DeviceInfo } from '@gateway/services/auth/types';


export function extractDeviceInfo(req: Request): DeviceInfo {
    return {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        platform: req.headers['sec-ch-ua-platform']?.toString()
    };
} 