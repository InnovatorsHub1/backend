import { Request, Response, NextFunction } from 'express';

export const deviceInfoMiddleware = (req: Request, res: Response, next: NextFunction) => {
    req.deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        platform: req.headers['sec-ch-ua-platform']?.toString(),
        browser: req.headers['sec-ch-ua']?.toString(),
        version: req.headers['sec-ch-ua-version']?.toString(),
        os: req.headers['sec-ch-ua-platform']?.toString(),
        device: req.headers['sec-ch-ua-mobile']?.toString(),
        manufacturer: req.headers['sec-ch-ua-manufacturer']?.toString(),
        model: req.headers['sec-ch-ua-model']?.toString(),
        isBot: req.headers['sec-ch-ua-mobile']?.toString() === '?0',
    };
    next();
};
