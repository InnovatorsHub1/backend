import { BaseDocument } from "../BaseRepository";

export interface IRole extends BaseDocument {
    name: 'user' | 'admin';
    permissions: string[];
    description: string;
}
