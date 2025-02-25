import { BaseRepository } from "../BaseRepository";
import { IPermission, Property } from "./IPermission";
import { tryCatch } from "@gateway/utils/tryCatches";
import { getMongoConnection } from "@gateway/utils/mongoConnection";
import { ObjectId } from "mongodb";

export class PermissionRepository extends BaseRepository<IPermission> {
    constructor() {
        const { error } = tryCatch(getMongoConnection().getClient);
        if (error) getMongoConnection().connect();
        const collection = getMongoConnection().getClient().db().collection<IPermission>('permissions');
        super(collection);
    }

    findById(id: string) {
        return this.collection.findOne({ _id: new ObjectId(id) });
    }

    findByName(name: string) {
        return this.collection.findOne({ name });
    }

    findByResource(resource: string) {
        return this.collection.find({ resource });
    }

    findByResourceAndAction(resource: string, action: string) {
        return this.collection.findOne({ resource: resource, action: action });
    }
}