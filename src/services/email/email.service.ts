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



@injectable()
export class EmailService implements IEmailService {
    private logger: WinstonLogger = new WinstonLogger('EmailService')

    constructor(
        @inject(TYPES.TemplateService) private readonly templateService: TemplateService,
        @inject(TYPES.ValidationService) private readonly validationService: ValidationService,
        @inject(TYPES.RetryService) private readonly retryService: RetryService
    ) {
        this.logger = new WinstonLogger('EmailService');
    }

    validateEmailAddress(email: string): boolean {
        const emailRules =   [
            { name: "email", message: "Invalid email format" },
            {name: "required", message: "Email is required!" }
            ]
            const {isValid} = this.validationService.validateField(email, emailRules)
        return isValid
    };

    validateEmailAddresses(emails: string[]): boolean {
        return emails.every(email => this.validateEmailAddress(email))
    };



    async sendEmail(options: IEmailOptions): Promise<boolean> {
        try {
           await transporter.sendMail(options);
            return true
        } catch (error) {
            this.logger.error("Failed sending email", error);
            return false
        };
    };

    async sendWelcomeEmail(user: IUser): Promise<boolean> {
        // validate the email address
        if(!this.validateEmailAddress(user.email)) {
            this.logger.warn("Invalid Email")
            return false
        };
        
        // Build the options object
        const emailOptions: IEmailOptions = {
            to: user.email || " ",
            subject: 'Welcome to Auto Docs!',
        };
        // Send the Email
        return await this.sendTemplatedEmail("welcome", user, emailOptions)


    }
    async sendTemplatedEmail(templateName: string, context: Record<string, any>, options: Partial<IEmailOptions>): Promise<boolean> {
        // Use template service for validate template
        const isValidTemplate = await this.templateService.validateTemplate(templateName);
        if(!isValidTemplate){
            this.logger.error("Invalid template")
            throw  new ApiError("Invalid template", 500, "emailService")
        } // ************************* Maybe need to throw error ^ ***************************

        // Use template service for fetch the template and set the context
        const template = await this.templateService.renderTemplate(templateName, context);

        // Add the template to the options
        const emailOptions = {
            ...options,
            html: template
        }
        
          try {
            await transporter.sendMail(emailOptions);
            return true
          } catch (error) {
            this.logger.error("Failed sending email", error);
            // throw new ApiError("Failed sending email", 500, "EmailService") *** The function maybe needs to return Promise<string>
            return false
          }
        }
    }




