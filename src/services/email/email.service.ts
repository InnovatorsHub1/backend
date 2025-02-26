import { injectable, inject } from 'inversify';
import { TYPES } from '../../core/di/types';
import { WinstonLogger } from '../../core/logger/winston.logger';
import { ApiError } from '../../core/errors/api.error';
import { IEmailService } from './interfaces/email.service.interface'
import { TemplateService } from '../pdf/template.service';
import { ValidationService } from '@gateway/core/validation/validation.service';
import { RetryService } from "../retry.service"
import { IUser } from '@gateway/types/user.types';
import { transporter } from '@gateway/config/email.config';
import { IEmailOptions } from '@gateway/types/email.types';
import { UUID } from 'mongodb';



@injectable()
export class EmailService implements IEmailService {
    private logger: WinstonLogger = new WinstonLogger('EmailService');

    constructor(
        @inject(TYPES.TemplateService) private readonly templateService: TemplateService,
        @inject(TYPES.ValidationService) private readonly validationService: ValidationService,
        @inject(TYPES.RetryService) private readonly retryService: RetryService
    ) {
        this.logger = new WinstonLogger('EmailService');
    }



    /**
     * - Validate the email by rules (uses validation service) - 
     * @param email - The email that needs to be validated 
     * @returns true if the email validated succesfully, false otherwise
     */
    validateEmailAddress(email: string): boolean {

        const emailRules = [
            { name: "email", message: "Invalid email format" },
            { name: "required", message: "Email is required!" }
        ];

        const valid = this.validationService.validateField(email, emailRules)
        if (!valid.isValid) {
            this.logger.error("There are erros:", ...valid.errors)
        }
        return valid.isValid;
    };

    /**
     * - Validate array of emails by rules (uses validateEmailAddress FUNC) - 
     * @param emails - The emails' array that need to be validated 
     * @returns true if all emails validated succesfully, false otherwise
     */
    validateEmailAddresses(emails: string[]): boolean {
        return emails.every(email => this.validateEmailAddress(email))
    };

    /**
     * Sends an email and retries the operation if the email sending fails (uses the retry service).
     * @param options - Object containing email details such as recipient, subject, and body.
     * @returns {Promise<boolean>} - Returns `true` if the email was sent successfully, otherwise `false`.
     */
    async sendEmail(options: IEmailOptions): Promise<boolean> {
        try {
            await this.retryService.retryOnFailure(() => transporter.sendMail(options), {
                maxRetries: 3,
                delay: 3000,
                exceptions: [Error],
                strategy: "exponential"
            });
            return true
        } catch (error) {
            this.logger.error("Failed sending email", error);
            return false
        };
    };

    /**
    * Sends a templated email and retries the operation if sending fails.
    * @param templateName - The name of the email template to use.
    * @param context - The data context to be injected into the template.
    * @param options - Additional email options such as recipient, subject, and attachments.
    * @returns - Returns `true` if the email was sent successfully, otherwise `false`.
    * @throws - Throws an error if the template is invalid.
    */
    async sendTemplatedEmail(templateName: string, context: Record<string, any>, options: Partial<IEmailOptions>): Promise<boolean> {

        // Use template service for validate template
        const isValidTemplate = await this.templateService.validateTemplate(templateName);
        if (!isValidTemplate) {
            this.logger.error("Invalid template - ", templateName)
            throw new ApiError("Invalid template", 500, "emailService")
        } // ************************* Maybe need to throw error ^ ***************************

        // Use template service for fetch the template and set the context
        const template = await this.templateService.renderTemplate(templateName, context);

        // Add the template to the options
        const emailOptions = {
            ...options,
            html: template
        }

        try {
            await this.retryService.retryOnFailure(() => transporter.sendMail(emailOptions), {
                maxRetries: 3,
                delay: 3000,
                exceptions: [Error],
                strategy: "exponential"
            });
            return true
        } catch (error) {
            this.logger.error("Failed sending email", error);
            // throw new ApiError("Failed sending email", 500, "EmailService") *** The function maybe needs to return Promise<string> ***
            return false
        }
    }


    /**
    * Sends a welcome email to a new user.
    *   
    * @param user - The user object containing the recipient's email.
    * @returns  - A Promise that resolves to `true` if the email was sent successfully, otherwise `false`.
    */
    async sendWelcomeEmail(user: IUser): Promise<boolean> {

        // validate the email address
        if (!this.validateEmailAddress(user.email)) {
            this.logger.error("Invalid Email")
            return false
        };

        // Build the options object
        const emailOptions: IEmailOptions = {
            to: user.email,
            subject: 'Welcome to Auto Docs!',
        };

        // Send the Email
        return await this.sendTemplatedEmail("welcome", user, emailOptions)
    };


    /**
    * Sends a password reset email to the user with a unique reset token.
    * 
    * @param user - The user object containing user details such as email.
    * @param resetToken - A unique token used for password reset.
    * @returns A Promise that resolves to `true` if the email was sent successfully, otherwise `false`.
    */ 
    async sendPasswordResetEmail(user: IUser, resetToken: string): Promise<boolean> {

        // validate the email address
        if (!this.validateEmailAddress(user.email)) {
            this.logger.error("Invalid Email")
            return false
        };

        // Define the reset link
        const resetLink = `http://the-app-domain/api/auth/forgot-password/${resetToken}`; // TODO ask the developer that define the routes

        // Build the options object
        const emailOptions: IEmailOptions = {
            to: user.email ,
            subject: 'Reset Password -  Auto Docs!',
        };
        return await this.sendTemplatedEmail("resetPassword", {...user, resetLink}, emailOptions)
    }

}




