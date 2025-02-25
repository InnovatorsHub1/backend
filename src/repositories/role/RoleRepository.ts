import { getMongoConnection } from "@gateway/utils/mongoConnection";
import { BaseRepository } from "../BaseRepository";
import { IRole } from "./IRole";
import { Condition } from "mongodb";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "@gateway/core/errors/api.error";
import { tryCatch, tryCatchAsync } from "@gateway/utils/tryCatches";



export class RoleRepository extends BaseRepository<IRole> {
    constructor() {
        const { error } = tryCatch(getMongoConnection().getClient);
        if (error) getMongoConnection().connect();
        const collection = getMongoConnection().getClient().db().collection<IRole>('roles');
        super(collection);
    }

    async findByRole(role: string): Promise<IRole | null> {
        const { data, error } = await tryCatchAsync(async () => {
            return await this.collection.findOne({ name: role as Condition<"user" | "admin"> });
        });
        if (error) throw new ApiError('Failed to find role', StatusCodes.INTERNAL_SERVER_ERROR, 'RoleRepository');
        if (!data) throw new ApiError('Role not found', StatusCodes.NOT_FOUND, 'RoleRepository');
        return data as IRole | null;
    }

    async findAllRoles(): Promise<IRole[]> {
        const { data, error } = await tryCatchAsync(async () => {
            return await this.collection.find({}).toArray();
        });
        if (error) throw new ApiError('Failed to find roles', StatusCodes.INTERNAL_SERVER_ERROR, 'RoleRepository');
        return data as IRole[];
    }
}
