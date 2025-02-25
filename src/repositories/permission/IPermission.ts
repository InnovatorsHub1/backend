import { BaseDocument } from "../BaseRepository";


export interface IPermission extends BaseDocument {
    name: string;
    resource: string;
    action: string;
    description: string;
}

export type Property = keyof IPermission;