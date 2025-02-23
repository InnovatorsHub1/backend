export interface IUser {
    name: string;
    email: string;
    password?: string;
    isVerify?: boolean;
    resetToken?: string;
    createdAt?: Date;

}