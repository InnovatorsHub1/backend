import { createTransport } from "nodemailer";

import { config } from "./";

export interface IEmailConfig {
    smtpServer: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
    fromEmail: string;
    useTLS: boolean;
}

const emailConfig: IEmailConfig = {
    smtpServer: "smpt.gmail.com",
    smtpPort: 587, // Don't know if it should be in the .env file
    smtpUsername: config.emailSender,
    smtpPassword: config.emailPrivateKey,
    fromEmail: config.emailSender,
    useTLS: true
}

const transporter = createTransport({
    host: emailConfig.smtpServer,
    port: emailConfig.smtpPort,
    secure: emailConfig.useTLS,
    auth: {
        user: emailConfig.smtpUsername,
        pass: emailConfig.smtpPassword
    }
})

export { transporter }
