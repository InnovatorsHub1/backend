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
    }
    validateEmailAddresses(emails: string[]): boolean {
        return emails.every(email => this.validateEmailAddress(email))
    }
    
}


